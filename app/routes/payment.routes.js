const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");
const { authenticateJWT } = require('../middleware/auth.middleware'); // Assuming JWT authentication middleware

module.exports = (app) => {
  const apiPrefix = "/api/payment";

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
   *                   status:
   *                     type: string
   *                     example: "Pending"
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
   *     x-codeSamples:
   *       - lang: JavaScript
   *         source: |
   *           // Success case creates/updates:
   *           // 1. Appointment record with status 'Success'
   *           // 2. Payment record with calculated amounts:
   *           //    - Total amount (converted from cents)
   *           //    - Tax (13%)
   *           //    - Service total
   *           //    - Tip from metadata
   *           
   *           // Failure case updates:
   *           // 1. Payment record with status 'Failed'
   *           // 2. Includes failure reason from payment intent
   * 
   * components:
   *   schemas:
   *     PaymentRecord:
   *       type: object
   *       properties:
   *         appointmentId:
   *           type: integer
   *           description: ID of the associated appointment
   *         userId:
   *           type: integer
   *           description: ID of the user making the payment
   *         amount:
   *           type: number
   *           description: Service total (before tax and tip)
   *         tax:
   *           type: number
   *           description: Tax amount (13% of service total)
   *         tip:
   *           type: number
   *           description: Tip amount
   *         totalAmount:
   *           type: number
   *           description: Total amount (service total + tax + tip)
   *         currency:
   *           type: string
   *           description: Payment currency (uppercase)
   *         paymentStatus:
   *           type: string
   *           enum: [Success, Failed]
   *           description: Status of the payment
   *         paymentMethod:
   *           type: string
   *           enum: [Credit_Card]
   *           description: Method of payment
   *         paymentIntentId:
   *           type: string
   *           description: Stripe payment intent ID
   *         failureReason:
   *           type: string
   *           description: Reason for payment failure (if applicable)
   */
  app.post(`${apiPrefix}/webhook`, express.raw({ type: 'application/json' }), paymentController.handleWebhook);

  /**
   * @swagger
   * paths:
   *   /api/payment/testwebhook:
   *     post:
   *       summary: Simulate Stripe Webhook
   *       description: Simulates a Stripe webhook event for testing purposes.
   *       tags:
   *         - Payments
   *       requestBody:
   *         required: true
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   example: evt_12345
   *                 type:
   *                   type: string
   *                   example: payment_intent.succeeded
   *                 data:
   *                   type: object
   *                   properties:
   *                     object:
   *                       type: object
   *                       example:
   *                         id: "pi_12345"
   *                         amount: 5000
   *                         currency: "usd"
   *                         metadata:
   *                           userId: "123"
   *                           tip: "5"
   *                           appointmentData: '{"id":1,"name":"John Doe"}'
   *       responses:
   *         200:
   *           description: Webhook processed successfully
   *           content:
   *             application/json:
   *               schema:
   *                 type: object
   *                 properties:
   *                   received:
   *                     type: boolean
   *                     example: true
   *         400:
   *           description: Webhook Error
   */
  app.post(`${apiPrefix}/testwebhook`, express.raw({ type: 'application/json' }), paymentController.testWebhook);



  
};