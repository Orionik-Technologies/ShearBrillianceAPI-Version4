const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sendResponse = require('../helpers/responseHelper'); // Import the helper function
const db = require("../models");
const { PaymentMethodENUM } = require('../config/paymentEnums.config');
const { Payment, Appointment } = require('../models'); // Adjust path as needed



// API to handle payment creation
exports.createPayment = async (req, res) => {
    try {
        const { totalAmount, appointmentData, user_id, validatedTip } = req.body;
        
        // Convert amount to cents (Stripe expects amounts in smallest currency unit)
        const amountInCents = Math.round((totalAmount + validatedTip) * 100);
        
        // Create a Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: 'usd',
          metadata: {
            user_id: user_id.toString(),
            appointment_id: appointmentData.UserId.toString(),
            barber_id: appointmentData.BarberId.toString(),
            salon_id: appointmentData.SalonId.toString(),
            tip_amount: validatedTip.toString(),
            appointment_status: appointmentData.status
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
        res.status(500).json({ 
          error: 'Failed to create payment intent',
          message: error.message 
        });
      }
};

exports.testWebhook = async (req, res) => {
    try {
        const event = req.body; // Directly use the request body for testing

        // Handle different event types
        switch (event.type) {
            case 'payment_intent.succeeded':
                await handlePaymentSuccess(event.data.object);
                break;

            case 'payment_intent.payment_failed':
                await handlePaymentFailure(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        // Respond to acknowledge receipt of the event
        res.json({ received: true });
    } catch (err) {
        console.error('Error processing webhook:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
};


// Helper function to handle successful payments
async function handlePaymentSuccess(paymentIntent) {
    try {
        // Extract metadata from the payment intent
        const { appointmentData, userId, tip } = paymentIntent.metadata;

        // Parse appointment data from metadata
        const parsedAppointmentData = JSON.parse(appointmentData);

        // Directly create the appointment
        const appointment = await Appointment.create({
            ...parsedAppointmentData,
            paymentStatus: 'Success', // Mark payment as successful
        });

        console.log(`Appointment created for ID: ${appointment.id}`);

        // Calculate amounts from the payment intent
        const totalAmount = paymentIntent.amount / 100; // Convert cents to dollars
        const tax = parseFloat((totalAmount * 0.13).toFixed(2)); // Assuming tax is 13%
        const serviceTotal = totalAmount - tax - (tip || 0); // Calculate service total (excluding tax and tip)

        // Create payment record
        try {
            const payment = await Payment.create({
                appointmentId: appointment.id,
                UserId: userId,
                amount: serviceTotal,
                tax: tax,
                tip: tip || 0,
                totalAmount: totalAmount,
                currency: paymentIntent.currency.toUpperCase(),
                paymentStatus: 'Success',
                paymentIntentId: paymentIntent.id,
            });
            console.log("Payment created successfully:", payment);
        } catch (err) {
            console.error("Error creating payment:", err);
            throw new Error("Error creating payment record");
        }

        console.log(`Payment record created for appointment ID: ${appointment.id}`);
    } catch (err) {
        console.error('Error handling successful payment:', err.message);
        throw new Error('Error processing successful payment');
    }
}

// Helper function to handle failed payments
async function handlePaymentFailure(paymentIntent) {
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
        throw new Error('Error processing failed payment');
    }
}

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

    // Handle different event types
    switch (event.type) {
        case 'payment_intent.succeeded':
            await handlePaymentSuccess(event.data.object);
            break;

        case 'payment_intent.payment_failed':
            await handlePaymentFailure(event.data.object);
            break;

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    // Respond to Stripe to acknowledge receipt of the event
    res.json({ received: true });
};
