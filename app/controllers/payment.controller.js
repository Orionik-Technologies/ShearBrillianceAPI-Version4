const db = require("../models");
const { Payment, Appointment, Service } = require('../models'); // Adjust the path as necessary
const sendResponse = require('../helpers/responseHelper');  // Import the helper
const { PaymentMethodENUM } = require("../config/paymentEnums.config");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);



exports.createPayment = async (req, res) => {
    try {
        const { appointmentId, paymentMethod, tip } = req.body;

        // Fetch the appointment
        const appointment = await Appointment.findByPk(appointmentId, {
            include: [Service],
        });

        if (!appointment) {
            return sendResponse(res, false, 'Appointment not found', null, 404);
        }

        // Validate services and min_price
        const services = appointment.Services || [];
        const totalServiceCost = services.reduce((sum, service) => {
            return sum + (service.min_price ? Number(service.min_price) : 0);
        }, 0);

        // Ensure totalServiceCost is a valid number
        if (isNaN(totalServiceCost) || totalServiceCost <= 0) {
            return sendResponse(res, false, 'Invalid service prices', null, 400);
        }

        // Calculate tax (13% of service total)
        const tax = parseFloat((totalServiceCost * 0.13).toFixed(2));

        // Validate tip and ensure it's a number
        const validatedTip = isNaN(tip) ? 0 : Number(tip);

        // Calculate total amount (service total + tax + tip)
        const totalAmount = parseFloat((totalServiceCost + tax + validatedTip).toFixed(2));

        // Ensure totalAmount is a valid integer in cents
        const totalAmountCents = Math.round(totalAmount * 100);
        if (isNaN(totalAmountCents) || totalAmountCents <= 0) {
            return sendResponse(res, false, 'Invalid total amount', null, 400);
        }

        if (paymentMethod === PaymentMethodENUM.Pay_Online) {
            // Create Stripe Payment Intent
            const paymentIntent = await stripe.paymentIntents.create({
                amount: totalAmountCents, // Stripe expects amount in cents
                currency: 'usd',
                metadata: {
                    appointmentId: appointment.id,
                    userId: appointment.UserId,
                    tip: validatedTip, // Include tip in metadata

                },
            });

           
            return sendResponse(res, true, 'Payment initiated. Complete payment to confirm.', {
                paymentIntent
            });
        } 

        return sendResponse(res, false, 'Invalid payment method', null, 400);
    } catch (error) {
        console.error('Error creating payment:', error);
        return sendResponse(res, false, error.message || 'Internal Server Error', null, 500);
    }
};


exports.handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Verify the webhook signature
        event = stripe.webhooks.constructEvent(
            req.rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle successful payment
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;

        try {
            // Extract metadata from the payment intent
            const { appointmentId, userId } = paymentIntent.metadata;

            // Fetch the appointment to ensure it exists
            const appointment = await Appointment.findByPk(appointmentId);
            if (!appointment) {
                console.error(`Appointment not found for ID: ${appointmentId}`);
                return res.status(404).send('Appointment not found');
            }

            // Calculate amounts from the payment intent
            const totalAmount = paymentIntent.amount / 100; // Convert cents to dollars
            const tax = parseFloat((totalAmount * 0.13).toFixed(2)); // Assuming tax is 13%
            const serviceTotal = totalAmount - tax; // Calculate service total (excluding tax and tip)

            // Create the payment record in the database
            await Payment.create({
                appointmentId: appointmentId,
                userId: userId,
                amount: serviceTotal, // Service total (before tax and tip)
                tax: tax, // Tax amount
                tip: paymentIntent.metadata.tip || 0, // Tip amount from metadata
                totalAmount: totalAmount, // Total amount (service total + tax + tip)
                currency: paymentIntent.currency.toUpperCase(),
                paymentStatus: 'Success',
                paymentMethod: 'Credit_Card',
                paymentIntentId: paymentIntent.id,
            });

            // Optionally, update the appointment's payment status
            await Appointment.update(
                { paymentStatus: 'Success' },
                { where: { id: appointmentId } }
            );

            console.log(`Payment record created for appointment ID: ${appointmentId}`);
        } catch (err) {
            console.error('Error handling successful payment:', err.message);
            return res.status(500).send('Internal Server Error');
        }
    }

    // Handle failed payment
    if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object;

        try {
            // Update the payment record with failure status and reason
            await Payment.update(
                {
                    paymentStatus: 'Failed',
                    failureReason: paymentIntent.last_payment_error?.message || 'Unknown error',
                },
                { where: { paymentIntentId: paymentIntent.id } }
            );

            console.log(`Payment failed for intent ID: ${paymentIntent.id}`);
        } catch (err) {
            console.error('Error handling failed payment:', err.message);
            return res.status(500).send('Internal Server Error');
        }
    }

    // Respond to Stripe to acknowledge receipt of the event
    res.json({ received: true });
};