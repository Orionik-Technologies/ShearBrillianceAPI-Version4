const db = require("../models");
const BarberSession =db.BarberSession;
const { Op } = require('sequelize');
const sendResponse = require('../helpers/responseHelper');
const Salon = db.Salon;
const Service = db.Service;
const Slot =db.Slot;
const moment = require('moment-timezone'); // Use Moment.js for time manipulation with timezones
const userTimezone = 'America/Toronto';


exports.getAvailableSlots = async (req, res) => {
  try {
    // Extract BarberId and slot_date from query parameters
    const { BarberId, slot_date } = req.query;

    // Ensure required parameters are provided
    if (!BarberId || !slot_date) {
      return sendResponse(res, false, 'BarberId and slot_date are required.', null, 400);
    }

    // Get current time in 'America/Toronto' timezone and round to the nearest minute
    //const currentTime = moment().tz('America/Toronto') // Set timezone to 'America/Toronto'
    const currentTime = moment.tz(new Date(), userTimezone);

    // Construct filters for Slot query
    const slotWhereClause = {
      slot_date, // Filter by slot_date
    };

    // Fetch slots with relevant associations
    const slots = await Slot.findAll({
      where: slotWhereClause,
      include: [
        {
          model: BarberSession,
          as: 'barberSession',
          where: { BarberId }, // Filter by BarberId
        },
        {
          model: Salon,
          as: 'salon',
        },
      ],
      order: [['slot_date', 'ASC'], ['start_time', 'ASC']], // Sort slots by date and time
    });

    // Check if slots are available
    if (!slots || slots.length === 0) {
      return sendResponse(res, false, 'No slots found for the specified Barber and date.', null, 200);
    }

    // Helper function to convert HH:MM to seconds
    const timeToSeconds = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 3600 + minutes * 60;
    };

    // Group slots by barber session for better organization
    const groupedSlots = slots.reduce((acc, slot) => {
      const barberSessionId = slot.BarberSessionId;

      if (!acc[barberSessionId]) {
        acc[barberSessionId] = {
          sessionDetails: slot.barberSession,
          slots: [],
        };
      }

      // Convert slot start time to 'America/Toronto' timezone
      const slotStartTime = moment.tz(`${slot.slot_date} ${slot.start_time}`, userTimezone);
      
      // Check if the slot start time is after the current time (in 'America/Toronto' timezone)
      if (slotStartTime.isAfter(currentTime)) {
        acc[barberSessionId].slots.push({
          id: slot.id,
          slot_date: slot.slot_date,
          start_time_seconds: timeToSeconds(slot.start_time), // Convert start_time to seconds
          end_time_seconds: timeToSeconds(slot.end_time),   // Convert end_time to seconds
          start_time_formatted: slot.start_time,           // Keep original formatted time
          end_time_formatted: slot.end_time,               // Keep original formatted time
          is_booked: slot.is_booked,
        });
      }

      return acc;
    }, {});

    // Format the grouped slots into a response array
    const responseData = Object.values(groupedSlots).map((sessionData) => ({
      session: sessionData.sessionDetails,
      slots: sessionData.slots,
    }));

    return sendResponse(res, true, 'Slots retrieved successfully.', responseData, 200);
  } catch (error) {
    console.error('Error retrieving slots:', error);
    return sendResponse(res, false, error.message || 'An error occurred while retrieving slots.', null, 500);
  }
};




  
