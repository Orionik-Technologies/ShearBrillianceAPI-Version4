const db = require("../models");
const { Op } = require("sequelize");
const sendResponse = require("../helpers/responseHelper");
const { Sequelize } = require('sequelize');
const { AppointmentENUM } = require("../config/appointment.config");
const {INVITE_TRANSFER_APPOINTMENT_TEMPLATE_ID}=require("../config/sendGridConfig");
const Appointment = db.Appointment;
const Barber = db.Barber;
const BarberLeave = db.BarberLeave;
const Service = db.Service;
const Slot = db.Slot;
const BarberSession = db.BarberSession;
const Salon = db.Salon; 
const { sendEmail } = require("../services/emailService");
const moment = require("moment");
const userTimezone = 'America/Toronto';



// Get available barbers for transfer
exports.getAvailableBarbers = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // Fetch the appointment with its details
    const appointment = await Appointment.findByPk(appointmentId, {
      include: [
        {
          model: Barber,
          as: 'Barber',
          attributes: ['id', 'category']
        },
      ]
    });

    if (!appointment) {
      return sendResponse(res, false, "Appointment not found.", null, 404);
    }

    // Extract appointment details
    const {
      appointment_date,
      appointment_start_time,
      appointment_end_time,
      SalonId,
      Barber: { category }
    } = appointment;

    // Find potential barbers in the same category AND same salon
    const potentialBarbers = await Barber.findAll({
      where: {
        category: category,
        availability_status: "available",
        SalonId: SalonId,
        id: { [Op.ne]: appointment.BarberId }
      },
      attributes: [
        'id',
        'name',
        'category',
        'availability_status'
      ]
    });

    // Check each barber's availability including their slots
    const availableBarbers = await Promise.all(
      potentialBarbers.map(async (barber) => {
        // First check barber's slots by joining through BarberSession
        const barberSlots = await Slot.findAll({
          include: [{
            model: BarberSession,
            as: 'barberSession',
            where: {
              BarberId: barber.id
            },
            required: true
          }],
          where: {
            start_time: { [Op.gte]: appointment_start_time },
            end_time: { [Op.lte]: appointment_end_time },
            slot_date: appointment_date // Add date check
          },
          attributes: ['start_time', 'end_time']
        });

        // If no valid slots found, barber is not available
        if (barberSlots.length === 0) {
          return null;
        }

        // Check for conflicting appointments
        const conflictingAppointment = await Appointment.findOne({
          where: {
            BarberId: barber.id,
            appointment_date: appointment_date,
            status: {
              [Op.notIn]: ['canceled']
            },
            [Op.or]: [
              {
                [Op.and]: [
                  { appointment_start_time: { [Op.lt]: appointment_end_time } },
                  { appointment_end_time: { [Op.gt]: appointment_start_time } }
                ]
              }
            ]
          }
        });

        // Check for approved leave requests
        const leaveRequest = await BarberLeave.findOne({
          where: {
            BarberId: barber.id,
            status: 'approved',
            [Op.and]: [
              { start_date: { [Op.lte]: appointment_date } },
              { end_date: { [Op.gte]: appointment_date } }
            ]
          }
        });

        if (!conflictingAppointment && !leaveRequest) {
          // Get barber's appointments for the day
          const barberDayAppointments = await Appointment.findAll({
            where: {
              BarberId: barber.id,
              appointment_date: appointment_date,
              status: {
                [Op.notIn]: ['canceled']
              }
            },
            order: [['appointment_start_time', 'ASC']],
            attributes: ['appointment_start_time', 'appointment_end_time']
          });

          return {
            ...barber.toJSON(),
            daySchedule: barberDayAppointments,
            availableSlots: barberSlots
          };
        }
        return null;
      })
    );

    const filteredBarbers = availableBarbers.filter(barber => barber !== null);

    return sendResponse(res, true, "Available barbers fetched successfully", {
      appointment: {
        id: appointment.id,
        date: appointment_date,
        startTime: appointment_start_time,
        endTime: appointment_end_time,
        services: appointment.Services,
        currentBarber: appointment.Barber
      },
      availableBarbers: filteredBarbers
    }, 200);

  } catch (error) {
    console.error("Error fetching available barbers:", error);
    return sendResponse(res, false, error.message || "Internal server error", null, 500);
  }
};

exports.transferAppointment = async (req, res) => {
  try {
    const { appointmentId, newBarberId } = req.body;

    if (!appointmentId || !newBarberId) {
      return sendResponse(res, false, "Appointment ID and new barber ID are required.", null, 400);
    }

  

    // Fetch the appointment with salon details
    const appointment = await Appointment.findByPk(appointmentId, {
      include: [{
        model: Salon,
        as: 'salon',
        attributes: ['id']
      }]
    });

    if (!appointment) {
      return sendResponse(res, false, "Appointment not found.", null, 404);
    }

    const user = await db.USER.findByPk(appointment.UserId );
    const barber = await db.Barber.findByPk(appointment.BarberId);

    const salon = await db.Salon.findOne({ where: { id: barber.SalonId } });
    const salonName = salon ? salon.name : 'the selected salon';
    const salonAddress = salon ? salon.address : 'the selected salon';

    // Store the old barber ID for slot updates
    const oldBarberId = appointment.BarberId;
    const salonId = appointment.salon.id;

    // Double-check barber availability
    const isBarberAvailable = await checkBarberAvailability(
      newBarberId,
      salonId,
      appointment.appointment_date,
      appointment.appointment_start_time,
      appointment.appointment_end_time
    );

    const NewBarber = await db.Barber.findOne({ where: { id: newBarberId } });
    const NewBarberName = NewBarber ? NewBarber.name : 'the selected Barber';

    if (!isBarberAvailable) {
      return sendResponse(res, false, "Selected barber is not available for this time slot.", null, 400);
    }

    // Find the relevant BarberSession for the new barber
    const barberSession = await BarberSession.findOne({
      where: {
        BarberId: newBarberId,
        SalonId: salonId,
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn('DATE', Sequelize.col('session_date')),
            appointment.appointment_date
          ),
          {
            start_time: { [Op.lte]: appointment.appointment_start_time },
            end_time: { [Op.gte]: appointment.appointment_end_time }
          }
        ]
      }
    });

    if (!barberSession) {
      return sendResponse(res, false, "No active session found for the selected barber.", null, 400);
    }

    // Find old barber's booked slots that may conflict
    const oldSlots = await Slot.findAll({
      where: {
        SalonId: salonId,
        slot_date: appointment.appointment_date,
        is_booked: true, // Only fetch booked slots
        [Op.or]: [
          // Slots that start before the appointment ends and end after the appointment starts
          {
            start_time: { [Op.lt]: appointment.appointment_end_time },
            end_time: { [Op.gt]: appointment.appointment_start_time }
          },
          // Slots that completely encompass the appointment time
          {
            start_time: { [Op.lte]: appointment.appointment_start_time },
            end_time: { [Op.gte]: appointment.appointment_end_time }
          }
        ]
      },
      include: [{
        model: BarberSession,
        as: 'barberSession',
        where: { 
          BarberId: oldBarberId,
          [Op.and]: [
            Sequelize.where(
              Sequelize.fn('DATE', Sequelize.col('session_date')),
              appointment.appointment_date
            )
          ]
        }
      }]
    });

    // Find new barber's available slots that overlap with the desired time
    const newSlots = await Slot.findAll({
      where: {
        BarberSessionId: barberSession.id,
        SalonId: salonId,
        slot_date: appointment.appointment_date,
        is_booked: false, // Ensure we get only available slots
        [Op.or]: [
          // Slots that start before the appointment ends and end after the appointment starts
          {
            start_time: { [Op.lt]: appointment.appointment_end_time },
            end_time: { [Op.gt]: appointment.appointment_start_time }
          },
          // Slots that completely encompass the appointment time
          {
            start_time: { [Op.lte]: appointment.appointment_start_time },
            end_time: { [Op.gte]: appointment.appointment_end_time }
          }
        ]
      }
    });

    if (newSlots.newSlotslength === 0) {
      return sendResponse(res, false, "No available slots found for the new barber.", null, 400);
    }

    // Update the appointment with new barber and first available slot
    const selectedNewSlot = newSlots[0]; // You can implement your logic to select a specific slot if needed.
    
    appointment.BarberId = newBarberId;
    appointment.SlotId = selectedNewSlot.id;
    
    await appointment.save();

    // Update old slot booking status to free up the slot
    if (oldSlots.length > 0) {
      await Promise.all(oldSlots.map(slot => slot.update({ is_booked: false })));
    }

    if (newSlots.length > 0) {
      await Promise.all(newSlots.map(slot => slot.update({ is_booked: true })));
    }

    // Update new slot booking status to booked
    // await selectedNewSlot.update({ is_booked: true });

    // Fetch updated appointment with barber details
    const updatedAppointment = await Appointment.findByPk(appointmentId, {
      include: [{
        model: Barber,
        as: 'Barber',
        attributes: ['id', 'name', 'category', 'position']
      }]
    });

    const formatTo12Hour = (time) => {
        const [hours, minutes, seconds] = time.split(":").map(Number);
        const date = new Date(1970, 0, 1, hours, minutes, seconds); // Create a valid Date object
    
        return date.toLocaleString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        });
    };

 
         // Send email notification to the user
    const emailData = {
      customer_name: appointment.name,
      old_barber_name: barber.name,
      new_barber_name: NewBarberName,
      appointment_date: appointment.appointment_date,
      appointment_start_time: formatTo12Hour(appointment.appointment_start_time),
      appointment_end_time: formatTo12Hour(appointment.appointment_end_time),
      salon_name: salonName,
      location: salonAddress,
      currentYear: new Date().getFullYear(),
      reschedule_url: `${process.env.FRONTEND_URL}/select_salon`,
      email_subject: "Appointment Transferred Successfully",
    };
     
    await sendEmail(user.email,"Your Appointment has been Transferred", INVITE_TRANSFER_APPOINTMENT_TEMPLATE_ID, emailData);

    return sendResponse(
      res,
      true,
      "Appointment successfully transferred and slots updated.",
      updatedAppointment,
      200
    );

  } catch (error) {
    console.error("Error transferring appointment:", error);
    return sendResponse(res, false, error.message || "Internal server error", null, 500);
  }
};


// Helper function to check barber availability
const checkBarberAvailability = async (barberId, salonId, date, startTime, endTime) => {
  // Check for existing appointments
  const conflictingAppointment = await Appointment.findOne({
    where: {
      BarberId: barberId,
      appointment_date: date,
      status:AppointmentENUM.Appointment,
      [Op.or]: [
        {
          [Op.and]: [
            { appointment_start_time: { [Op.lt]: endTime } },
            { appointment_end_time: { [Op.gt]: startTime } }
          ]
        }
      ]
    }
  });

  // Check for approved leave requests
  const leaveRequest = await BarberLeave.findOne({
    where: {
      BarberId: barberId,
      status: 'approved',
      [Op.and]: [
        { start_date: { [Op.lte]: date } },
        { end_date: { [Op.gte]: date } }
      ]
    }
  });

  const barberSession = await BarberSession.findOne({
    where: {
      BarberId: barberId,
      SalonId: salonId,
      [Op.and]: [
        Sequelize.where(
          Sequelize.fn('DATE', Sequelize.col('session_date')), // Extract date part
          date // Input date in 'YYYY-MM-DD' format
        ),
        { start_time: { [Op.lte]: startTime } },
        { end_time: { [Op.gte]: endTime } }
      ]
    },
  });
  

  if (!barberSession) {
    return false;
  }

  // Check if slot exists and is available
  const slot = await Slot.findOne({
    where: {
      BarberSessionId: barberSession.id,
      SalonId: salonId,
      slot_date: { [Op.eq]: date }, // Compare slot_date directly with the date
      start_time: { [Op.gte]: startTime },
      end_time: { [Op.lte]: endTime },
      is_booked: false
    }
  });

  console.log("conflictingAppointment",conflictingAppointment);
  console.log("leaveRequest",leaveRequest);
  console.log("slot",slot.length);
  
  return !conflictingAppointment && !leaveRequest && slot !== null;
};