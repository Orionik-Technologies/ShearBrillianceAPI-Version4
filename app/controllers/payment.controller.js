const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { end } = require('pdfkit');
const sendResponse = require('../helpers/responseHelper'); // Import the helper function
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

exports.refundPayment = async (req, res) => {
    try {
        const { appointmentId, reason } = req.body;
        const userId = req.user ? req.user.id : null;

        // Validate inputs
        if (!appointmentId) {
            return sendResponse(res, false, 'Appointment ID is required', null, 400);
        }
        if (!userId) {
            return sendResponse(res, false, 'User authentication required', null, 401);
        }

        // Fetch the appointment
        const appointment = await db.Appointment.findByPk(appointmentId, {
            include: [{ model: db.Payment, as: 'Payment' }],
        });
        if (!appointment) {
            return sendResponse(res, false, 'Appointment not found', null, 404);
        }

        // Fetch the associated payment
        const payment = appointment.Payment;
        if (!payment || !payment.paymentIntentId) {
            return sendResponse(res, false, 'No payment found or payment not processed via Stripe', null, 400);
        }

        // Check if payment is eligible for refund
        if (payment.paymentStatus !== 'Success') {
            return sendResponse(res, false, 'Payment is not in a refundable state', null, 400);
        }

        // Check if already refunded
        if (payment.refundId) {
            return sendResponse(res, false, 'Payment has already been refunded', null, 400);
        }

        // Calculate refund amount (full refund for simplicity; adjust if partial refunds are needed)
        const refundAmountInCents = Math.round(payment.totalAmount * 100);

        // Create refund via Stripe
        const refund = await stripe.refunds.create({
            payment_intent: payment.paymentIntentId,
            amount: refundAmountInCents, // Full refund; remove or adjust for partial refund
            reason: reason || 'requested_by_customer', // Stripe accepts specific reasons
            metadata: {
                user_id: userId.toString(),
                appointment_id: appointmentId.toString(),
            },
        });

        // Update Payment record with refund details
        await payment.update({
            paymentStatus: 'Refunded',
            refundId: refund.id,
            refundReason: reason || 'Customer requested refund',
            refundedAt: new Date(),
        });

        // Update Appointment status (e.g., mark as canceled)
        await appointment.update({
            status: 'canceled',
            cancel_time: new Date(),
            paymentStatus: 'Refunded',
        });

        // Fetch related data for notifications
        const barber = await db.Barber.findByPk(appointment.BarberId);
        const salon = await db.Salon.findByPk(appointment.SalonId);
        const user = await db.USER.findOne({ where: { id: userId }, attributes: ['email'] });

        // Prepare email data for refund confirmation
        const emailData = {
            customer_name: appointment.name,
            barber_name: barber ? barber.name : 'N/A',
            salon_name: salon ? salon.name : 'N/A',
            appointment_date: appointment.appointment_date || new Date().toLocaleDateString(),
            refund_amount: payment.totalAmount,
            refund_id: refund.id,
            reason: reason || 'Customer requested',
            email_subject: 'Refund Confirmation',
        };

        // Send refund confirmation email
        if (user && user.email) {
            await sendEmail(
                user.email,
                "Your Refund Has Been Processed",
                INVITE_BOOKING_APPOINTMENT_TEMPLATE_ID, // Reuse or create a new template ID
                emailData
            );
        }

        // Send SMS notification
        if (appointment.mobile_number) {
            const message = `Dear ${appointment.name}, your refund of $${payment.totalAmount} for your appointment at ${salon ? salon.name : 'the salon'} has been processed. Refund ID: ${refund.id}.`;
            await sendSMS(appointment.mobile_number, message);
        }

        // Broadcast updates if applicable (e.g., for walk-ins)
        if (barber && barber.category === BarberCategoryENUM.ForWalkIn) {
            const updatedAppointments = await getAppointmentsByRoleExp(false);
            if (updatedAppointments) broadcastBoardUpdates(updatedAppointments);
        }

        return sendResponse(res, true, 'Refund processed successfully', {
            refundId: refund.id,
            amount: payment.totalAmount,
            appointmentId: appointment.id,
        }, 200);

    } catch (error) {
        console.error('Error processing refund:', error);
        return sendResponse(res, false, error.message || 'Failed to process refund', null, 500);
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

    switch (event.type) {
        case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object;
            console.log('PaymentIntent was successful:', paymentIntent);

            const userId = paymentIntent.metadata.user_id;
            const appointmentData = JSON.parse(paymentIntent.metadata.appointmentData);
            const tip = parseFloat(paymentIntent.metadata.tip || 0);
            const totalAmount = paymentIntent.amount / 100; // Convert cents to dollars

            // Ensure paymentMode is explicitly set and cleaned
            const cleanedAppointmentData = {
                ...appointmentData,
                UserId: userId, // Ensure UserId is set
                paymentMode: appointmentData.payment_mode || PaymentMethodENUM.Pay_Online || 'Pay_Online', // Handle both cases with fallback
                paymentStatus: 'Success',
                stripePaymentIntentId: paymentIntent.id,
                // Handle null-like strings
                estimated_wait_time: appointmentData.estimated_wait_time === 'null' ? null : appointmentData.estimated_wait_time,
                queue_position: appointmentData.queue_position === 'null' ? null : appointmentData.queue_position,
            };

            console.log('Cleaned Appointment Data:', cleanedAppointmentData);

            // Create appointment
            const appointment = await Appointment.create(cleanedAppointmentData);
           
            // Create payment record
            await Payment.create({
                appointmentId: appointment.id,
                UserId: userId,
                amount: totalAmount - tip - (appointmentData.tax || 0),
                tax: appointmentData.tax || 0,
                tip: tip,
                totalAmount: totalAmount,
                paymentStatus: 'Success',
                paymentIntentId: paymentIntent.id,
                paymentMethod: PaymentMethodENUM.Pay_Online,
                paymentCompletedAt: new Date(),
            });

            // Validate and attach services
            await validateAndAttachServicesExp(appointment, appointmentData.service_ids, res);

            // Fetch appointment with services
            const appointmentWithServices = await fetchAppointmentWithServicesExp(appointment.id);

            // Send email and notifications
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
            console.log('Receipt URL:', receiptUrl); // Debug log

            if (user) {
                console.log('Appointment Payment Mode:', appointment.paymentMode); // Debug log
                const emailData = prepareEmailDataExp(
                    appointment,
                    barber,
                    salon,
                    appointmentWithServices.dataValues.Services,
                    tip,
                    appointmentData.tax || 0,
                    totalAmount,
                    receiptUrl || null // Explicitly pass null if receipt URL is undefined
                );
                console.log('Email Data:', emailData); // Debug log

                await sendEmail(
                    user.email,
                    "Your Online Payment Appointment Booked Successfully",
                    INVITE_BOOKING_APPOINTMENT_TEMPLATE_ID,
                    emailData
                );
            }

            await sendAppointmentNotificationsExp(appointment, appointmentData.name, appointmentData.mobile_number, userId, appointmentData.SalonId);

            if (barber.category === BarberCategoryENUM.ForWalkIn) {
                const updatedAppointments = await getAppointmentsByRoleExp(false);
                if (updatedAppointments) broadcastBoardUpdates(updatedAppointments);
            }

            return res.json({ received: true });
        }

        case 'payment_intent.payment_failed': {
            console.error('PaymentIntent failed:', event.data.object);
            return res.json({ received: true });
        }

        case 'refund.created': {
            const refund = event.data.object;
            console.log('Refund created:', refund);

            const paymentIntentId = refund.payment_intent;
            const refundId = refund.id;

            // Find the payment record
            const payment = await db.Payment.findOne({ where: { paymentIntentId } });
            if (!payment) {
                console.error('Payment not found for refund:', paymentIntentId);
                return res.json({ received: true });
            }

            // Update payment with refund details
            await payment.update({
                paymentStatus: refund.status === 'succeeded' ? 'Refunded' : 'Pending',
                refundId: refundId,
                refundReason: refund.reason || 'Unknown',
                refundedAt: refund.status === 'succeeded' ? new Date() : null,
            });

            // Update associated appointment
            const appointment = await db.Appointment.findOne({ where: { id: payment.appointmentId } });
            if (appointment) {
                await appointment.update({
                    status: 'canceled',
                    cancel_time: new Date(),
                    paymentStatus: refund.status === 'succeeded' ? 'Refunded' : 'Pending',
                });
            }

            return res.json({ received: true });
        }

        case 'refund.updated': {
            const refund = event.data.object;
            console.log('Refund updated:', refund);

            const paymentIntentId = refund.payment_intent;
            const refundId = refund.id;

            // Find the payment record
            const payment = await db.Payment.findOne({ where: { paymentIntentId } });
            if (!payment) {
                console.error('Payment not found for refund update:', paymentIntentId);
                return res.json({ received: true });
            }

            // Update payment status based on refund status
            await payment.update({
                paymentStatus: refund.status === 'succeeded' ? 'Refunded' : refund.status === 'failed' ? 'Failed' : 'Pending',
                refundedAt: refund.status === 'succeeded' ? new Date() : null,
            });

            // Update associated appointment
            const appointment = await db.Appointment.findOne({ where: { id: payment.appointmentId } });
            if (appointment) {
                await appointment.update({
                    paymentStatus: refund.status === 'succeeded' ? 'Refunded' : refund.status === 'failed' ? 'Failed' : 'Pending',
                });
            }

            return res.json({ received: true });
        }

        default:
            console.log(`Unhandled event type: ${event.type}`);
            return res.json({ received: true });
    }
};


