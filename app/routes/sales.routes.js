// routes/dashboard.routes.js
const express = require('express');
const path = require('path');
const salesController = require('../controllers/sales.controller');
const { authenticateToken } = require('../middleware/authenticate.middleware'); // Adjust the path as needed
const { authenticateJWT, authorizeRoles } = require('../middleware/auth.middleware');
const { role } = require('../config/roles.config');
const roles = require('../config/roles.config').role;

module.exports = app => {
    const apiPrefix = "/api/sales";

    /**
    * @swagger
    * tags:
    *   name: Sales
    *   description: API for managing Sales  
    */


    /**
 * @swagger
 * /api/sales/getAppointmentSalesData:
 *   get:
 *     summary: Retrieve sales data for completed appointments within a specified date range
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         required: true
 *         schema:
 *           type: string
 *           enum: [last_7_days, last_30_days]
 *         description: Filter to specify the date range for sales data (e.g., 'last_7_days', 'last_30_days').
 *     responses:
 *       200:
 *         description: Successfully retrieved sales data.
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
 *                   example: "Sales data retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                         example: "2024-12-20"
 *                       appointments:
 *                         type: integer
 *                         example: 5
 *                       revenue:
 *                         type: number
 *                         format: float
 *                         example: 1200.50
 *       400:
 *         description: Invalid filter specified.
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
 *                   example: "Invalid filter"
 *       401:
 *         description: Unauthorized access due to missing or invalid token.
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
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden access for unauthorized roles.
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
 *                   example: "Forbidden"
 *       500:
 *         description: Server error.
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
 *                   example: "Server Error"
 */
 app.get(`${apiPrefix}/getAppointmentSalesData`, [authenticateToken],authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER,roles.BARBER, roles.SALON_MANAGER), salesController.getAppointmentSalesData);
    

          /**
 * @swagger
 * /api/sales/getWalkInSalesData:
 *   get:
 *     summary: Retrieve sales data for completed appointments within a specified date range
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         required: true
 *         schema:
 *           type: string
 *           enum: [last_7_days, last_30_days]
 *         description: Filter to specify the date range for sales data (e.g., 'last_7_days', 'last_30_days').
 *     responses:
 *       200:
 *         description: Successfully retrieved sales data.
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
 *                   example: "Sales data retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                         example: "2024-12-20"
 *                       appointments:
 *                         type: integer
 *                         example: 5
 *                       revenue:
 *                         type: number
 *                         format: float
 *                         example: 1200.50
 *       400:
 *         description: Invalid filter specified.
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
 *                   example: "Invalid filter"
 *       401:
 *         description: Unauthorized access due to missing or invalid token.
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
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden access for unauthorized roles.
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
 *                   example: "Forbidden"
 *       500:
 *         description: Server error.
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
 *                   example: "Server Error"
 */

          app.get(`${apiPrefix}/getWalkInSalesData`, [authenticateToken],authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER,roles.BARBER, roles.SALON_MANAGER), salesController.getWalkInSalesData);
    


      /**
 * @swagger
 * /api/sales/gettopService:
 *   get:
 *     summary: Retrieve top services by number of appointments(Only for admin user and manager)
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved top services
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
 *                   example: "Top services data retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       serviceId:
 *                         type: integer
 *                         example: 101
 *                       usageCount:
 *                         type: integer
 *                         example: 50
 *                       serviceName:
 *                         type: string
 *                         example: "Haircut"
 *                       serviceDescription:
 *                         type: string
 *                         example: "Professional haircut service"
 *                       servicePrice:
 *                         type: number
 *                         format: float
 *                         example: 15.99
 *                       serviceisActive:
 *                         type: boolean
 *                         example: true
 *       401:
 *         description: Unauthorized - Missing or invalid token
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
 *                   example: "Unauthorized: No user ID found"
 *                 code:
 *                   type: integer
 *                   example: 401
 *       403:
 *         description: Forbidden - Unauthorized user role
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
 *                   example: "Unauthorized User"
 *       500:
 *         description: Internal Server Error
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
 *                   example: "Server Error"
 */
      app.get(`${apiPrefix}/gettopService`, [authenticateToken],authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER,roles.BARBER, roles.SALON_MANAGER), salesController.gettopService);
    
};
