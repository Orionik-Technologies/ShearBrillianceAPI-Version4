const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { end } = require('pdfkit');
const sendResponse = require('../helpers/responseHelper'); // Import the helper function
const { isOnlinePaymentEnabled }= require('../helpers/configurationHelper'); // Import the helper function
const db = require("../models");
const { Payment, Appointment, Service } = require('../models'); // Adjust path as needed
const { PaymentMethodENUM } = require('../config/paymentEnums.config');
const { INVITE_BOOKING_APPOINTMENT_TEMPLATE_ID } = require("../config/sendGridConfig");
const { appCheck } = require('firebase-admin');
const { sendEmail } = require("../services/emailService");
const { sendMessageToUser } = require('./socket.controller');
const { sendSMS } = require('../services/smsService');
const { BarberCategoryENUM } = require('../config/barberCategory.config');
const { broadcastBoardUpdates } = require('../controllers/socket.controller');
const {  getAppointmentsByRoleExp, handleBarberCategoryLogicExp, prepareEmailDataExp, sendAppointmentNotificationsExp, fetchAppointmentWithServicesExp, validateAndAttachServicesExp } = require('../controllers/appointments.controller');




exports.createPayment = async (req, res) => {
    try {

        // Check if online payment is enabled
        const onlinePaymentEnabled = await isOnlinePaymentEnabled();
        if (!onlinePaymentEnabled) {
            return sendResponse(res, false, 'Online payment is currently disabled', null, 403);
        }

        const { totalAmount, appointmentData, user_id, validatedTip } = req.body;

        // Validate required fields
        if (!user_id || !appointmentData || !totalAmount || typeof validatedTip === 'undefined') {
            return sendResponse(res, false, 'Missing required fields', null, 400);
        }

        // Ensure appointmentData has all necessary fields
        const requiredFields = ['BarberId', 'SalonId', 'name', 'mobile_number', 'service_ids'];
        const missingFields = requiredFields.filter(field => !appointmentData[field]);
        if (missingFields.length > 0) {
            return sendResponse(res, false, `Missing required appointment fields: ${missingFields.join(', ')}`, null, 400);
        }

        // Get barber details to determine category
        const barber = await db.Barber.findByPk(appointmentData.BarberId);
        if (!barber) {
            return sendResponse(res, false, 'Barber not found', null, 404);
        }

        // Check if slot_id is provided for appointment-based barbers
        if (barber.category !== BarberCategoryENUM.ForWalkIn && !appointmentData.SlotId) {
            return sendResponse(res, false, 'Slot ID is required for appointment-based bookings', null, 400);
        }

        // Calculate total service time for barber category logic
        const services = await Service.findAll({
            where: { id: [...new Set(appointmentData.service_ids)] },
            attributes: ['id', 'default_service_time'],
        });

        if (!services.length) {
            return sendResponse(res, false, 'No valid services found', null, 400);
        }

        const serviceFrequency = appointmentData.service_ids.reduce((freq, id) => {
            freq[id] = (freq[id] || 0) + 1;
            return freq;
        }, {});

        const totalServiceTime = services.reduce((sum, service) => {
            const frequency = serviceFrequency[service.id] || 0;
            return sum + (service.default_service_time * frequency);
        }, 0);

        // Ensure paymentMode is set in appointmentData
        const updatedAppointmentData = {
            ...appointmentData,
            UserId: user_id,
            paymentMode: PaymentMethodENUM.Pay_Online, // Explicitly set here
            tip: validatedTip,
            total_amount: totalAmount,
        };

        // Handle barber category logic (updates appointmentData with slot/appointment details)
        const finalAppointmentData = await handleBarberCategoryLogicExp(barber, user_id, totalServiceTime, updatedAppointmentData, appointmentData.SlotId);

        // Log appointmentData to debug
        console.log('Final Appointment Data:', finalAppointmentData);

        // Create Stripe Payment Intent
        const amountInCents = Math.round(totalAmount * 100); // Convert to cents for Stripe
        const serializedAppointmentData = JSON.stringify(finalAppointmentData);

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: 'usd',
            metadata: {
                user_id: user_id.toString(),
                appointmentData: serializedAppointmentData,
                tip: validatedTip.toString(),
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        // Return the client secret and payment intent ID
         return sendResponse(res, true, 'Payment initiated successfully', {
            paymentIntent
        }, 200);

    } catch (error) {
        console.error('Error creating payment intent:', error);
        return sendResponse(res, false, error.message || 'Failed to create payment intent', null, 500);
    }
};


exports.handleWebhook = async (req, res) => {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = req.headers['stripe-signature'];

    if (!sig) {
        console.error('Missing stripe-signature header');
        return res.status(400).send('Webhook Error: Missing stripe-signature header');
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const handleRefundUpdates = async (refund, paymentIntentId) => {
        let payment = await Payment.findOne({ where: { paymentIntentId } });
        if (!payment) {
            console.error('Payment not found for refund:', paymentIntentId);
            payment = await Payment.create({
                paymentIntentId,
                paymentStatus: 'Failed', // Initial status before refund
                UserId: refund.metadata?.user_id || null, // Optional, if available
                totalAmount: refund.amount / 100, // Amount in dollars
                paymentMethod: PaymentMethodENUM.Pay_Online,
            });
        }

        const paymentStatus = refund.status === 'succeeded' ? 'Refunded' : refund.status === 'failed' ? 'Failed' : 'Processing';
        await payment.update({
            paymentStatus,
            refundId: refund.id,
            refundReason: refund.reason || 'Unknown',
            refundedAt: refund.status === 'succeeded' ? new Date() : null,
        });

        const appointment = await Appointment.findOne({ where: { id: payment.appointmentId } });
        if (appointment) {
            await appointment.update({
                status: refund.status === 'succeeded' ? 'canceled' : appointment.status, // Cancel only on successful refund
                paymentStatus, // Sync with Payment status
                cancel_time: refund.status === 'succeeded' ? new Date() : appointment.cancel_time,
            });
        }
    };

    switch (event.type) {
        case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object;
            console.log('PaymentIntent was successful:', paymentIntent);

            const userId = paymentIntent.metadata.user_id;
            const appointmentData = JSON.parse(paymentIntent.metadata.appointmentData);
            const tip = parseFloat(paymentIntent.metadata.tip || 0);
            const totalAmount = paymentIntent.amount / 100;

            const cleanedAppointmentData = {
                ...appointmentData,
                UserId: userId,
                paymentMode: appointmentData.payment_mode || PaymentMethodENUM.Pay_Online,
                paymentStatus: 'Success',
                stripePaymentIntentId: paymentIntent.id,
                estimated_wait_time: appointmentData.estimated_wait_time === 'null' ? null : appointmentData.estimated_wait_time,
                queue_position: appointmentData.queue_position === 'null' ? null : appointmentData.queue_position,
            };

            console.log('Cleaned Appointment Data:', cleanedAppointmentData);

            try {
                const appointment = await Appointment.create(cleanedAppointmentData);

                await Payment.create({
                    appointmentId: appointment.id,
                    UserId: userId,
                    amount: totalAmount - tip - (appointmentData.tax || 0),
                    tax: appointmentData.tax || 0,
                    tip,
                    totalAmount,
                    paymentStatus: 'Success',
                    paymentIntentId: paymentIntent.id,
                    paymentMethod: PaymentMethodENUM.Pay_Online,
                    paymentCompletedAt: new Date(),
                });

                await validateAndAttachServicesExp(appointment, appointmentData.service_ids, res);
                const appointmentWithServices = await fetchAppointmentWithServicesExp(appointment.id);

                const barber = await db.Barber.findByPk(appointmentData.BarberId);
                const salon = await db.Salon.findByPk(appointmentData.SalonId);
                const user = await db.USER.findOne({ where: { id: userId }, attributes: ['email'] });

                let receiptUrl = paymentIntent.charges?.data[0]?.receipt_url;
                if (!receiptUrl) {
                    try {
                        const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
                        receiptUrl = charge.receipt_url;
                    } catch (error) {
                        console.error('Error retrieving charge:', error);
                    }
                }

                if (user) {
                    const emailData = prepareEmailDataExp(
                        appointment,
                        barber,
                        salon,
                        appointmentWithServices.dataValues.Services,
                        tip,
                        appointmentData.tax || 0,
                        totalAmount,
                        receiptUrl || null
                    );
                    await sendEmail(
                        user.email,
                        "Your Online Payment Appointment Booked Successfully",
                        INVITE_BOOKING_APPOINTMENT_TEMPLATE_ID,
                        emailData
                    );
                }

                await sendAppointmentNotificationsExp(appointment, appointmentData.name, appointmentData.mobile_number, userId, appointmentData.SalonId);

                if (barber?.category === BarberCategoryENUM.ForWalkIn) {
                    const updatedAppointments = await getAppointmentsByRoleExp(false);
                    if (updatedAppointments) broadcastBoardUpdates(updatedAppointments);
                }

                return res.json({ received: true });
            } catch (error) {
                console.error('Error processing payment intent succeeded:', error);

                try {
                    const refund = await stripe.refunds.create({
                        payment_intent: paymentIntent.id,
                        reason: 'requested_by_customer',
                    });
                    console.log('Refund initiated:', refund);

                    await handleRefundUpdates(refund, paymentIntent.id);
                    return res.json({ received: true, error: 'Appointment processing failed, refund initiated' });
                } catch (refundError) {
                    console.error('Error initiating refund:', refundError);
                    return res.json({ received: true, error: 'Appointment processing failed and refund could not be initiated' });
                }
            }
        }

        case 'payment_intent.payment_failed': {
            const paymentIntent = event.data.object;
            console.log('PaymentIntent failed:', paymentIntent);

            // Check if any amount was charged (e.g., authorization hold) that needs refunding
            if (paymentIntent.amount_received > 0) {
                try {
                const refund = await stripe.refunds.create({
                    payment_intent: paymentIntent.id,
                    reason: 'payment_failed',
                });
                console.log('Refund initiated for failed payment:', refund);
                await handleRefundUpdates(refund, paymentIntent.id);
                return res.json({ received: true, message: 'Payment failed, refund initiated' });
                } catch (refundError) {
                console.error('Error initiating refund for failed payment:', refundError);
                return res.json({ received: true, error: 'Payment failed, refund could not be initiated' });
                }
            } else {
                // No amount was charged, just log failure
                console.log('No refund needed, payment failed with no charge.');
                return res.json({ received: true, message: 'Payment failed, no refund needed' });
            }
        }

        case 'refund.created': {
            const refund = event.data.object;
            console.log('Refund created:', refund);
            await handleRefundUpdates(refund, refund.payment_intent);
            return res.json({ received: true });
        }

        case 'refund.updated': {
            const refund = event.data.object;
            console.log('Refund updated:', refund);
            await handleRefundUpdates(refund, refund.payment_intent);
            return res.json({ received: true });
        }

        default:
            console.log(`Unhandled event type: ${event.type}`);
            return res.json({ received: true });
    }
};


exports.checkPaymentStatus = async (req, res) => {
    const { paymentIntentId } = req.params;
  
    try {
      const payment = await Payment.findOne({ where: { paymentIntentId } });
      
      if (!payment) {
        // Payment not yet created by webhook, still processing
        return sendResponse(res, true, 'Payment still processing', { status: 'Pending' }, 200);
      }

      // Check payment status
      return sendResponse(res, true, 'Payment status retrieved', { status: payment.paymentStatus }, 200);
    } catch (error) {
      console.error('Error checking payment status:', error);
      return sendResponse(res, false, 'Failed to check payment status', null, 500);
    }
};