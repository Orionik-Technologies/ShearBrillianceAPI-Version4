const express = require("express");
const bodyParser = require("body-parser");
const paymentController = require("../controllers/payment.controller");

module.exports = (app) => {
  const apiPrefix = "/api/payment";

  // JSON parsing for all routes except webhooks
  app.use(express.json());

  /**
   * @swagger
   * /api/payment/create:
   *   post:
   *     summary: Create a new payment intent
   *     description: Initiates a Stripe payment intent for online payments
   *     tags:
   *       - Payments
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - totalAmount
   *               - appointmentData
   *               - user_id
   *               - validatedTip
   *             properties:
   *               totalAmount:
   *                 type: number
   *                 description: Total payment amount
   *                 example: 13.8
   *               appointmentData:
   *                 type: object
   *                 description: Appointment details
   *                 required:
   *                   - UserId
   *                   - BarberId
   *                   - SalonId
   *                   - status
   *                 properties:
   *                   UserId:
   *                     type: integer
   *                     example: 359
   *                   BarberId:
   *                     type: integer
   *                     example: 151
   *                   SalonId:
   *                     type: integer
   *                     example: 12
   *                   SlotId:
   *                     type: integer
   *                     example: 45
   *                   number_of_people:
   *                     type: integer
   *                     example: 2
   *                   status:
   *                     type: string
   *                     example: "Pending"
   *                   appointment_date:
   *                     type: string
   *                     format: date
   *                     example: "2025-02-20"
   *                   appointment_start_time:
   *                     type: string
   *                     example: "10:00 AM"
   *                   appointment_end_time:
   *                     type: string
   *                     example: "11:00 AM"
   *                   tax:
   *                     type: number
   *                     example: 1.8
   *                   discount:
   *                     type: number
   *                     example: 0
   *                   deviceId:
   *                     type: string
   *                     example: "abc123"
   *                   deviceType:
   *                     type: string
   *                     example: "iOS"
   *                   deviceModel:
   *                     type: string
   *                     example: "iPhone 14"
   *                   osVersion:
   *                     type: string
   *                     example: "16.3"
   *                   ipAddress:
   *                     type: string
   *                     example: "192.168.1.1"
   *                   userAgent:
   *                     type: string
   *                     example: "Mozilla/5.0"
   *                   location:
   *                     type: string
   *                     example: "New York, USA"
   *                   notes:
   *                     type: string
   *                     example: "Customer prefers a quiet environment"
   *               user_id:
   *                 type: integer
   *                 description: ID of the user making the payment
   *                 example: 359
   *               validatedTip:
   *                 type: number
   *                 description: Validated tip amount
   *                 example: 2.5
   *     responses:
   *       200:
   *         description: Payment intent created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Payment initiated successfully"
   *                 data:
   *                   type: object
   *                   properties:
   *                     paymentIntent:
   *                       type: object
   *                       properties:
   *                         id:
   *                           type: string
   *                           example: "pi_1234567890"
   *                         client_secret:
   *                           type: string
   *                           example: "pi_1234567890_secret_1234567890"
   *                         amount:
   *                           type: integer
   *                           example: 1630
   *                         currency:
   *                           type: string
   *                           example: "usd"
   *                         metadata:
   *                           type: object
   *                           properties:
   *                             user_id:
   *                               type: string
   *                               example: "359"
   *                             appointment_id:
   *                               type: string
   *                               example: "359"
   *                             barber_id:
   *                               type: string
   *                               example: "151"
   *                             salon_id:
   *                               type: string
   *                               example: "12"
   *                             tip_amount:
   *                               type: string
   *                               example: "2.5"
   *                             appointment_status:
   *                               type: string
   *                               example: "Pending"
   *       400:
   *         description: Bad request - Missing or invalid required fields
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: "Failed to create payment intent"
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: "Failed to create payment intent"
   */

  app.post(`${apiPrefix}/create`, paymentController.createPayment);

  /**
   * @swagger
   * /api/payment/webhook:
   *   post:
   *     summary: Handle Stripe webhook events
   *     description: Processes Stripe webhook events for payment success and failure. Handles appointment creation/updates and payment records.
   *     tags:
   *       - Payments
   *     headers:
   *       stripe-signature:
   *         type: string
   *         required: true
   *         description: Stripe signature for webhook verification
   *         example: "t=123456789,v1=abcdef123456,v0=abcdef789012"
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               type:
   *                 type: string
   *                 enum: [payment_intent.succeeded, payment_intent.payment_failed]
   *                 description: Type of Stripe event
   *               data:
   *                 type: object
   *                 properties:
   *                   object:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: Payment intent ID
   *                       metadata:
   *                         type: object
   *                         properties:
   *                           appointmentData:
   *                             type: string
   *                             description: JSON string of appointment details
   *                           userId:
   *                             type: string
   *                             description: User ID
   *                           tip:
   *                             type: string
   *                             description: Tip amount
   *                       amount:
   *                         type: integer
   *                         description: Amount in cents
   *                       currency:
   *                         type: string
   *                         description: Currency code
   *                       last_payment_error:
   *                         type: object
   *                         properties:
   *                           message:
   *                             type: string
   *                             description: Error message for failed payments
   *     responses:
   *       200:
   *         description: Webhook processed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 received:
   *                   type: boolean
   *                   example: true
   *       400:
   *         description: Invalid webhook signature or processing error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Webhook Error: Invalid signature"
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Database Error: Failed to save Appointment or Payment"
   */
  app.post(
    `${apiPrefix}/webhook`,
    express.raw({ type: 'application/json' }), // Ensures raw body for Stripe signature verification
    paymentController.handleWebhook
  );

  // All other routes should use JSON parsing


  app.post(`${apiPrefix}/refund`, paymentController.refundPayment);
};