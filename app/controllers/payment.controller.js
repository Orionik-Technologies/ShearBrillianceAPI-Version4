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




// // API to handle payment creation
// exports.createPayment = async (req, res) => {
//     try {
//         const { totalAmount, appointmentData, user_id, validatedTip } = req.body;

//         // Log appointmentData to debug
//         console.log('Appointment Data:', appointmentData);

//         // Convert amount to cents (Stripe expects amounts in the smallest currency unit)
//         const amountInCents = Math.round((totalAmount + validatedTip) * 100);

//         // Serialize appointmentData into a JSON string
//         const serializedAppointmentData = JSON.stringify(appointmentData);

//         // Create a Payment Intent
//         const paymentIntent = await stripe.paymentIntents.create({
//             amount: amountInCents,
//             currency: 'usd',
//             metadata: {
//                 user_id: user_id.toString(),
//                 appointmentData: serializedAppointmentData, // Pass serialized data
//                 tip: validatedTip.toString(),
//             },
//             automatic_payment_methods: {
//                 enabled: true,
//             },
//         });

//         // Return the client secret and payment intent ID
//         return sendResponse(res, true, 'Payment initiated successfully', {
//             paymentIntent,
//         }, 200);

//     } catch (error) {
//         console.error('Error creating payment intent:', error);
//         res.status(500).json({
//             error: 'Failed to create payment intent',
//             message: error.message,
//         });
//     }
// };


// // API to handle payment creation
// exports.createPayment = async (req, res) => {
//     try {
//         let { user_id, salon_id, barber_id, number_of_people, name, mobile_number, service_ids, slot_id, tip } = req.body;
//         user_id = req.user ? req.user.id : user_id;

//         // Validate required fields
//         if (!user_id || !salon_id || !barber_id || !name || !mobile_number || !service_ids) {
//             return sendResponse(res, false, 'Missing required fields', null, 400);
//         }

//         // Get barber details including category
//         const barber = await db.Barber.findByPk(barber_id);
//         if (!barber) {
//             return sendResponse(res, false, 'Barber not found', null, 404);
//         }

//         // Calculate total service time and cost considering duplicates
//         const services = await Service.findAll({
//             where: { id: [...new Set(service_ids)] }, // Get unique service IDs for query
//             attributes: ['id', 'default_service_time', 'min_price'],
//         });

//         if (!services.length) {
//             return sendResponse(res, false, 'No valid services found', null, 400);
//         }

//         // Create a frequency map of service_ids
//         const serviceFrequency = service_ids.reduce((freq, id) => {
//             freq[id] = (freq[id] || 0) + 1;
//             return freq;
//         }, {});

//         const totalServiceTime = services.reduce((sum, service) => {
//             const frequency = serviceFrequency[service.id] || 0;
//             return sum + (service.default_service_time * frequency);
//         }, 0);

//         const totalServiceCost = services.reduce((sum, service) => {
//             const frequency = serviceFrequency[service.id] || 0;
//             return sum + (Number(service.min_price) * frequency);
//         }, 0);

//         const tax = parseFloat((totalServiceCost * 0.13).toFixed(2)); // 13% tax
//         const validatedTip = isNaN(tip) ? 0 : Number(tip);
//         const totalAmount = parseFloat((totalServiceCost + tax + validatedTip).toFixed(2));

//         // Wrap all data into appointmentData
//         let appointmentData = {
//             UserId: user_id,
//             BarberId: barber_id,
//             SalonId: salon_id,
//             number_of_people: number_of_people ?? 1,
//             name: name,
//             mobile_number: mobile_number,
//             service_ids: service_ids,
//             tax: tax,
//             tip: validatedTip,
//             total_amount: totalAmount,
//             paymentMode: PaymentMethodENUM.Pay_Online,
//         };

//         // Handle barber category logic (walk-in or appointment-based)
//         appointmentData = await handleBarberCategoryLogicExp(barber, user_id, totalServiceTime, appointmentData, slot_id);

//         // Log appointmentData to debug
//         console.log('Appointment Data:', appointmentData);

//         // Create Stripe Payment Intent
//         const amountInCents = Math.round(totalAmount * 100); // Convert to cents for Stripe
//         const serializedAppointmentData = JSON.stringify(appointmentData);

//         const paymentIntent = await stripe.paymentIntents.create({
//             amount: amountInCents,
//             currency: 'usd',
//             metadata: {
//                 user_id: user_id.toString(),
//                 appointmentData: serializedAppointmentData, // Pass serialized data
//                 tip: validatedTip.toString(),
//             },
//             automatic_payment_methods: {
//                 enabled: true,
//             },
//         });

//         // Return the client secret and payment intent ID wrapped in paymentIntent object
//         return sendResponse(res, true, 'Payment initiated successfully', {
//             paymentIntent
//         }, 200);
//     } catch (error) {
//         console.error('Error creating payment intent:', error);
//         return sendResponse(res, false, error.message || 'Failed to create payment intent', null, 500);
//     }
// };


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

            if (user) {
                const emailData = prepareEmailDataExp(
                    appointment,
                    barber,
                    salon,
                    appointmentWithServices.dataValues.Services,
                    tip,
                    appointmentData.tax || 0,
                    totalAmount
                );
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

        default:
            console.log(`Unhandled event type: ${event.type}`);
            return res.json({ received: true });
    }
};



// exports.handleWebhook = async (req, res) => {
//     const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

//     const sig = req.headers['stripe-signature'];

//     if (!sig) {
//         console.error('Missing stripe-signature header');
//         return res.status(400).send('Webhook Error: Missing stripe-signature header');
//     }

//     let event;

//     try {
//         console.log("Raw request body:", req.body);
//         // req.body is now a Buffer, exactly what Stripe needs
//         event = stripe.webhooks.constructEvent(
//             req.rawBody,
//             sig,
//             endpointSecret
//         );
//     } catch (err) {
//         console.error('Webhook signature verification failed:', err.message);
//         return res.status(400).send(`Webhook Error: ${err.message}`);
//     }

//     // Parse the raw body for our own use after verification
//     //const payload = JSON.parse(req.body.toString());

//     //console.log('Webhook event received:', payload);

//     // const event = req.body;

//     // Handle the event
//     switch (event.type) {
//         case 'payment_intent.succeeded': {
//             const paymentIntent = event.data.object;
//             console.log('PaymentIntent was successful:', paymentIntent);

//             // Extract metadata
//             const userId = paymentIntent.metadata.user_id;
//             const appointmentData = JSON.parse(paymentIntent.metadata.appointmentData);

            
//             const tip = parseFloat(paymentIntent.metadata.tip || 0);
//             const totalAmount = paymentIntent.amount / 100; // Convert cents to dollars
//             const currency = paymentIntent.currency.toUpperCase();

//             console.log('Extracted metadata:', {
//                 userId,
//                 appointmentData,
//                 tip,
//                 totalAmount,
//                 currency,
//             });

//             try {
//                 // Create an Appointment record in the database
//                 const cleanedAppointmentData = {
//                     appointment_date: appointmentData.appointment_date,
//                     appointment_end_time: appointmentData.appointment_end_time,
//                     appointment_start_time: appointmentData.appointment_start_time,
//                     BarberId: parseInt(appointmentData.BarberId),
//                     mobile_number: appointmentData.mobile_number,
//                     name: appointmentData.name,
//                     number_of_people: parseInt(appointmentData.number_of_people) || 1,
//                     SalonId: parseInt(appointmentData.SalonId),
//                     SlotId: parseInt(appointmentData.SlotId),
//                     service_ids: appointmentData.service_ids,
//                     // Set explicit null for optional fields instead of string "null"
//                     estimated_wait_time: appointmentData.estimated_wait_time === 'null' ? null : parseInt(appointmentData.estimated_wait_time),
//                     queue_position: appointmentData.queue_position === 'null' ? null : parseInt(appointmentData.queue_position),
//                     // Set payment related fields
//                     paymentMode: 'Pay_Online',
//                     status: 'appointment',
//                     paymentStatus: 'Success',
//                     stripePaymentIntentId: paymentIntent.id,
//                     UserId: parseInt(userId)
//                 };
        
//                 // Create appointment with cleaned data
//                 const appointment = await Appointment.create(cleanedAppointmentData);
        
//                 console.log('Appointment created successfully:', appointment);
        

//                 // Create a Payment record in the database
//                 const payment = await Payment.create({
//                     appointmentId: appointment.id, // Link the payment to the appointment
//                     UserId: userId,
//                     amount: totalAmount - tip, // Base amount (excluding tip)
//                     tip: tip,
//                     tax: appointmentData.tax || 0, // Optional tax from metadata
//                     discount: appointmentData.discount || 0, // Optional discount from metadata
//                     totalAmount: totalAmount, // Total amount paid
//                     currency: currency,
//                     paymentStatus: 'Success', // Mark as successful
//                     paymentIntentId: paymentIntent.id, // Store the Stripe PaymentIntent ID
//                     deviceId: appointmentData.deviceId || null,
//                     deviceType: appointmentData.deviceType || null,
//                     deviceModel: appointmentData.deviceModel || null,
//                     osVersion: appointmentData.osVersion || null,
//                     ipAddress: appointmentData.ipAddress || null,
//                     userAgent: appointmentData.userAgent || null,
//                     location: appointmentData.location || null,
//                     description: `Payment for appointment ID ${appointment.id}`,
//                     notes: appointmentData.notes || null,
//                     paymentInitiatedAt: paymentIntent.created ? new Date(paymentIntent.created * 1000) : null,
//                     paymentCompletedAt: new Date(), // Current timestamp
//                 });

//                  // Fetch additional required data for email
//                 const barber = await db.Barber.findByPk(appointmentData.BarberId);
//                 const salon = await db.Salon.findByPk(appointmentData.SalonId);

//                 // Fetch services data
//                 const services = await Service.findAll({ 
//                     where: { id: appointmentData.service_ids },
//                     attributes: ['id', 'name', 'min_price', 'max_price', 'default_service_time']
//                 });

//                  // Get user email
//                 const user = await db.USER.findOne({ 
//                     where: { id: userId },
//                     attributes: ['email'] 
//                 });

//                 if (!user) {
//                     console.error('User not found for email notification');
//                 } else {
//                     // Prepare email data
//                     const emailData = prepareEmailDataExp(
//                         appointment,
//                         barber,
//                         salon,
//                         services,
//                         tip,
//                         tax = appointmentData.tax || 0,
//                         totalAmount
//                     );

//                     // Send confirmation email
//                     await sendEmail(
//                         user.email,
//                         "Your Online Payment Appointment Booked Successfully",
//                         INVITE_BOOKING_APPOINTMENT_TEMPLATE_ID,
//                         emailData
//                     );
//                 }

//                 // Send notifications
//                 // await sendAppointmentNotifications(
//                 //     appointment, 
//                 //     appointmentData.name, 
//                 //     appointmentData.mobile_number, 
//                 //     userId, 
//                 //     appointmentData.SalonId
//                 // );

//                 console.log('Appointment and Payment records created successfully:', {
//                     appointment,
//                     payment,
//                 });

//                 // Send a success response to the client
//                 return sendResponse(res, true, 'Appointment and Payment created successfully', {
//                     appointment,
//                     payment,
//                 }, 200);

//             } catch (error) {
//                 console.error('Error saving Appointment or Payment to the database:', error.message);
//                 return res.status(500).send('Database Error: Failed to save Appointment or Payment');
//             }

//             break;
//         }

//         case 'payment_intent.payment_failed': {
//             const failedPaymentIntent = event.data.object;
//             console.error('PaymentIntent failed:', failedPaymentIntent);

//             // Handle the failed payment, e.g., notify the user or log the failure
//             break;
//         }

//         // Add more cases for other event types you want to handle
//         default:
//             console.log(`Unhandled event type: ${event.type}`);
//     }

//     // Return a response to acknowledge receipt of the event
//     res.json({ received: true });
// };




// Webhook Handler (Unchanged from your adjustments)


// exports.handleWebhook = async (req, res) => {
//     const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
//     const sig = req.headers['stripe-signature'];

//     if (!sig) {
//         console.error('Missing stripe-signature header');
//         return res.status(400).send('Webhook Error: Missing stripe-signature header');
//     }

//     let event;
//     try {
//         event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
//     } catch (err) {
//         console.error('Webhook signature verification failed:', err.message);
//         return res.status(400).send(`Webhook Error: ${err.message}`);
//     }

//     switch (event.type) {
//         case 'payment_intent.succeeded': {
//             const paymentIntent = event.data.object;
//             console.log('PaymentIntent was successful:', paymentIntent);

//             const userId = paymentIntent.metadata.user_id;
//             const appointmentData = JSON.parse(paymentIntent.metadata.appointmentData);
//             const tip = parseFloat(paymentIntent.metadata.tip || 0);
//             const totalAmount = paymentIntent.amount / 100; // Convert cents to dollars

//             // Create appointment
//             const cleanedAppointmentData = {
//                 ...appointmentData,
//                 paymentStatus: 'Success',
//                 paymentMode: PaymentMethodENUM.Pay_Online,
//                 stripePaymentIntentId: paymentIntent.id,
//             };

//             const appointment = await Appointment.create(cleanedAppointmentData);

//             // Create payment record
//             await Payment.create({
//                 appointmentId: appointment.id,
//                 UserId: userId,
//                 amount: totalAmount - tip - (appointmentData.tax || 0),
//                 tax: appointmentData.tax || 0,
//                 tip: tip,
//                 totalAmount: totalAmount,
//                 paymentStatus: 'Success',
//                 paymentIntentId: paymentIntent.id,
//                 paymentMethod: PaymentMethodENUM.Pay_Online,
//                 paymentCompletedAt: new Date(),
//             });

//             // Validate and attach services
//             await validateAndAttachServicesExp(appointment, appointmentData.service_ids, res);

//             // Fetch appointment with services
//             const appointmentWithServices = await fetchAppointmentWithServicesExp(appointment.id);

//             // Send email and notifications
//             const barber = await db.Barber.findByPk(appointmentData.BarberId);
//             const salon = await db.Salon.findByPk(appointmentData.SalonId);
//             const user = await db.USER.findOne({ where: { id: userId }, attributes: ['email'] });

//             if (user) {
//                 const emailData = prepareEmailDataExp(
//                     appointment,
//                     barber,
//                     salon,
//                     appointmentWithServices.dataValues.Services,
//                     tip,
//                     appointmentData.tax || 0,
//                     totalAmount
//                 );
//                 await sendEmail(
//                     user.email,
//                     "Your Online Payment Appointment Booked Successfully",
//                     INVITE_BOOKING_APPOINTMENT_TEMPLATE_ID,
//                     emailData
//                 );
//             }

//             await sendAppointmentNotificationsExp(appointment, appointmentData.name, appointmentData.mobile_number, userId, appointmentData.SalonId);

//             if (barber.category === BarberCategoryENUM.ForWalkIn) {
//                 const updatedAppointments = await getAppointmentsByRole(false);
//                 if (updatedAppointments) broadcastBoardUpdates(updatedAppointments);
//             }

//             return res.json({ received: true });
//         }

//         case 'payment_intent.payment_failed': {
//             console.error('PaymentIntent failed:', event.data.object);
//             return res.json({ received: true });
//         }

//         default:
//             console.log(`Unhandled event type: ${event.type}`);
//             return res.json({ received: true });
//     }
// };