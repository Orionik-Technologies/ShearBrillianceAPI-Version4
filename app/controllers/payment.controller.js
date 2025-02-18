const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Payment, Appointment } = require('../models'); // Adjust the path as necessary
const sendResponse = require('../helpers/responseHelper'); // Import the helper

// Function to create a payment intent
async function createPaymentIntent({ totalAmount, appointmentData, user_id, validatedTip }) {
    const totalAmountCents = Math.round(totalAmount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmountCents,
        currency: 'usd',
        metadata: {
            userId: user_id,
            tip: validatedTip,
            appointmentData: JSON.stringify(appointmentData),
        },
    });

    return paymentIntent;
}

// API to handle payment creation
exports.createPayment = async (req, res) => {
    try {
        const { totalAmount, appointmentData, user_id, validatedTip } = req.body;

        // Validate required fields
        if (!totalAmount || !appointmentData || !user_id) {
            return sendResponse(res, false, 'Missing required fields', null, 400);
        }

        // Generate payment intent
        const paymentIntent = await createPaymentIntent({
            totalAmount,
            appointmentData,
            user_id,
            validatedTip,
        });

        return sendResponse(res, true, 'Payment initiated. Complete payment to confirm.', { paymentIntent });
    } catch (error) {
        console.error("Error creating payment:", error);
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

// Helper function to handle successful payments
async function handlePaymentSuccess(paymentIntent) {
    try {
        // Extract metadata from the payment intent
        const { appointmentData, userId, tip } = paymentIntent.metadata;

        // Parse appointment data from metadata
        const parsedAppointmentData = JSON.parse(appointmentData);

        // Check if the appointment already exists
        let appointment = await Appointment.findOne({
            where: { id: parsedAppointmentData.id },
        });

        if (!appointment) {
            // If the appointment doesn't exist, create it
            appointment = await Appointment.create({
                ...parsedAppointmentData,
                paymentStatus: 'Success', // Mark payment as successful
            });

            console.log(`Appointment created for ID: ${appointment.id}`);
        } else {
            // Update the appointment's payment status
            await appointment.update({ paymentStatus: 'Success' });
        }

        // Calculate amounts from the payment intent
        const totalAmount = paymentIntent.amount / 100; // Convert cents to dollars
        const tax = parseFloat((totalAmount * 0.13).toFixed(2)); // Assuming tax is 13%
        const serviceTotal = totalAmount - tax - (tip || 0); // Calculate service total (excluding tax and tip)

        // Create the payment record in the database
        await Payment.create({
            appointmentId: appointment.id,
            userId: userId,
            amount: serviceTotal, // Service total (before tax and tip)
            tax: tax, // Tax amount
            tip: tip || 0, // Tip amount from metadata
            totalAmount: totalAmount, // Total amount (service total + tax + tip)
            currency: paymentIntent.currency.toUpperCase(),
            paymentStatus: 'Success',
            paymentMethod: 'Credit_Card',
            paymentIntentId: paymentIntent.id,
        });

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