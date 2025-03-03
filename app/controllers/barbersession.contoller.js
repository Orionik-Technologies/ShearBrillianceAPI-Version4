const db = require("../models");
const { Op } = require('sequelize');
const { MessageENUM } = require('../config/Enums');
const { role } = require("../config/roles.config");
const { BarberCategoryENUM } = require("../config/barberCategory.config");
const { calculateBarberWaitTime } = require('./salon.controller');
const sendResponse = require('../helpers/responseHelper');
const { Sequelize } = require('sequelize');

const Barber = db.Barber;
const BarberSession = db.BarberSession;
const BarberLeave = db.BarberLeave;
const Appointment = db.Appointment;
const User = db.USER;
const Salon = db.Salon;
const Service = db.Service;
const Slot = db.Slot;
const userTimezone = 'America/Toronto';
const BarberService = db.BarberService;

const moment = require('moment');

const SLOT_DURATION = 15; // minutes
const SHIFTS = {
  MORNING: { start: '06:00', end: '12:00' },
  AFTERNOON: { start: '12:00', end: '17:00' },
  EVENING: { start: '17:00', end: '22:00' }
};

const generateSlots = async (barberSession, models) => {
  // Only create slots if the barber session category is 1
  if (barberSession.category !== BarberCategoryENUM.ForAppointment) {
    return []; // Return an empty array if category is not 1
  }

  const slots = [];
  const startTime = moment(barberSession.start_time, 'HH:mm:ss');
  const endTime = moment(barberSession.end_time, 'HH:mm:ss');
  let currentTime = moment(startTime);

  while (currentTime.isBefore(endTime)) {
    const slotEndTime = moment(currentTime).add(SLOT_DURATION, 'minutes');

    // Only create slot if it ends before or at session end time
    if (slotEndTime.isSameOrBefore(endTime)) {
      slots.push({
        BarberSessionId: barberSession.id,
        SalonId: barberSession.SalonId,
        slot_date: barberSession.session_date,
        start_time: currentTime.format('HH:mm:ss'),
        end_time: slotEndTime.format('HH:mm:ss'),
        is_booked: false
      });
    }
    
    currentTime = slotEndTime;
  }

  if (slots.length > 0) {
    await models.Slot.bulkCreate(slots);
  }
  
  return slots;
};

const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // Align to nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
};

const roundTimeToNearestSlot = (timeString) => {
  // Convert time string (HH:mm) to minutes since midnight
  const [hours, minutes] = timeString.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  // Round to nearest 15 minutes
  const intervalInMinutes = 15;
  const roundedMinutes = Math.round(totalMinutes / intervalInMinutes) * intervalInMinutes;
  
  // Convert back to hours and minutes
  const roundedHours = Math.floor(roundedMinutes / 60);
  const remainingMinutes = roundedMinutes % 60;
  
  // Format the time string with leading zeros
  const formattedHours = roundedHours.toString().padStart(2, '0');
  const formattedMinutes = remainingMinutes.toString().padStart(2, '0');
  
  return `${formattedHours}:${formattedMinutes}`;
};

exports.create = async (req, res) => {
  try {
    const { BarberId, SalonId, availableDays } = req.body;

    // Validate input data
    if (!BarberId || !SalonId || !Array.isArray(availableDays) || availableDays.length === 0) {
      return sendResponse(res, false, 'All fields are required and availableDays must be a non-empty array', null, 400);
    }

    // Check if Barber exists
    const barber = await Barber.findByPk(BarberId);
    if (!barber) {
      return sendResponse(res, false, 'Invalid BarberId. Barber does not exist.', null, 400);
    }

    // Check if Salon exists
    const salon = await Salon.findByPk(SalonId);
    if (!salon) {
      return sendResponse(res, false, 'Invalid SalonId. Salon does not exist.', null, 400);
    }

    // Process availableDays and create sessions
    const createdSessions = [];
    const createdSlots = [];
    
    for (const day of availableDays) {
      const { date, startTime, endTime } = day;

      if (!startTime || !endTime) continue;

      // Round the start and end times to nearest 15-minute slots
      const roundedStartTime = roundTimeToNearestSlot(startTime);
      const roundedEndTime = roundTimeToNearestSlot(endTime);


      const start_time = new Date(`${date}T${roundedStartTime}:00Z`);
      const end_time = new Date(`${date}T${roundedEndTime}:00Z`);

      if (end_time <= start_time) {
        return sendResponse(
          res,
          false,
          `End time must be after start time for the date ${date}`,
          null,
          400
        );
      }

      const remaining_time = Math.round((end_time - start_time) / 60000);

      const barberSession = await BarberSession.create({
        BarberId,
        SalonId,
        start_time: roundedStartTime,
        end_time: roundedEndTime,
        session_date: date,
        remaining_time,
        category: barber.category,
        position: barber.position,
      });

      createdSessions.push(barberSession);

      const slots = await generateSlots(barberSession, db);
      createdSlots.push(...slots);
      createdSessions.push({
        ...barberSession.toJSON(),
        slots: slots
      });
    }

    if (createdSessions.length === 0) {
      return sendResponse(res, false, 'No sessions were created. Check your input.', null, 400);
    }

    // Group sessions by week
    const sessionsByWeek = createdSessions.reduce((acc, session) => {
      const sessionDate = new Date(session.session_date);
      const { year, week } = getWeekNumber(sessionDate);

      const key = `${year}-W${week}`;
      if (!acc[key]) acc[key] = [];
      
      acc[key].push(session);
      return acc;
    }, {});

    const responseData = Object.entries(sessionsByWeek).map(([weekKey, sessions]) => ({
      salonName: salon.name,
      barberName: barber.name,
      schedule: sessions
        .map((session) => {
          // Only include sessions that have slots
          if (session.slots && session.slots.length > 0) {
            return {
              id: session.id,
              day: new Date(session.session_date).toLocaleDateString('en-US', { weekday: 'long' }),
              date: session.session_date,
              startTime: session.start_time,
              endTime: session.end_time,
              slots: session.slots.map(slot => ({
                startTime: roundTimeToNearestSlot(slot.start_time),  // Round slot times
                endTime: roundTimeToNearestSlot(slot.end_time),      // Round slot times
                isBooked: slot.is_booked,
              })),
            };
          }
          return null;
        })
        .filter(session => session !== null) // Remove any null entries (sessions without slots)
    }));

    
    // Include Barber and Salon objects in the response
    const responseWithObjects = {
      barber: {
        id: barber.id,
        name: barber.name,
        availability_status: barber.availability_status,
        cutting_since: barber.cutting_since,
        organization_join_date: barber.organization_join_date,
        photo: barber.photo,
      },
      salon: {
        id: salon.id,
        name: salon.name,
        address: salon.address,
        phone_number: salon.phone_number,
        open_time: salon.open_time,
        close_time: salon.close_time,
      },
      groupedSessions: responseData,
      totalSlots: createdSlots.length
    };

    return sendResponse(
      res,
      true,
      'Barber sessions created successfully',
      responseWithObjects,
      201
    );
  } catch (error) {
    console.error('Error creating barber sessions:', error);
    return sendResponse(
      res,
      false,
      error.message || 'An error occurred while creating barber sessions',
      null,
      500
    );
  }
};


const groupSessionsBySalonAndBarber = async (barberSessions, barberLeaves = []) => {
  const grouped = {};

  // Create a map to store appointments for each barber session
  // const sessionAppointments = new Map();
  
  // Fetch all appointments for the relevant barber sessions
  const appointments = await Appointment.findAll({
    where: {
      BarberId: {
        [Op.in]: barberSessions.map(session => session.barber.id)
      },
      appointment_date: {
        [Op.in]: barberSessions.map(session => 
          new Date(session.session_date).toISOString().split('T')[0]
        )
      },
      status: ['appointment', 'checked_in', 'in_salon'] // Add relevant statuses
    },
    include: [{
      model: Service,
      as: 'Services',
      through: 'AppointmentServices'
    }]
  });

  // Create a map to store appointments by barber and date
  const appointmentMap = new Map();
  appointments.forEach(appointment => {
    const key = `${appointment.BarberId}-${appointment.appointment_date}`;
    if (!appointmentMap.has(key)) {
      appointmentMap.set(key, []);
    }
    appointmentMap.get(key).push({
      id: appointment.id,
      customer_name: appointment.name,
      mobile_number: appointment.mobile_number,
      status: appointment.status,
      start_time: appointment.appointment_start_time,
      end_time: appointment.appointment_end_time,
      number_of_people: appointment.number_of_people,
      services: appointment.Services ? appointment.Services.map(service => ({
        id: service.id,
        name: service.name,
        duration: service.duration
      })) : []
    });
  });

  barberSessions.forEach(async session => {
    const salonId = session.barber.salon.id;
    const barberId = session.barber.id;
    const sessionDate = new Date(session.session_date).toISOString().split('T')[0];
    const appointmentKey = `${barberId}-${sessionDate}`;


    if (!grouped[salonId]) {
      grouped[salonId] = {
        salonDetails: {
          id: session.barber.salon.id,
          name: session.barber.salon.name,
          address: session.barber.salon.address,
          phone_number: session.barber.salon.phone_number,
          open_time: session.barber.salon.open_time,
          close_time: session.barber.salon.close_time,
        },
        barbers: {}
      };
    }

    if (!grouped[salonId].barbers[barberId]) {
      grouped[salonId].barbers[barberId] = {
        barberInfo: {
          id: session.barber.id,
          name: session.barber.name,
          availability_status: session.barber.availability_status,
          cutting_since: session.barber.cutting_since,
          organization_join_date: session.barber.organization_join_date,
          photo: session.barber.photo,
          category: session.barber.category,
          position: session.barber.position,
          weekly_schedule: session.barber.weekly_schedule, // Add weekly schedule here
          non_working_days: session.barber.non_working_days
        },
        schedule: []
      };
    }

    // Create a map of dates that have sessions (move this outside the block)
    const sessionDatesMap = new Map();
    barberSessions
      .filter(s => s.barber.id === barberId)
      .forEach(s => {
        const dateKey = new Date(s.session_date).toISOString().split('T')[0];
        sessionDatesMap.set(dateKey, true);
      });

    // Add leave dates for this barber
    const barberLeaveEntries = barberLeaves.filter(leave => 
      leave.BarberId === barberId && leave.status === 'approved'
    );

    barberLeaveEntries.forEach(leave => {
      const startDate = new Date(leave.start_date);
      const endDate = new Date(leave.end_date);
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

      // Add an entry for each day in the leave period
      for (let i = 0; i <= daysDiff; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateKey = currentDate.toISOString().split('T')[0];

        // Only add leave day if there's no session on this date
        if (!sessionDatesMap.has(dateKey)) {
          const alreadyExists = grouped[salonId].barbers[barberId].schedule.some(
            entry => {
              const entryDate = new Date(entry.date);
              const entryDateKey = entryDate.toISOString().split('T')[0];
              return entryDateKey === dateKey;
            }
          );

          if (!alreadyExists) {
            grouped[salonId].barbers[barberId].schedule.push({
              id: null,
              day: currentDate.toLocaleDateString('en-US', { weekday: 'long' }),
              date: currentDate.toISOString().split('T')[0], // Extract only the date part
              startTime: leave.start_time,
              endTime: leave.end_time,
              is_non_working_day: false,
              is_leave_day: true,
              leave_reason: leave.reason,
              leave_status: leave.status,
              appointments: []
            });
          }
        }
      }
    });

    // Add regular sessions to schedule
    grouped[salonId].barbers[barberId].schedule.push({
      id: session.id,
      day: new Date(session.session_date).toLocaleDateString('en-US', { weekday: 'long' }),
      date: session.session_date,
      startTime: session.start_time,
      endTime: session.end_time,
      is_non_working_day: false,
      is_leave_day: false,
      appointments: appointmentMap.get(appointmentKey) || []
    });

    // Add non-working days to schedule only if there's no session on that day
    if (session.barber.non_working_days && Array.isArray(session.barber.non_working_days)) {
      const sessionDates = barberSessions
        .filter(s => s.barber.id === barberId)
        .map(s => new Date(s.session_date));

      const minDate = new Date(Math.min(...sessionDates));
      const maxDate = new Date(Math.max(...sessionDates));
      const daysDiff = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));

      for (let i = 0; i <= daysDiff; i++) {
        const date = new Date(minDate);
        date.setDate(minDate.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();

        // Only add non-working day if:
        // 1. It's marked as a non-working day
        // 2. There's no session on this date
        // 3. It hasn't been added before
        if (session.barber.non_working_days.includes(dayOfWeek) && !sessionDatesMap.has(dateKey)) {
          const alreadyExists = grouped[salonId].barbers[barberId].schedule.some(
            entry => {
              const entryDate = new Date(entry.date);
              const entryDateKey = entryDate.toISOString().split('T')[0];
              return entryDateKey === dateKey;
            }
          );

          if (!alreadyExists) {
            grouped[salonId].barbers[barberId].schedule.push({
              id: null,
              day: date.toLocaleDateString('en-US', { weekday: 'long' }),
              date: date.toISOString().split('T')[0], // Extract only the date part
              startTime: null,
              endTime: null,
              is_non_working_day: true,
              is_leave_day: false,
              appointments: []
            });
          }
        }
      }
    }
  });

  // Sort schedule by date for each barber
  Object.values(grouped).forEach(salon => {
    Object.values(salon.barbers).forEach(barber => {
      barber.schedule.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
    });
  });

  return grouped;
};

// Helper function to process barber data in parallel
const processBarberData = async (groupedData) => {
  const salonPromises = Object.entries(groupedData).map(async ([salonId, salonData]) => {
    const barberPromises = Object.entries(salonData.barbers).map(async ([barberId, barberData]) => {
      const waitTime = await calculateBarberWaitTime(barberId);

      // Fetch barber services
      const barberServices = await BarberService.findAll({
        where: {
          BarberId: barberId,
          SalonId: salonId
        },
        include: [{
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'description', 'default_service_time', 'min_price', 'max_price']
        }],
        raw: true,
        nest: true
      });

      // Format services data
      const servicesWithPrices = barberServices.map(bs => ({
        id: bs.service.id,
        name: bs.service.name,
        description: bs.service.description,
        default_service_time: bs.service.default_service_time,
        min_price: bs.service.min_price,
        max_price: bs.service.max_price,
        barber_price: bs.price
      }));
      
      return {
        ...barberData.barberInfo,
        estimated_wait_time: waitTime.totalWaitTime,
        servicesWithPrices,
        schedule: barberData.schedule,
        weekly_schedule: barberData.barberInfo.weekly_schedule // Include weekly schedule in the response
      };
    });
    
    const processedBarbers = await Promise.all(barberPromises);
    
    return {
      salon: salonData.salonDetails,
      barbers: processedBarbers.map(barber => ({ barber }))
    };
  });
  
  return Promise.all(salonPromises);
};

exports.getAll = async (req, res) => {
  try {
    const { SalonId, BarberId, category, year, month, date } = req.query;
    const userRole = req.user.role;

    let startDate, endDate;

    if (userRole === role.CUSTOMER) {
      // For customers, only show current day
      const today = new Date();
      startDate = new Date(today.setHours(0, 0, 0, 0));
      endDate = new Date(today.setHours(23, 59, 59, 999));
      console.log("startDate",startDate);
      console.log("startDate",endDate);
    } else {
      // If date is provided, create range from that date to same date next month
      if (date) {
        // Parse the date string (assuming format DD-MM-YYYY)
        const [day, monthInput, yearInput] = date.split('-').map(num => parseInt(num));
        
        // Create start date
        startDate = new Date(yearInput, monthInput - 1, day);
        startDate.setHours(0, 0, 0, 0);

        // Create end date (same day next month)
        endDate = new Date(yearInput, monthInput, day);
        endDate.setHours(23, 59, 59, 999);

        // Handle edge cases where the day doesn't exist in the next month
        if (isNaN(endDate.getTime())) {
          // If invalid date (e.g., 31st in a month with 30 days),
          // set to last day of the target month
          endDate = new Date(yearInput, monthInput + 1, 0);
          endDate.setHours(23, 59, 59, 999);
        }
      } else {
        // Fallback to current date if no date provided
        const currentDate = new Date();
        const currentDay = currentDate.getDate();
        
        startDate = new Date(currentDate.setHours(0, 0, 0, 0));
        endDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          currentDay,
          23,
          59,
          59,
          999
        );
      }
    }

    // Add logging for debugging
    console.log('Query parameters:', { SalonId, BarberId, category, date });
    console.log('Date range:', { startDate, endDate });
    console.log('User role:', userRole);

    const sessionWhereClause = {
      session_date: {
        [Op.between]: [startDate, endDate],
      },
    };

     // If the user is a customer, add the current time filter
     if (userRole === role.CUSTOMER) {
      const currentTime = moment.tz(new Date(), userTimezone).format('HH:mm:ss');
      console.log("CurrentTime",currentTime);
      sessionWhereClause[Op.and] = [
        { start_time: { [Op.lte]: currentTime } }, // Current time is after or equal to start_time
        { end_time: { [Op.gte]: currentTime } }   // Current time is before or equal to end_time
      ];
    }

    

    const barberWhereClause = {};
    if (SalonId) barberWhereClause.SalonId = SalonId;
    if (BarberId) barberWhereClause.id = BarberId;
    if (category) barberWhereClause.category = category;

    if (userRole === role.BARBER) {
      barberWhereClause.id = req.user.barberId; // Restrict to the logged-in barber's ID
    } else if (userRole === role.SALON_MANAGER || userRole === role.SALON_OWNER) {
      barberWhereClause.SalonId = req.user.salonId; // Restrict to their salon
    }

   

    const barberSessions = await BarberSession.findAll({
      where: sessionWhereClause,
      order: [
        ['session_date', 'ASC'],
        ['start_time', 'ASC'],
      ],
      include: [
        {
          model: Barber,
          as: 'barber',
          where: barberWhereClause,
          attributes: { exclude: ['createdAt', 'updatedAt'] },
          include: [
            {
              model: Salon,
              as: 'salon',
              attributes: { exclude: ['createdAt', 'updatedAt'] },
            },
            {
              model: User,
              as: 'user',
              attributes: { exclude: ['password'] },
            },
          ],
        },
      ],
    });

    // Fetch barber leaves
    const barberLeaves = await BarberLeave.findAll({
      where: {
        status: 'approved',
        [Op.or]: [
          {
            [Op.and]: [
              { start_date: { [Op.lte]: endDate } },
              { end_date: { [Op.gte]: startDate } }
            ]
          }
        ],
        ...(BarberId && { BarberId }),
      }
    });
    

    console.log('Found barber sessions:', barberSessions.length);

    if (barberSessions.length === 0) {
      const message =
        userRole === role.CUSTOMER
          ? 'No available barbers found for today'
          : 'No barber sessions found for the selected date range';
      return sendResponse(res, false, message, null, 200);
    }
    // Group the sessions and process barber data in parallel
    const groupedBySalon = await groupSessionsBySalonAndBarber(barberSessions, barberLeaves);
    const responseData = await processBarberData(groupedBySalon);

    const dateRangeText = date 
      ? `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
      : 'today';
    
    const successMessage =
      userRole === role.CUSTOMER
        ? 'Available barbers retrieved successfully for today'
        : `Barber sessions retrieved successfully for ${dateRangeText}`;

    return sendResponse(res, true, successMessage, responseData, 200);
  } catch (error) {
    console.error('Error retrieving barber sessions:', error);
    return sendResponse(res, false, error.message || 'An error occurred while retrieving barber sessions', null, 500);
  }
};



// Helper function to check if slots are affected by time change
const getAffectedSlots = async (sessionId, newStartTime, newEndTime) => {
  const allSlots = await Slot.findAll({
    where: { BarberSessionId: sessionId },
    order: [['start_time', 'ASC']]
  });

  const withinNewSchedule = [];
  const outsideNewSchedule = [];

  allSlots.forEach(slot => {
    const slotStart = moment(slot.start_time, 'HH:mm:ss');
    const slotEnd = moment(slot.end_time, 'HH:mm:ss');
    const newStart = moment(newStartTime, 'HH:mm:ss');
    const newEnd = moment(newEndTime, 'HH:mm:ss');

    if (slotEnd.isSameOrBefore(newEnd) && slotStart.isSameOrAfter(newStart)) {
      withinNewSchedule.push(slot);
    } else {
      outsideNewSchedule.push(slot);
    }
  });

  return { withinNewSchedule, outsideNewSchedule };
};

exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    const { BarberId, SalonId, start_time, end_time, availability_status, session_date, reason } = req.body;

    if (!id) {
      return sendResponse(res, false, 'Barber session ID is required', null, 400);
    }

    const barberSession = await BarberSession.findByPk(id);
    if (!barberSession) {
      return sendResponse(res, false, 'Barber session not found', null, 404);
    }

    // Handle leave cases
    const today = new Date().toISOString().split('T')[0];
    let leaveReason = session_date === today ? null : (reason || 'family_emergency');

    if (!start_time || !end_time || availability_status === 'unavailable') {

      // Check for booked appointments before allowing deletion
      // Get all appointments for slots in this session
    
      const appointments = await Appointment.findAll({
        include: [{
          model: User,
          as: 'User',
          attributes: ['id', 'email', 'mobile_number']
        }],
        where: {
          SlotId: {
            [Sequelize.Op.in]: Sequelize.literal(
              `(SELECT id FROM public."Slots" WHERE "BarberSessionId" = ${id})`
            )
          },
          status: 'appointment' // Only get active appointments
        }
      });

    if (appointments.length > 0) {
      // Cancel all appointments
      for (const appointment of appointments) {
        await appointment.update({
          status: 'canceled',
          cancel_time: new Date()
        });

        // Send notification to customer if they exist
        if (appointment.User) {
          try {
            // Optional: Send email notification
            // if (appointment.User.email) {
            //   await EmailService.sendAppointmentCancellation({
            //     email: appointment.User.email,
            //     appointment: {
            //       date: appointment.appointment_date,
            //       time: `${appointment.appointment_start_time} - ${appointment.appointment_end_time}`
            //     }
            //   });
            // }
          } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Continue with the process even if notification fails
          }
        }
      }
    }

      await Slot.destroy({
        where: {
          BarberSessionId: id,
          is_booked: false
        }
      });

      await barberSession.destroy();

      await BarberLeave.create({
        BarberId :barberSession.BarberId,
        SalonId : barberSession.SalonId,
        start_date: barberSession.session_date,
        end_date: barberSession.session_date,
        start_time: null,
        end_time: null,
        reason: leaveReason,
        status: 'approved',
        availability_status: 'unavailable',
        approve_by_id: req.user.id,
        response_reason: null
      });

      return sendResponse(res, true, 'Barber session removed and leave recorded successfully', null, 200);
    }

    // Handle time changes
    if (start_time || end_time) {

       // Round the new times to nearest 15-minute slots
       const newStartTime = start_time ? roundTimeToNearestSlot(start_time) : barberSession.start_time;
       const newEndTime = end_time ? roundTimeToNearestSlot(end_time) : barberSession.end_time;
 

      // Get affected slots
      const { withinNewSchedule, outsideNewSchedule } = await getAffectedSlots(
        id,
        newStartTime,
        newEndTime
      );

      // Check for booked slots outside new schedule
      const bookedOutsideSlots = outsideNewSchedule.filter(slot => slot.is_booked);
      if (bookedOutsideSlots.length > 0) {
        // Create notification data for affected appointments
        const affectedAppointments = bookedOutsideSlots.map(slot => ({
          slotId: slot.id,
          originalTime: `${roundTimeToNearestSlot(slot.start_time)} - ${roundTimeToNearestSlot(slot.end_time)}`,
          date: slot.slot_date
        }));

        return sendResponse(res, false, 'Cannot update time range. Found booked appointments outside new schedule.', 
          { affectedAppointments }, 400);
      }

      // Delete only unbooked slots outside new schedule
      const unbookedOutsideSlotIds = outsideNewSchedule
        .filter(slot => !slot.is_booked)
        .map(slot => slot.id);

      if (unbookedOutsideSlotIds.length > 0) {
        await Slot.destroy({
          where: {
            id: unbookedOutsideSlotIds
          }
        });
      }

      // Calculate remaining time
      const startMoment = moment(newStartTime, 'HH:mm:ss');
      const endMoment = moment(newEndTime, 'HH:mm:ss');
      const remaining_time = endMoment.diff(startMoment, 'minutes');

      // Update the session
      await barberSession.update({
        BarberId: BarberId || barberSession.BarberId,
        SalonId: SalonId || barberSession.SalonId,
        start_time: newStartTime,
        end_time: newEndTime,
        remaining_time
      });

      // Generate new slots only for the gaps
      const existingSlotTimes = withinNewSchedule.map(slot => ({
        start: moment(roundTimeToNearestSlot(slot.start_time), 'HH:mm:ss'),
        end: moment(roundTimeToNearestSlot(slot.end_time), 'HH:mm:ss')
      }));

      let currentTime = startMoment;
      const newSlots = [];

      while (currentTime.isBefore(endMoment)) {
        const slotEndTime = moment(currentTime).add(15, 'minutes');
        
        // Check if this time slot overlaps with any existing slots
        const hasOverlap = existingSlotTimes.some(existing => 
          (currentTime.isSameOrAfter(existing.start) && currentTime.isBefore(existing.end)) ||
          (slotEndTime.isAfter(existing.start) && slotEndTime.isSameOrBefore(existing.end))
        );

        if (!hasOverlap && slotEndTime.isSameOrBefore(endMoment)) {
          newSlots.push({
            BarberSessionId: id,
            SalonId: barberSession.SalonId,
            slot_date: barberSession.session_date,
            start_time: roundTimeToNearestSlot(currentTime.format('HH:mm')),
            end_time: roundTimeToNearestSlot(slotEndTime.format('HH:mm')),
            is_booked: false
          });
        }

        currentTime = slotEndTime;
      }

      if (newSlots.length > 0) {
        await Slot.bulkCreate(newSlots);
      }
    }

    // Fetch final updated data
    const updatedSession = await BarberSession.findByPk(id);
    const sessionSlots = await Slot.findAll({
      where: {
        BarberSessionId: id
      },
      order: [['start_time', 'ASC']]
    });

    const responseData = {
      ...updatedSession.toJSON(),
      slots: sessionSlots.map(slot => ({
        ...slot.toJSON(),
        start_time: roundTimeToNearestSlot(slot.start_time),
        end_time: roundTimeToNearestSlot(slot.end_time)
      }))
    };

    return sendResponse(res, true, 'Barber session and slots updated successfully', { barberSession: responseData }, 200);

  } catch (error) {
    console.error('Error updating barber session:', error);
    return sendResponse(res, false, error.message || 'An error occurred while updating the barber session', null, 500);
  }
};


exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const barberSession = await BarberSession.findByPk(id);

    if (!barberSession) {
      return sendResponse(res, false, 'Barber session not found', null, 404);
    }

    await barberSession.destroy();

    return sendResponse(res, true, 'Barber session deleted successfully', null, 200);
  } catch (error) {
    console.error('Error deleting barber session:', error);
    return sendResponse(res, false, error.message || 'An error occurred while deleting the barber session', null, 500);
  }
};

exports.findByBarberId = async (req, res) => {
  try {
    const { BarberId, service_time } = req.body; // Get BarberId and services from the request body

    // Validate input: Check if BarberId is provided and valid
    if (!BarberId) {
      return sendResponse(res, false, 'BarberId is required', null, 400);
    }

    if (service_time === undefined || service_time <= 0) {
      return sendResponse(res, false, 'A valid service_time is required', null, 400);
    }

    // Calculate today's date range (Start of the day to end of the day)
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999); 
    const currentTime = new Date();

    // Retrieve barber sessions for the given BarberId, along with associated barber and salon
    const barberSessions = await BarberSession.findAll({
      where: {
        BarberId,
        session_date: {
          [Op.between]: [todayStart, todayEnd], // Filter for today's session_date
        },
      },
      attributes : ['id', 'start_time', 'end_time', 'remaining_time'],
      order: [['start_time', 'ASC']], // Order by start_time
      include: [
        {
          model: Barber,
          as: 'barber', // Alias for the barber association
          attributes: { exclude: ['createdAt', 'updatedAt'] }, // Exclude unwanted attributes
        },
      ],
    });

    // If no sessions are found
    if (barberSessions.length === 0) {
      return sendResponse(res, false, 'No barber sessions found for this barber', null, 200);
    }

    let isFullyBooked = false;
    let isFullyBooked1 = false;
    let allSessionsExpired = false;
    


    // Check if any session is fully booked or not available
    const sessionsWithAvailability = barberSessions.map((session) => {
      const sessionHasLowRemainingTime = session.remaining_time <= service_time; // Check if fully booked
      const sessionIsFullyBooked = session.remaining_time <= 0; // Check if fully booked
      const isAvailableForBooking = session.remaining_time >= service_time; // Check if session has enough time for min_service_time
      const endTimeString = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()} ${session.end_time}`;
      const sessionEndTime = new Date(endTimeString);
      const isSessionExpired = currentTime > sessionEndTime;

      
    console.log("sessionEndTime",sessionEndTime.toString());
      
    console.log("currentTime",currentTime.toString());

      // if(isSessionExpired){
      //   return { ...session.toJSON(), isSessionExpired: false };
      // }

      isFullyBooked=sessionIsFullyBooked;
      isFullyBooked1=sessionHasLowRemainingTime;
      allSessionsExpired = isSessionExpired;

      return {
        ...session.toJSON(),
        isFullyBooked1:sessionHasLowRemainingTime,
        isFullyBooked: sessionIsFullyBooked, // Add availability flag
        isAvailableForBooking, // Add availability check for booking
        service_time, // Include min_service_time if applicable
        isSessionExpired
      };
    });

    console.log("Now Date",Date.now().toString());
     // If all sessions are expired
    //  const allSessionsExpired = sessionsWithAvailability.every((session) => session.isSessionExpired);
     if (allSessionsExpired) {
       return sendResponse(res, true, MessageENUM.Session_Expired, "103", 200);
     }

    // If the barber is fully booked, return a response immediately
    if (isFullyBooked) {
      return sendResponse(res, true, MessageENUM.Fully_Booked, "100", 200);
    }
    // If the barber is fully booked
    else if (isFullyBooked1) {
      const lowTimeSession = barberSessions.find((session) => session.remaining_time <= service_time);
      return sendResponse(res, true, MessageENUM.Low_Remaining_Time, "101", 200);
    }
    else{
      return sendResponse(res, true, MessageENUM.Available, "102", 200);
    }
  } catch (error) {
    console.error('Error retrieving barber sessions:', error);
    return sendResponse(
      res,
      false,
      error.message || 'An error occurred while retrieving barber sessions',
      null,
      500
    );
  }
};
