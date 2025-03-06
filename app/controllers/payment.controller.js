const Stripe = require('stripe');
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const { end } = require('pdfkit');
const sendResponse = require('../helpers/responseHelper'); // Import the helper function
const { isOnlinePaymentEnabled } = require('../helpers/configurationHelper'); // Import the helper function
const db = require("../models");
const { Payment, Appointment, Service } = require('../models'); // Adjust path as needed
const { PaymentMethodENUM } = require('../config/paymentEnums.config');
const { INVITE_BOOKING_APPOINTMENT_TEMPLATE_ID} = require("../config/sendGridConfig");
const { REFUND_PAYMENT} = require("../config/sendGridConfig");
const { appCheck } = require('firebase-admin');
const { sendEmail } = require("../services/emailService");
const { sendMessageToUser } = require('./socket.controller');
const { sendSMS } = require('../services/smsService');
const { AppointmentENUM } = require("../config/appointment.config");
const { BarberCategoryENUM } = require('../config/barberCategory.config');
const { broadcastBoardUpdates } = require('../controllers/socket.controller');
const { Op, where } = require("sequelize");
const { getAppointmentsByRoleExp, handleBarberCategoryLogicExp, prepareEmailDataExp, sendAppointmentNotificationsExp, fetchAppointmentWithServicesExp, validateAndAttachServicesExp, markSlotsAsBookedExp, verifyConsecutiveSlotsExp, markSlotsAsRelesedExp } = require('../controllers/appointments.controller');

/* function for checked_in appointment time calculations start */

// Function to calculate estimated wait time for a particular barber
const getEstimatedWaitTimeForBarber = async (barberId) => {
    // Fetch all appointments for the barber that are 'checked_in' or 'in_salon'
    const appointments = await Appointment.findAll({
        where: { BarberId: barberId, status: ['checked_in', 'in_salon'] },
        order: [['queue_position', 'ASC']], // Order by queue position to process in order
        include: [{
            model: Service,
            attributes: ['id', 'default_service_time'], // Fetch the 'estimated_service_time' from the Service model
            through: { attributes: [] } // Avoid extra attributes from the join table
        }],
    });

    let cumulativeQueuePosition = 0; // To track the cumulative number of people in the queue
    let cumulativeWaitTime = 0; // To track the cumulative wait time

    let applength = appointments.length;

    if (applength > 0) {
        // Check if there is only one 'in_salon' user
        const inSalonUser = appointments.find(a => a.status === 'in_salon');
        const checkedInUsers = appointments.filter(a => a.status === 'checked_in');

        if (inSalonUser && checkedInUsers.length === 0) {
            const currentTime = new Date();

            // Calculate elapsed time since the user was marked 'in_salon'
            const inSalonTime = new Date(inSalonUser.in_salon_time); // Start time of `in_salon` status
            const elapsedTime = Math.floor((currentTime - inSalonTime) / 60000); // Elapsed time in minutes

            // Calculate remaining time for the `in_salon` user
            const totalServiceTime = inSalonUser.Services.reduce(
                (sum, service) => sum + (service.default_service_time || 0),
                0
            );
            const remainingServiceTime = Math.max(totalServiceTime - elapsedTime, 0);

            // Add the remaining service time to the cumulative wait time
            cumulativeWaitTime += remainingServiceTime;
            cumulativeQueuePosition = applength; // Set queue position based on total appointments
        } else {
            let lastApp = appointments[applength - 1];

            const totalServiceTime = lastApp?.Services?.length > 0
                ? lastApp.Services.reduce((sum, service) => sum + (service.default_service_time || 0), 0) // Sum of estimated service times
                : 20; // If no services are selected, the wait time is zero


            cumulativeWaitTime = lastApp.estimated_wait_time + totalServiceTime;
            cumulativeQueuePosition = applength;
        }
    }
    return {
        totalWaitTime: cumulativeWaitTime, // Total cumulative wait time for the next user
        numberOfUsersInQueue: cumulativeQueuePosition // Total number of people in the queue
    };
};

// Helper function to calculate remaining time for walk-ins
function calculateRemainingTime(barberSession, activeAppointments) {
    if (activeAppointments.length > 0) {
        return barberSession.remaining_time;
    }

    const now = new Date();
    const today = new Date();
    const endTimeString = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()} ${barberSession.end_time}`;
    const sessionEndTime = new Date(endTimeString);

    if (isNaN(sessionEndTime)) {
        throw new Error("Invalid session end time format");
    }

    return Math.max(
        Math.round((sessionEndTime - now) / (1000 * 60)),
        0
    );
}

exports.calculateRemainingTimeExp = calculateRemainingTime;

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
                totalServiceTime: totalServiceTime
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
        console.log('Stripe-Signature:', sig);
        console.log('Server Time (UTC):', new Date().toISOString());
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret, {
            tolerance: 600, // Optional: Increase tolerance to 10 minutes
        });
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        if (err.code === 'webhook_timestamp_outside_tolerance') {
            console.warn('Timestamp outside tolerance zone, logging for review:', {
                signature: sig,
                rawBody: req.rawBody,
            });
            return res.status(400).send('Webhook Error: Timestamp outside tolerance zone');
        }
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

        const user = await db.USER.findByPk(appointment.UserId);

        const customerData = {
            email:user.email,
            paymentIntentId: paymentIntentId,
            totalAmount: totalAmount,
            customer_name: `${firstname} ${lastname}`,
            refundId:refundId,
            refundReason:refundReason,
            cancel_time:cancel_time,
            email_subject: 'Refund Payment',
        };

        await sendEmail(email, "Refund Payment", REFUND_PAYMENT, customerData);
    };

    switch (event.type) {
        case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object;
            console.log('PaymentIntent was successful:', paymentIntent);

            const userId = paymentIntent.metadata.user_id;
            const appointmentData = JSON.parse(paymentIntent.metadata.appointmentData);
            const metadataInfo = paymentIntent.metadata;

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
            const barber = await db.Barber.findByPk(appointmentData.BarberId);
            console.log('Cleaned Appointment Data:', cleanedAppointmentData);
            try {
                
                // save the barber sessionin db when checkin appointment type
                // Handle barber category logic (for walk-in appointments)
                if (!barber) {
                    throw new Error('Barber not found');
                }

                // Save barber session time if Walk-In category
                if (barber.category === BarberCategoryENUM.ForWalkIn) {
                    const today = new Date();
                    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
                    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

                    // Check if the user already has an active appointment
                    const activeAppointment = await db.Appointment.findOne({
                        where: { UserId: userId, status: [AppointmentENUM.Checked_in, AppointmentENUM.In_salon] }
                    });

                    if (activeAppointment) {
                        throw new Error("You already have an active appointment. Please complete or cancel it before booking a new one.");
                    }

                    // Retrieve the barber session
                    const barberSession = await db.BarberSession.findOne({
                        where: {
                            BarberId: barber.id,
                            session_date: { [Op.between]: [todayStart, todayEnd] }
                        },
                        attributes: ['id', 'start_time', 'end_time', 'session_date', 'remaining_time']
                    });

                    if (!barberSession) {
                        throw new Error('Barber session not found for today');
                    }

                    // Check for existing appointments for the barber
                    const activeBarberAppointments = await db.Appointment.findAll({
                        where: {
                            BarberId: barber.id,
                            status: [AppointmentENUM.Checked_in, AppointmentENUM.In_salon]
                        },
                    });

                    let remainingTime = calculateRemainingTime(barberSession, activeBarberAppointments);
                    if (remainingTime < metadataInfo.totalServiceTime) {
                        throw new Error('Not enough remaining time for this appointment');
                    }

                    const { totalWaitTime, numberOfUsersInQueue } = await getEstimatedWaitTimeForBarber(barber.id);

                    // Update appointmentData for walk-in
                    cleanedAppointmentData.status = AppointmentENUM.Checked_in;
                    cleanedAppointmentData.estimated_wait_time = totalWaitTime;
                    cleanedAppointmentData.queue_position = numberOfUsersInQueue + 1;
                    cleanedAppointmentData.check_in_time = new Date();

                    // Update barber session remaining time
                    await barberSession.update({
                        remaining_time: remainingTime - metadataInfo.totalServiceTime
                    });
                }

                // Save the slot in db when future appointment type
                if (cleanedAppointmentData.SlotId) {
                    // Get the selected slot
                    const slot = await db.Slot.findOne({
                        where: {
                            id: cleanedAppointmentData.SlotId,
                            is_booked: false
                        }
                    });

                    if (!slot) {
                        throw new Error('Selected slot is not available');
                    }

                    // Verify if enough consecutive slots are available
                    const requiredSlots = await verifyConsecutiveSlotsExp(
                        slot.BarberSessionId,
                        slot.slot_date,
                        slot.start_time,
                        metadataInfo.totalServiceTime
                    );

                    if (!requiredSlots) {
                        throw new Error('Not enough consecutive slots available');
                    }
                    await markSlotsAsBookedExp(requiredSlots);
                    cleanedAppointmentData.estimated_wait_time = null;
                    cleanedAppointmentData.queue_position = null;
                }

                // Create appointment and save record in db when i found status "payment_intent.succeeded"
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

                //const barber = await db.Barber.findByPk(appointmentData.BarberId);
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

                // Below logic is used when check_in appointment not book some error come, but time booked so here i relesed booked time
                // Release barber session time if it was booked
                if (barber?.category === BarberCategoryENUM.ForWalkIn) {
                    const barberSession = await db.BarberSession.findOne({
                        where: { BarberId: appointmentData.BarberId },
                    });

                    if (barberSession) {
                        // Calculate the total service time to restore
                        const totalServiceTime = appointmentData.Services.reduce((sum, service) => {
                            return sum + (service.default_service_time || 0);
                        }, 0);

                        // Calculate the new remaining time
                        let updatedRemainingTime = barberSession.remaining_time + totalServiceTime;

                        // Cap remaining time to the barber's total available time
                        const totalAvailableTime = barberSession.total_time;
                        if (updatedRemainingTime > totalAvailableTime) {
                            updatedRemainingTime = totalAvailableTime;
                        }

                        // Save the new remaining time to the database
                        await barberSession.update({ remaining_time: updatedRemainingTime });
                    }
                }

                // Below logic is used when future appointment not book some error come, but slot booked so here i relesed booked slot.
                if (cleanedAppointmentData.SlotId) {
                    // Get the selected slot
                    const slot = await db.Slot.findOne({
                        where: {
                            id: cleanedAppointmentData.SlotId,
                            is_booked: false
                        }
                    });

                    if (!slot) {
                        throw new Error('Selected slot is not available');
                    }else{
                        await markSlotsAsRelesedExp([{ id: cleanedAppointmentData.SlotId }]);
                    }

                }

                // handle return refund payment
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