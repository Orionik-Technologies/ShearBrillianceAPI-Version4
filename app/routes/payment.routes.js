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
   *     summary: Create a new payment
   *     description: Initiates a payment for an appointment, either online or in-person. Calculates tax (13%) on the service total and includes optional tip.
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
   *               - appointmentId
   *               - paymentMethod
   *             properties:
   *               appointmentId:
   *                 type: integer
   *                 description: ID of the appointment
   *                 example: 123
   *               paymentMethod:
   *                 type: string
   *                 enum: [Pay_Online, Pay_in_Person]
   *                 description: Payment method chosen by the user
   *                 example: Pay_Online
   *               tip:
   *                 type: number
   *                 description: Optional tip amount
   *                 example: 10.00
   *     responses:
   *       200:
   *         description: Payment initiated successfully
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
   *                   example: Payment initiated. Complete payment to confirm.
   *                 data:
   *                   type: object
   *                   properties:
   *                     payment:
   *                       type: object
   *                       description: Payment record details
   *                       properties:
   *                         id:
   *                           type: integer
   *                           example: 1
   *                         appointmentId:
   *                           type: integer
   *                           example: 123
   *                         userId:
   *                           type: integer
   *                           example: 456
   *                         amount:
   *                           type: number
   *                           example: 100.00
   *                         tax:
   *                           type: number
   *                           example: 13.00
   *                         tip:
   *                           type: number
   *                           example: 10.00
   *                         totalAmount:
   *                           type: number
   *                           example: 123.00
   *                         currency:
   *                           type: string
   *                           example: USD
   *                         paymentStatus:
   *                           type: string
   *                           example: Pending
   *                         paymentMethod:
   *                           type: string
   *                           example: Credit_Card
   *                         paymentIntentId:
   *                           type: string
   *                           example: pi_1234567890
   *                     clientSecret:
   *                       type: string
   *                       description: Stripe client secret for online payments
   *                       example: sk_test_1234567890
   *       201:
   *         description: Payment record created for in-salon payment
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
   *                   example: Payment record created. Please pay in the salon.
   *                 data:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: integer
   *                       example: 1
   *                     appointmentId:
   *                       type: integer
   *                       example: 123
   *                     userId:
   *                       type: integer
   *                       example: 456
   *                     amount:
   *                       type: number
   *                       example: 100.00
   *                     tax:
   *                       type: number
   *                       example: 13.00
   *                     tip:
   *                       type: number
   *                       example: 10.00
   *                     totalAmount:
   *                       type: number
   *                       example: 123.00
   *                     currency:
   *                       type: string
   *                       example: USD
   *                     paymentStatus:
   *                       type: string
   *                       example: Pending
   *                     paymentMethod:
   *                       type: string
   *                       example: Cash
   *       400:
   *         description: Invalid payment method
   *       404:
   *         description: Appointment not found
   *       500:
   *         description: Internal server error
   */
  app.post(`${apiPrefix}/create`,  paymentController.createPayment);

  /**
   * @swagger
   * /api/payment/webhook:
   *   post:
   *     summary: Stripe webhook for payment events
   *     description: Handles Stripe webhook events for payment success or failure.
   *     tags:
   *       - Payments
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: Stripe webhook payload
   *     responses:
   *       200:
   *         description: Webhook event processed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 received:
   *                   type: boolean
   *                   example: true
   *       400:
   *         description: Invalid webhook signature
   */
  app.post(`${apiPrefix}/webhook`, express.raw({ type: 'application/json' }), paymentController.handleWebhook);
};