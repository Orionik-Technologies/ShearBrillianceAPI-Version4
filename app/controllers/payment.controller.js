const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { end } = require('pdfkit');
const sendResponse = require('../helpers/responseHelper'); // Import the helper function
const db = require("../models");
const { Payment, Appointment, Service } = require('../models'); // Adjust path as needed
const PaymentMethodENUM = require('../config/paymentEnums.config');
const { INVITE_BOOKING_APPOINTMENT_TEMPLATE_ID } = require("../config/sendGridConfig");
const { appCheck } = require('firebase-admin');
const { sendEmail } = require("../services/emailService");
const { sendMessageToUser } = require('./socket.controller');
const { sendSMS } = require('../services/smsService');
const { BarberCategoryENUM } = require('../config/barberCategory.config');
const { calculateRemainingTimeExp, prepareEmailDataExp, sendAppointmentNotificationsExp } = require('../controllers/appointments.controller');




// API to handle payment creation
exports.createPayment = async (req, res) => {
    try {
        const { totalAmount, appointmentData, user_id, validatedTip } = req.body;

        // Log appointmentData to debug
        console.log('Appointment Data:', appointmentData);

        // Convert amount to cents (Stripe expects amounts in the smallest currency unit)
        const amountInCents = Math.round((totalAmount + validatedTip) * 100);

        // Serialize appointmentData into a JSON string
        const serializedAppointmentData = JSON.stringify(appointmentData);

        // Create a Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: 'usd',
            metadata: {
                user_id: user_id.toString(),
                appointmentData: serializedAppointmentData, // Pass serialized data
                tip: validatedTip.toString(),
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        // Return the client secret and payment intent ID
        return sendResponse(res, true, 'Payment initiated successfully', {
            paymentIntent,
        }, 200);

    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({
            error: 'Failed to create payment intent',
            message: error.message,
        });
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
        console.log("Raw request body:", req.body);
        // req.body is now a Buffer, exactly what Stripe needs
        event = stripe.webhooks.constructEvent(
            req.rawBody,
            sig,
            endpointSecret
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Parse the raw body for our own use after verification
    //const payload = JSON.parse(req.body.toString());

    //console.log('Webhook event received:', payload);

    // const event = req.body;

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object;
            console.log('PaymentIntent was successful:', paymentIntent);

            // Extract metadata
            const userId = paymentIntent.metadata.user_id;
            const appointmentData = JSON.parse(paymentIntent.metadata.appointmentData);

            
            const tip = parseFloat(paymentIntent.metadata.tip || 0);
            const totalAmount = paymentIntent.amount / 100; // Convert cents to dollars
            const currency = paymentIntent.currency.toUpperCase();

            console.log('Extracted metadata:', {
                userId,
                appointmentData,
                tip,
                totalAmount,
                currency,
            });

            try {
                // Create an Appointment record in the database
                const cleanedAppointmentData = {
                    appointment_date: appointmentData.appointment_date,
                    appointment_end_time: appointmentData.appointment_end_time,
                    appointment_start_time: appointmentData.appointment_start_time,
                    BarberId: parseInt(appointmentData.BarberId),
                    mobile_number: appointmentData.mobile_number,
                    name: appointmentData.name,
                    number_of_people: parseInt(appointmentData.number_of_people) || 1,
                    SalonId: parseInt(appointmentData.SalonId),
                    SlotId: parseInt(appointmentData.SlotId),
                    service_ids: appointmentData.service_ids,
                    // Set explicit null for optional fields instead of string "null"
                    estimated_wait_time: appointmentData.estimated_wait_time === 'null' ? null : parseInt(appointmentData.estimated_wait_time),
                    queue_position: appointmentData.queue_position === 'null' ? null : parseInt(appointmentData.queue_position),
                    // Set payment related fields
                    paymentMode: 'Pay_Online',
                    status: 'appointment',
                    paymentStatus: 'Success',
                    stripePaymentIntentId: paymentIntent.id,
                    UserId: parseInt(userId)
                };
        
                // Create appointment with cleaned data
                const appointment = await Appointment.create(cleanedAppointmentData);
        
                console.log('Appointment created successfully:', appointment);
        

                // Create a Payment record in the database
                const payment = await Payment.create({
                    appointmentId: appointment.id, // Link the payment to the appointment
                    UserId: userId,
                    amount: totalAmount - tip, // Base amount (excluding tip)
                    tip: tip,
                    tax: appointmentData.tax || 0, // Optional tax from metadata
                    discount: appointmentData.discount || 0, // Optional discount from metadata
                    totalAmount: totalAmount, // Total amount paid
                    currency: currency,
                    paymentStatus: 'Success', // Mark as successful
                    paymentIntentId: paymentIntent.id, // Store the Stripe PaymentIntent ID
                    deviceId: appointmentData.deviceId || null,
                    deviceType: appointmentData.deviceType || null,
                    deviceModel: appointmentData.deviceModel || null,
                    osVersion: appointmentData.osVersion || null,
                    ipAddress: appointmentData.ipAddress || null,
                    userAgent: appointmentData.userAgent || null,
                    location: appointmentData.location || null,
                    description: `Payment for appointment ID ${appointment.id}`,
                    notes: appointmentData.notes || null,
                    paymentInitiatedAt: paymentIntent.created ? new Date(paymentIntent.created * 1000) : null,
                    paymentCompletedAt: new Date(), // Current timestamp
                });

                 // Fetch additional required data for email
                const barber = await db.Barber.findByPk(appointmentData.BarberId);
                const salon = await db.Salon.findByPk(appointmentData.SalonId);

                // Fetch services data
                const services = await Service.findAll({ 
                    where: { id: appointmentData.service_ids },
                    attributes: ['id', 'name', 'min_price', 'max_price', 'default_service_time']
                });

                 // Get user email
                const user = await db.USER.findOne({ 
                    where: { id: userId },
                    attributes: ['email'] 
                });

                if (!user) {
                    console.error('User not found for email notification');
                } else {
                    // Prepare email data
                    const emailData = prepareEmailDataExp(
                        appointment,
                        barber,
                        salon,
                        services,
                        tip,
                        tax = appointmentData.tax || 0,
                        totalAmount
                    );

                    // Send confirmation email
                    await sendEmail(
                        user.email,
                        "Your Online Payment Appointment Booked Successfully",
                        INVITE_BOOKING_APPOINTMENT_TEMPLATE_ID,
                        emailData
                    );
                }

                // Send notifications
                // await sendAppointmentNotifications(
                //     appointment, 
                //     appointmentData.name, 
                //     appointmentData.mobile_number, 
                //     userId, 
                //     appointmentData.SalonId
                // );

                console.log('Appointment and Payment records created successfully:', {
                    appointment,
                    payment,
                });

                // Send a success response to the client
                return sendResponse(res, true, 'Appointment and Payment created successfully', {
                    appointment,
                    payment,
                }, 200);

            } catch (error) {
                console.error('Error saving Appointment or Payment to the database:', error.message);
                return res.status(500).send('Database Error: Failed to save Appointment or Payment');
            }

            break;
        }

        case 'payment_intent.payment_failed': {
            const failedPaymentIntent = event.data.object;
            console.error('PaymentIntent failed:', failedPaymentIntent);

            // Handle the failed payment, e.g., notify the user or log the failure
            break;
        }

        // Add more cases for other event types you want to handle
        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });
};


