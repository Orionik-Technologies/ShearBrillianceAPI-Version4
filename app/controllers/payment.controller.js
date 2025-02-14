const db = require("../models");
const Appointment = db.Appointment;
const Service = db.Service;
const Payment = db.Payment;
const sendResponse = require('../helpers/responseHelper');  // Import the helper
const { PaymentMethodENUM } = require("../config/paymentEnums.config");



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
  
      // Calculate total service cost
      const services = appointment.Services;
      const totalServiceCost = services.reduce((sum, service) => {
        return sum + service.min_price; // Use min_price for calculation
      }, 0);
  
      // Calculate tax (13% of service total)
      const tax = totalServiceCost * 0.13;
  
      // Calculate total amount (service total + tax + tip)
      const totalAmount = totalServiceCost + tax + (tip || 0);
  
      if (paymentMethod === PaymentMethodENUM.Pay_Online) {
        // Create Stripe Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: totalAmount * 100, // Stripe expects amount in cents
          currency: 'usd',
          metadata: {
            appointmentId: appointment.id,
            userId: appointment.UserId,
          },
        });
  
        // Create payment record
        const payment = await Payment.create({
          appointmentId: appointment.id,
          userId: appointment.UserId,
          amount: totalServiceCost, // Service total (before tax and tip)
          tax: tax, // Tax amount
          tip: tip || 0, // Tip amount
          totalAmount: totalAmount, // Total amount (service total + tax + tip)
          currency: 'USD',
          paymentStatus: 'Pending',
          paymentMethod: 'Credit_Card',
          paymentIntentId: paymentIntent.id,
        });
  
        return sendResponse(res, true, 'Payment initiated. Complete payment to confirm.', {
          payment,
          clientSecret: paymentIntent.client_secret,
        });
      } else if (paymentMethod === PaymentMethodENUM.Pay_in_Person) {
        // Create payment record for in-salon payment
        const payment = await Payment.create({
          appointmentId: appointment.id,
          userId: appointment.UserId,
          amount: totalServiceCost, // Service total (before tax and tip)
          tax: tax, // Tax amount
          tip: tip || 0, // Tip amount
          totalAmount: totalAmount, // Total amount (service total + tax + tip)
          currency: 'USD',
          paymentStatus: 'Pending', // Payment will be completed in the salon
          paymentMethod: 'Cash', // Assuming in-salon payment is cash
        });
  
        return sendResponse(res, true, 'Payment record created. Please pay in the salon.', payment, 201);
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
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  
    // Handle successful payment
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      await db.Payment.update(
        { paymentStatus: 'Success' },
        { where: { paymentIntentId: paymentIntent.id } }
      );
      await db.Appointment.update(
        { paymentStatus: 'Success' },
        { where: { id: paymentIntent.metadata.appointmentId } }
      );
    }
  
    // Handle failed payment
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      await db.Payment.update(
        { 
          paymentStatus: 'Failed',
          failureReason: paymentIntent.last_payment_error?.message 
        },
        { where: { paymentIntentId: paymentIntent.id } }
      );
    }
  
    res.json({ received: true });
  };