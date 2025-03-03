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


    /**
     * @swagger
     * /api/sales/payment:
     *   get:
     *     summary: Retrieve total sales filtered by date range
     *     description: Fetch total successful payments and categorize them by online and offline payments. Supports filtering by today, last 7 days, and last 30 days.
     *     tags:
     *       - Sales
     *     parameters:
     *       - in: query
     *         name: filter
     *         schema:
     *           type: string
     *           enum: [today, 7days, 30days]
     *         description: Filter by date range (today, last 7 days, or last 30 days)
     *     responses:
     *       200:
     *         description: Sales data retrieved successfully
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
     *                   type: object
     *                   properties:
     *                     online:
     *                       type: number
     *                       example: 3000.00
     *                     offline:
     *                       type: number
     *                       example: 2000.00
     *                     total:
     *                       type: number
     *                       example: 5000.00
     *                 code:
     *                   type: integer
     *                   example: 200
     *       400:
     *         description: Invalid filter parameter
     *       500:
     *         description: Error fetching sales data
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
     *                   example: "Error fetching sales data"
     *                 error:
     *                   type: string
     *                   example: "Database connection error"
     *                 code:
     *                   type: integer
     *                   example: 500
     */

      app.get(`${apiPrefix}/payment`, [authenticateToken],authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER,roles.BARBER, roles.SALON_MANAGER),salesController.getPaymentData);

   /**
 * @swagger
 * /api/sales/data:
 *   get:
 *     summary: Retrieve sales data
 *     description: Retrieves raw sales and payment data based on a custom date range specified by startDate and endDate.
 *     tags: [Sales]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-02-01"
 *         required: true
 *         description: Start date of the data range (YYYY-MM-DD).
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-02-28"
 *         required: true
 *         description: End date of the data range (YYYY-MM-DD).
 *     responses:
 *       200:
 *         description: Sales data retrieved successfully
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
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: object
 *                       properties:
 *                         startDate:
 *                           type: string
 *                           format: date
 *                           example: "2025-02-01"
 *                         endDate:
 *                           type: string
 *                           format: date
 *                           example: "2025-02-28"
 *                         timezone:
 *                           type: string
 *                           example: "Asia/Kolkata"
 *                     salons:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           name:
 *                             type: string
 *                             example: "Salon A"
 *                     salesData:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           salonId:
 *                             type: integer
 *                             example: 1
 *                           salonName:
 *                             type: string
 *                             example: "Salon A"
 *                           date:
 *                             type: string
 *                             format: date
 *                             example: "2025-02-01"
 *                           appointments:
 *                             type: integer
 *                             example: 5
 *                           revenue:
 *                             type: number
 *                             example: 250.00
 *                           paymentMode:
 *                             type: string
 *                             enum: ["Online", "Offline", "N/A"]
 *                             example: "Online"
 *                     paymentData:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                             example: "2025-02-01"
 *                           totalPayment:
 *                             type: string
 *                             example: "250.00"
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-03-02 14:30:45"
 *       400:
 *         description: Missing or invalid startDate/endDate
 *       401:
 *         description: Unauthorized user
 *       403:
 *         description: Forbidden - User lacks necessary permissions
 *       500:
 *         description: Server error
 */
      app.get(`${apiPrefix}/data`, [authenticateToken],authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER,roles.BARBER, roles.SALON_MANAGER),salesController.shareSalesData);
    
};
