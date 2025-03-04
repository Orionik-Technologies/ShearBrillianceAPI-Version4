// routes/dashboard.routes.js
const express = require('express');
const path = require('path');
const dashboardController = require('../controllers/dashboard.controller');
const { authenticateToken } = require('../middleware/authenticate.middleware'); // Adjust the path as needed
const { authenticateJWT, authorizeRoles } = require('../middleware/auth.middleware');
const { role } = require('../config/roles.config');
const roles = require('../config/roles.config').role;

module.exports = app => {
  const apiPrefix = "/api/dashboard";

  /**
  * @swagger
  * tags:
  *   name: Dashboard
  *   description: API for managing Dashboard  
  */


  /**
   * @swagger
   * components:
   *   schemas:
   *     DashboardData:
   *       type: object
   *       required:
   *         - totalUsers
   *         - totalCustomers
   *         - totalSalons
   *         - totalAppointments
   *         - activeAppointmentsCount
   *         - completedAppointmentsCount
   *         - canceledAppointmentsCount
   *       properties:
   *         totalUsers:
   *           type: integer
   *           description: Total number of users
   *         totalCustomers:
   *           type: integer
   *           description: Total number of customers
   *         totalSalons:
   *           type: integer
   *           description: Total number of salons
   *         totalAppointments:
   *           type: integer
   *           description: Total number of appointments
   *         activeAppointmentsCount:
   *           type: integer
   *           description: Count of active appointments
   *         completedAppointmentsCount:
   *           type: integer
   *           description: Count of completed appointments
   *         canceledAppointmentsCount:
   *           type: integer
   *           description: Count of canceled appointments
   *       example:
   *         totalUsers: 100
   *         totalCustomers: 80
   *         totalSalons: 5
   *         totalAppointments: 200
   *         activeAppointmentsCount: 50
   *         completedAppointmentsCount: 120
   *         canceledAppointmentsCount: 30
   */

  /**
   * @swagger
   * /api/dashboard:
   *   get:
   *     summary: Retrieve the admin dashboard data
   *     tags: [Dashboard]
   *     responses:
   *       200:
   *         description: Dashboard data for the admin
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/DashboardData'
   *       403:
   *         description: Unauthorized access
   *       500:
   *         description: Server error
   */
  // Route to fetch admin dashboard data
  app.get(`${apiPrefix}`, [authenticateToken], authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER, roles.BARBER, roles.SALON_MANAGER), dashboardController.getDashboardData);


  /**
* @swagger
* components:
*   schemas:
*     AppointmentDashboardData:
*       type: object
*       required:
*         - totalAppointments
*         - activeAppointments
*         - completedAppointments
*         - canceledAppointments
*         - estimatedWaitTimes
*       properties:
*         totalAppointments:
*           type: integer
*           description: Total number of appointments
*         activeAppointments:
*           type: integer
*           description: Count of active appointments
*         completedAppointments:
*           type: integer
*           description: Count of completed appointments
*         canceledAppointments:
*           type: integer
*           description: Count of canceled appointments
*         estimatedWaitTimes:
*           type: array
*           items:
*             type: object
*             properties:
*               salonId:
*                 type: integer
*                 description: ID of the salon
*               waitTime:
*                 type: string
*                 description: Estimated wait time for the salon
*       example:
*         totalAppointments: 200
*         activeAppointments: 50
*         completedAppointments: 120
*         canceledAppointments: 30

*/

  /**
  * @swagger
  * /api/dashboard/appointment-dashboard:
  *   get:
  *     summary: Retrieve appointment dashboard data
  *     tags: [Dashboard]
  *     responses:
  *       200:
  *         description: Appointment dashboard data for admin
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/AppointmentDashboardData'
  *       403:
  *         description: Unauthorized access
  *       500:
  *         description: Server error
  */
  app.get(`${apiPrefix}/appointment-dashboard`, [authenticateToken], authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER, roles.BARBER, roles.SALON_MANAGER), dashboardController.getAppointmentDashboardData);

  /**
* @swagger
* /api/dashboard/generate-report:
*   get:
*     summary: Generate a PDF report for appointments
*     description: Generates a PDF report containing appointment data, including users, barbers, salons, and appointment statuses, with optional filtering by start and end dates. Accessible only to admins.
*     tags:
*       - Dashboard
*     parameters:
*       - in: query
*         name: startDate
*         required: false
*         schema:
*           type: string
*           format: date
*         description: The start date for filtering appointments in the format YYYY-MM-DD (optional).
*       - in: query
*         name: endDate
*         required: false
*         schema:
*           type: string
*           format: date
*         description: The end date for filtering appointments in the format YYYY-MM-DD (optional).
*     responses:
*       200:
*         description: PDF report generated successfully.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 success:
*                   type: boolean
*                   description: Indicates if the operation was successful.
*                 message:
*                   type: string
*                   description: Message describing the operation result.
*                 downloadLink:
*                   type: string
*                   description: URL to download the generated PDF report.
*               example:
*                 success: true
*                 message: PDF Report generated successfully
*                 downloadLink: /reports/Appointment_Report_20241203120000.pdf
*       400:
*         description: Bad request - Invalid date format.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 success:
*                   type: boolean
*                   description: Indicates if the operation was successful.
*                 message:
*                   type: string
*                   description: Error message.
*                 code:
*                   type: integer
*                   description: Error code.
*               example:
*                 success: false
*                 message: Invalid start date
*                 code: 400
*       401:
*         description: Unauthorized access - Token is missing or invalid.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 success:
*                   type: boolean
*                   description: Indicates if the operation was successful.
*                 message:
*                   type: string
*                   description: Error message.
*                 code:
*                   type: integer
*                   description: Error code.
*               example:
*                 success: false
*                 message: No User ID found
*                 code: 401
*       403:
*         description: User is not authorized to access this resource - Admin role required.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 success:
*                   type: boolean
*                   description: Indicates if the operation was successful.
*                 message:
*                   type: string
*                   description: Error message.
*                 code:
*                   type: integer
*                   description: Error code.
*               example:
*                 success: false
*                 message: Unauthorized User - Admin role required
*                 code: 403
*       500:
*         description: Server error while generating the report.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 success:
*                   type: boolean
*                   description: Indicates if the operation was successful.
*                 message:
*                   type: string
*                   description: Error message.
*                 code:
*                   type: integer
*                   description: Error code.
*               example:
*                 success: false
*                 message: Server Error
*                 code: 500
*/
  app.get(`${apiPrefix}/generate-report`, [authenticateToken, authenticateJWT], dashboardController.generateAdminAppointmentReport);


  /**
* @swagger
* /api/dashboard/appointment-status:
*   get:
*     summary: Retrieve aggregated appointment status counts
*     tags: [Dashboard]
*     parameters:
*       - in: query
*         name: filter
*         required: true
*         schema:
*           type: string
*           enum: [today, last_7_days, last_30_days]
*         description: Filter to specify the date range (e.g., 'today', 'last_7_days', 'last_30_days').
*     responses:
*       200:
*         description: Successfully retrieved appointment status counts.
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
*                   example: "Get appointment status successfully !!!"
*                 response:
*                   type: array
*                   items:
*                     type: object
*                     properties:
*                       status:
*                         type: string
*                         example: "completed"
*                       count:
*                         type: integer
*                         example: 5
*                 code:
*                   type: integer
*                   example: 200
*       400:
*         description: Invalid filter specified.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 error:
*                   type: string
*                   example: "Invalid filter"
*       403:
*         description: Unauthorized access.
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
*                 code:
*                   type: integer
*                   example: 500
*/

  app.get(`${apiPrefix}/appointment-status`, [authenticateToken, authenticateJWT], dashboardController.appointmentStatus);



  /**
* @swagger
* /api/dashboard/newCustomers:
*   get:
*     summary: Retrieve the count of new customers within a specified date range
*     tags: [Dashboard]
*     parameters:
*       - in: query
*         name: filter
*         required: true
*         schema:
*           type: string
*           enum: [today, last_7_days, last_30_days]
*         description: Filter to specify the date range for new customers (e.g., 'today', 'last_7_days', 'last_30_days').
*     responses:
*       200:
*         description: Successfully retrieved the count of new customers.
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
*                   example: "Get new customer successfully !!!"
*                 newCustomerCount:
*                   type: integer
*                   example: 10
*                 code:
*                   type: integer
*                   example: 200
*       400:
*         description: Invalid filter specified.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 error:
*                   type: string
*                   example: "Invalid filter"
*       401:
*         description: Unauthorized access due to missing user ID.
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
*         description: Unauthorized user or role not found.
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
*                 code:
*                   type: integer
*                   example: 500
*/

  app.get(`${apiPrefix}/newCustomers`, [authenticateToken, authenticateJWT], dashboardController.GetnewCustomers);



  /**
  * @swagger
  * /api/dashboard/customer-status:
  *   get:
  *     summary: Retrieve aggregated customer status counts
  *     tags: [Dashboard]
  *     parameters:
  *       - in: query
  *         name: filter
  *         required: true
  *         schema:
  *           type: string
  *           enum: [today, last_7_days, last_30_days]
  *         description: Filter to specify the date range (e.g., 'today', 'last_7_days', 'last_30_days').
  *     responses:
  *       200:
  *         description: Successfully retrieved customer status counts.
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
  *                   example: "Get customer status successfully !!!"
  *                 response:
  *                   type: array
  *                   items:
  *                     type: object
  *                     properties:
  *                       status:
  *                         type: string
  *                         example: "completed"
  *                       count:
  *                         type: integer
  *                         example: 5
  *                 code:
  *                   type: integer
  *                   example: 200
  *       400:
  *         description: Invalid filter specified.
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 error:
  *                   type: string
  *                   example: "Invalid filter"
  *       403:
  *         description: Unauthorized access.
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
  *                 code:
  *                   type: integer
  *                   example: 500
  */
  app.get(`${apiPrefix}/customer-status`, [authenticateToken, authenticateJWT], dashboardController.customerStatus);


  /**
  * @swagger
  * /api/dashboard/customer-yearly-status:
  *   get:
  *     summary: Retrieve customer statistics for the current year (January to December)
  *     tags: [Dashboard]
  *     description: |
  *       Retrieves customer statistics for each month in the current year. 
  *       - **Salon Owners & Managers** see data for their salon.
  *       - **Barbers** see data for their assigned customers.
  *       - **Customers are not authorized to access this data.**
  *     responses:
  *       200:
  *         description: Successfully retrieved customer statistics for each month.
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
  *                   example: "Customer statistics retrieved successfully!"
  *                 data:
  *                   type: object
  *                   properties:
  *                     january:
  *                       type: object
  *                       properties:
  *                         repeatedCustomers:
  *                           type: integer
  *                           example: 10
  *                         newCustomers:
  *                           type: integer
  *                           example: 25
  *                         totalCustomers:
  *                           type: integer
  *                           example: 35
  *                     february:
  *                       type: object
  *                       properties:
  *                         repeatedCustomers:
  *                           type: integer
  *                           example: 4
  *                         newCustomers:
  *                           type: integer
  *                           example: 12
  *                         totalCustomers:
  *                           type: integer
  *                           example: 16
  *                     march:
  *                       type: object
  *                       properties:
  *                         repeatedCustomers:
  *                           type: integer
  *                           example: 7
  *                         newCustomers:
  *                           type: integer
  *                           example: 15
  *                         totalCustomers:
  *                           type: integer
  *                           example: 22
  *                 code:
  *                   type: integer
  *                   example: 200
  *       401:
  *         description: Unauthorized access (User not authenticated).
  *       403:
  *         description: Unauthorized access (User does not have permission).
  *       500:
  *         description: Internal server error.
  */

  app.get(`${apiPrefix}/customer-yearly-status`, [authenticateToken, authenticateJWT], dashboardController.customerYearlyStatus);

};
