const express = require("express");
const db = require("../models");
const { Op } = require("sequelize");
const configController = require("../controllers/configurations.controller");

module.exports = app => {
    const apiPrefix = "/api/configurations";

    /**
     * @swagger
     * /api/configurations/get-payment-config:
     *   get:
     *     summary: Get payment configuration
     *     description: Retrieve the online payment configuration status.
     *     tags:
     *       - Configuration
     *     responses:
     *       200:
     *         description: Payment configuration retrieved successfully.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 message:
     *                   type: string
     *                 data:
     *                   type: object
     *                   properties:
     *                     enableOnlinePayment:
     *                       type: boolean
     *                       example: true
     *       500:
     *         description: Failed to retrieve payment configuration.
     */
    app.get(`${apiPrefix}/get-payment-config`, configController.getPaymentConfig);

    /**
     * @swagger
     * /api/configurations/put-payment-config:
     *   put:
     *     summary: Update payment configuration
     *     description: Enable or disable online payment functionality.
     *     tags:
     *       - Configuration
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               enableOnlinePayment:
     *                 type: boolean
     *                 example: true
     *     responses:
     *       200:
     *         description: Payment configuration updated successfully.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 message:
     *                   type: string
     *                 data:
     *                   type: object
     *                   properties:
     *                     enableOnlinePayment:
     *                       type: boolean
     *                       example: true
     *       400:
     *         description: Invalid request body (must be a boolean).
     *       500:
     *         description: Failed to update payment configuration.
     */

    app.put(`${apiPrefix}/put-payment-config`, configController.updatePaymentConfig);
};