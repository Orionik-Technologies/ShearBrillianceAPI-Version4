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
 * /api/sales/gettopBarber:
 *   get:
 *     summary: Retrieve top Barber by number of appointments(Only for admin user and manager)
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved top Barber
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
 *                   example: "Top Barber data retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       barberId:
 *                         type: integer
 *                         example: 101
 *                       appointmentsCount:
 *                         type: integer
 *                         example: 50
 *                       barberName:
 *                         type: string
 *                         example: "Virat Kohli"
 *                       salonName:
 *                         type: string
 *                         example: "India"
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
           app.get(`${apiPrefix}/gettopBarber`, [authenticateToken],authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER,roles.BARBER, roles.SALON_MANAGER), salesController.getTopBarbers);


                /**
 * @swagger
 * /api/sales/gettopSalon:
 *   get:
 *     summary: Retrieve top Salon by number of appointments(Only for admin user and manager)
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved top Salon
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
 *                   example: "Top Salon data retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       salonId:
 *                         type: integer
 *                         example: 101
 *                       appointmentsCount:
 *                         type: integer
 *                         example: 101
 *                       salonName:
 *                         type: string
 *                         example: "Salon"
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
      app.get(`${apiPrefix}/gettopSalon`, [authenticateToken],authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER,roles.BARBER, roles.SALON_MANAGER), salesController.getTopSalons);

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
 * /api/sales/report:
 *   get:
 *     summary: Generate and download a sales report
 *     description: Generates a sales report in PDF format based on a custom date range (startDate and endDate), optionally filtered by salonId and barberId. The report is formatted using HTML for a user-friendly layout and uploaded to DigitalOcean Spaces. It includes appointment counts, payment modes, and total payments, tailored to the user's role (Admin or Salon Manager).
 *     tags: [Sales]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-02-01"
 *         required: true
 *         description: Start date of the report in YYYY-MM-DD format (e.g., 2025-02-01). Must be a valid date and earlier than or equal to endDate.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-02-28"
 *         required: true
 *         description: End date of the report in YYYY-MM-DD format (e.g., 2025-02-28). Must be a valid date and later than or equal to startDate.
 *       - in: query
 *         name: salonId
 *         schema:
 *           type: string
 *           example: "1"
 *         required: false
 *         description: Optional Salon ID to filter the report by a specific salon. If omitted, includes all salons (Admin) or the user's salon (Salon Manager).
 *       - in: query
 *         name: barberId
 *         schema:
 *           type: string
 *           example: "5"
 *         required: false
 *         description: Optional Barber ID to filter the report by a specific barber. If omitted, includes all barbers for the selected salon(s).
 *     responses:
 *       200:
 *         description: Sales report generated and uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                   description: Indicates the operation was successful
 *                 message:
 *                   type: string
 *                   example: "Sales report with payment data generated and uploaded successfully"
 *                   description: A success message describing the outcome
 *                 data:
 *                   type: object
 *                   properties:
 *                     downloadUrl:
 *                       type: string
 *                       example: "https://your-space-name.s3.region.digitaloceanspaces.com/reports/sales_report_20250201_to_20250228_1698765432100.pdf"
 *                       description: Public URL to download the generated PDF report from DigitalOcean Spaces
 *       400:
 *         description: Bad request - Missing or invalid startDate/endDate
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
 *                   example: "startDate and endDate are required"
 *                   description: Error message indicating missing or invalid date parameters
 *       401:
 *         description: Unauthorized - No user ID found or invalid authentication
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
 *         description: Forbidden - User lacks necessary permissions or role not found
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
 *                   example: "Server Error"
 *                   description: Generic error message for unexpected server issues
 */
   app.get(`${apiPrefix}/report`, [authenticateToken],authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER,roles.BARBER, roles.SALON_MANAGER),salesController.generateSalesReport);
    
};
