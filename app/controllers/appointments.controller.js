const { AppointmentENUM } = require("../config/appointment.config");
const { BarberCategoryENUM } = require("../config/barberCategory.config");
const { PaymentMethodENUM } = require("../config/paymentEnums.config");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require("../models");
const Appointment = db.Appointment;
const Barber = db.Barber;
const Salon = db.Salon;
const Service = db.Service;
const User = db.USER;
const UserSalon = db.UserSalon;
const roles = db.roles;
const AppointmentService = db.AppointmentService;
const HaircutDetails =db.HaircutDetails;
const FavoriteSalon=db.FavoriteSalon;
const BarberSession = db.BarberSession;
const FcmToken = db.fcmTokens;
const BarberService=db.BarberService;
const Payment = db.Payment;
const { Op, where } = require("sequelize");
const moment = require("moment");
const { role } = require("../config/roles.config");
const sendResponse = require('../helpers/responseHelper');  // Import the helper
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { INVITE_CUSTOMER_WITH_PASSWORD_TEMPLATE_ID } = require("../config/sendGridConfig");
const { sendEmail } = require("../services/emailService");
const { sendMessageToUser } = require('./socket.controller');
const { sendSMS } = require('../services/smsService');
const { Sequelize } = require('sequelize');
const { broadcastBoardUpdates } = require('../controllers/socket.controller');
const { sendNotificationToUser } = require("../services/notificationService");
const { INVITE_BOOKING_APPOINTMENT_TEMPLATE_ID } = require("../config/sendGridConfig");
const {INVITE_CANCEL_APPOINTMENT_TEMPLATE_ID} =require("../config/sendGridConfig");


let io; // Declare io in the controller's scope

// Initialize with the Socket.IO instance
exports.initialize = (socketIo) => {
    io = socketIo;
};

/* function for checked_in appointment time calculations start */

// Function to calculate estimated wait time for a particular barber
const getEstimatedWaitTimeForBarber = async (barberId) => {
    // Fetch all appointments for the barber that are 'checked_in' or 'in_salon'
    const appointments = await Appointment.findAll({
        where: { BarberId: barberId, status: ['checked_in', 'in_salon'] },
        order: [['queue_position', 'ASC']], // Order by queue position to process in order
        include: [{ 
            model: Service, 
            attributes: ['id', 'default_service_time'], // Fetch the 'estimated_service_time' from the Service model
            through: { attributes: [] } // Avoid extra attributes from the join table
        }],
    });

    let cumulativeQueuePosition = 0; // To track the cumulative number of people in the queue
    let cumulativeWaitTime = 0; // To track the cumulative wait time

    let applength = appointments.length;

    if(applength > 0){
         // Check if there is only one 'in_salon' user
         const inSalonUser = appointments.find(a => a.status === 'in_salon');
         const checkedInUsers = appointments.filter(a => a.status === 'checked_in');
        
         if (inSalonUser && checkedInUsers.length === 0) {
            const currentTime = new Date();

             // Calculate elapsed time since the user was marked 'in_salon'
             const inSalonTime = new Date(inSalonUser.in_salon_time); // Start time of `in_salon` status
             const elapsedTime = Math.floor((currentTime - inSalonTime) / 60000); // Elapsed time in minutes
 
             // Calculate remaining time for the `in_salon` user
             const totalServiceTime = inSalonUser.Services.reduce(
                 (sum, service) => sum + (service.default_service_time || 0),
                 0
             );
             const remainingServiceTime = Math.max(totalServiceTime - elapsedTime, 0);
 
             // Add the remaining service time to the cumulative wait time
             cumulativeWaitTime += remainingServiceTime;
             cumulativeQueuePosition = applength; // Set queue position based on total appointments
        } else {
            let lastApp = appointments[applength - 1];

            const totalServiceTime = lastApp?.Services?.length > 0
                ? lastApp.Services.reduce((sum, service) => sum + (service.default_service_time  || 0), 0) // Sum of estimated service times
                : 20; // If no services are selected, the wait time is zero


            cumulativeWaitTime = lastApp.estimated_wait_time + totalServiceTime;
            cumulativeQueuePosition = applength;
        }
    }
    return { 
        totalWaitTime: cumulativeWaitTime, // Total cumulative wait time for the next user
        numberOfUsersInQueue: cumulativeQueuePosition // Total number of people in the queue
    };
};

const recalculateWaitTimesAndQueuePositionsForBarber = async (barberId) => {
    // Fetch all appointments for the barber that are 'checked_in' or 'in_salon'
    const appointments = await Appointment.findAll({
        where: { BarberId: barberId, status: ['checked_in', 'in_salon'] },
        order: [['queue_position', 'ASC']], // Order by queue position to process in order
        include: [{ 
            model: Service, 
            attributes: ['id', 'default_service_time'], // Fetch the 'estimated_service_time' from the Service model
            through: { attributes: [] } // Avoid extra attributes from the join table
        }],
    });

    let cumulativeQueuePosition = 0; // Tracks cumulative queue position
    let cumulativeWaitTime = 0; // Tracks cumulative wait time
    let firstUserPendingTime  = 0;

    // Process 'in_salon' user first (if any)
    const inSalonAppointments = appointments.filter(a => a.status === 'in_salon');
    if (inSalonAppointments.length > 0) {
        const inSalonUser = inSalonAppointments[0]; // Only one user in 'in_salon' at a time
        inSalonUser.queue_position = 1;
        inSalonUser.estimated_wait_time = 0; // First user has no wait time
        const inSalonServiceTime = inSalonUser.Services?.reduce((sum, service) => sum + (service.default_service_time || 0), 0);
        
        // Update cumulative values based on the in_salon user
        cumulativeQueuePosition += inSalonUser.number_of_people;
        cumulativeWaitTime += inSalonUser.number_of_people * inSalonServiceTime;

        const inSalonTime = new Date(inSalonUser.in_salon_time); // Convert to a Date object
        const now = new Date(); // Get the current date and time
            
        // Calculate the difference in milliseconds
        const differenceInMs = now - inSalonTime;
            
        // Convert the difference to minutes
        const differenceInMinutes = Math.floor(differenceInMs / 60000);

        firstUserPendingTime = inSalonServiceTime - differenceInMinutes;
        
        await inSalonUser.save();
    }

    // Process 'checked_in' users and update their estimated wait times and queue positions
    const checkedInAppointments = appointments.filter(a => a.status === 'checked_in');

    for (let index = 0; index < checkedInAppointments.length; index++) {

        const appointment = checkedInAppointments[index];

        if(index == 0){
            if (inSalonAppointments.length > 0) {
                cumulativeQueuePosition += 1; // Increment queue position by 1 for each new user
                appointment.queue_position = cumulativeQueuePosition;
                appointment.estimated_wait_time = firstUserPendingTime;
                await appointment.save(); // Save updated appointment details
            }
            else{
                cumulativeQueuePosition += 1; // Increment queue position by 1 for each new user
                appointment.queue_position = cumulativeQueuePosition;
                appointment.estimated_wait_time = firstUserPendingTime;
                await appointment.save(); // Save updated appointment details
            }
        }
        else{
            let lastAppointment = checkedInAppointments[index-1];

            const totalServiceTime = lastAppointment?.Services?.length > 0
            ? lastAppointment.Services.reduce((sum, service) => sum + (service.default_service_time  || 0), 0) // Sum of estimated service times
            : 20; // If no services are selected, the wait time is zero
    
            cumulativeQueuePosition += 1; // Increment queue position by 1 for each new user
            appointment.queue_position = cumulativeQueuePosition;
            appointment.estimated_wait_time = lastAppointment.estimated_wait_time + totalServiceTime;
        
            console.log(`Processing index ${index}, appointment ID: ${appointment.id}`);
        
            await appointment.save(); // Save updated appointment details
        } 
    }
};

/* function for checked_in appointment time calculations end */



/* create Appointment start  */

// Helper function to calculate remaining time for walk-ins
function calculateRemainingTime(barberSession, activeAppointments) {
    if (activeAppointments.length > 0) {
        return barberSession.remaining_time;
    }
    
    const now = new Date();
    const today = new Date();
    const endTimeString = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()} ${barberSession.end_time}`;
    const sessionEndTime = new Date(endTimeString);

    if (isNaN(sessionEndTime)) {
        throw new Error("Invalid session end time format");
    }

    return Math.max(
        Math.round((sessionEndTime - now) / (1000 * 60)),
        0
    );
}

exports.calculateRemainingTimeExp = calculateRemainingTime;



// Helper function to mark slots as booked
async function markSlotsAsBooked(slots) {
    for (const slot of slots) {
        await db.Slot.update(
            { is_booked: true },
            { where: { id: slot.id } }
        );
    }
}

exports.markSlotsAsBookedExp = markSlotsAsBooked;


// Helper function to verify consecutive available slots
async function verifyConsecutiveSlots(barberSessionId, slotDate, startTime, totalServiceTime) {
    const slots = await db.Slot.findAll({
        where: {
            BarberSessionId: barberSessionId,
            slot_date: slotDate,
            start_time: { [Op.gte]: startTime },
            is_booked: false
        },
        order: [['start_time', 'ASC']],
        raw: true
    });

    let consecutiveSlots = [];
    let currentTime = new Date(`${slotDate} ${startTime}`);
    let endTime = new Date(currentTime.getTime() + totalServiceTime * 60000);

    for (const slot of slots) {
        const slotTime = new Date(`${slotDate} ${slot.start_time}`);
        if (slotTime >= currentTime && slotTime < endTime) {
            consecutiveSlots.push(slot);
        }
    }

    return consecutiveSlots.length * 15 >= totalServiceTime ? consecutiveSlots : null;
}

exports.verifyConsecutiveSlotsExp = verifyConsecutiveSlots;


// Helper function to send notifications
async function sendAppointmentNotifications(appointment, name, mobile_number, user_id, salon_id) {
    const salon = await db.Salon.findOne({ where: { id: salon_id } });
    const salonName = salon ? salon.name : 'the selected salon';

    const message = `Dear ${name}, your appointment has been successfully booked at ${salonName}. ${
        appointment.estimated_wait_time 
            ? `The estimated wait time is ${appointment.estimated_wait_time} minutes.`
            : `Your appointment is scheduled for ${appointment.appointment_date} at ${appointment.appointment_start_time}.`
    } We look forward to serving you.`;

    try {
        await sendSMS(mobile_number, message);
        console.log("SMS sent successfully.");
    } catch (smsError) {
        console.error("Failed to send SMS:", smsError.message);
    }

    // Send app notification
    const fcmTokens = await FcmToken.findAll({ where: { UserId: user_id } });
    if (fcmTokens.length > 0) {
        const notificationTitle = "Appointment Confirmed";
        const notificationBody = `Your appointment at ${salonName} has been confirmed.`;

        for (const token of fcmTokens) {
            await sendNotificationToUser(token.token, notificationTitle, notificationBody);
        }
    }
}

exports.sendAppointmentNotificationsExp = sendAppointmentNotifications;


// Helper function to prepare email data when appointment create for walk_In and Appointment
const prepareEmailData = (appointment, barber, salon, services,  validatedTip, tax, totalAmount, receiptUrl) => {
    const formatTo12Hour = (time) => {
        const [hours, minutes, seconds] = time.split(":").map(Number);
        const date = new Date(1970, 0, 1, hours, minutes, seconds); // Create a valid Date object
        return date.toLocaleString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        });
    };

    const serviceNames = services && services.length > 0
        ? services.map((service) => service.name || "Unknown Service").join(", ")
        : "No services selected";

    const salonName = salon ? salon.name : "the selected salon";
    const salonAddress = salon ? salon.address : "the selected salon";
    const isWalkIn = barber.category === BarberCategoryENUM.ForWalkIn;
    

    if (isWalkIn) {
        return {
            is_walk_in: true,
            customer_name: appointment.name,
            barber_name: barber.name,
            appointment_date: new Date().toLocaleString("en-US", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
            }),
            salon_name: salonName,
            location: salonAddress,
            services: serviceNames,
            tip: validatedTip,
            tax: tax,
            total_amount: totalAmount,
            payment_mode: appointment.paymentMode || "Pay_Online", //
            email_subject: "Walk-in Appointment Confirmation",
            cancel_url: `${process.env.FRONTEND_URL}/appointment_confirmation/${appointment.id}`,
            receipt_url: receiptUrl || null, // Always include receipt_url, even if null
        };
    } else {
        return {
            is_walk_in: false,
            customer_name: appointment.name,
            barber_name: barber.name,
            appointment_date: new Date(appointment.appointment_date).toLocaleDateString("en-US", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
            }),
            appointment_start_time: formatTo12Hour(appointment.appointment_start_time),
            appointment_end_time: formatTo12Hour(appointment.appointment_end_time),
            salon_name: salonName,
            location: salonAddress,
            services: serviceNames,
            tip: validatedTip,
            tax: tax,
            total_amount: totalAmount,
            payment_mode: appointment.paymentMode || "Pay_Online", 
            payment_status: appointment.paymentStatus,
            email_subject: "Appointment Confirmation",
            cancel_url: `${process.env.FRONTEND_URL}/appointment_confirmation/${appointment.id}`,
            receipt_url: receiptUrl || null, // Always include receipt_url, even if null
        };
    }
};

exports.prepareEmailDataExp = prepareEmailData;


async function handleBarberCategoryLogic(barber, user_id, totalServiceTime, appointmentData, slot_id) {
    try {
        if (barber.category === BarberCategoryENUM.ForWalkIn) {
            // Walk-in logic
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
            const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

            // Check if the user already has an active appointment
            const activeAppointment = await db.Appointment.findOne({
                where: { UserId: user_id, status: [AppointmentENUM.Checked_in, AppointmentENUM.In_salon] }
            });

            // if (activeAppointment) {
            //     throw new Error("You already have an active appointment. Please complete or cancel it before booking a new one.");
            // }

            if(activeAppointment) {
                return sendResponse(res, false, "You already have an active appointment. Please complete or cancel it before booking a new one.", null, 400);
            }

            // Retrieve the barber session
            const barberSession = await db.BarberSession.findOne({
                where: {
                    BarberId: barber.id,
                    session_date: { [Op.between]: [todayStart, todayEnd] }
                },
                attributes: ['id', 'start_time', 'end_time', 'session_date', 'remaining_time']
            });

            if (!barberSession) {
                throw new Error('Barber is not available for appointments today');
            }

            // Check for existing appointments for the barber
            const activeBarberAppointments = await db.Appointment.findAll({
                where: {
                    BarberId: barber.id,
                    status: [AppointmentENUM.Checked_in, AppointmentENUM.In_salon]
                },
            });

            let remainingTime = calculateRemainingTime(barberSession, activeBarberAppointments);
            if (remainingTime < totalServiceTime) {
                throw new Error('Not enough remaining time for this appointment');
            }

            const { totalWaitTime, numberOfUsersInQueue } = await getEstimatedWaitTimeForBarber(barber.id);

            // Update appointmentData for walk-in
            appointmentData.status = AppointmentENUM.Checked_in;
            appointmentData.estimated_wait_time = totalWaitTime;
            appointmentData.queue_position = numberOfUsersInQueue + 1;
            appointmentData.check_in_time = new Date();

            // Update barber session remaining time
            await barberSession.update({ 
                remaining_time: remainingTime - totalServiceTime 
            });
        } else {
            // Appointment-based logic
            if (!slot_id) {
                throw new Error('Slot ID is required for appointments');
            }

            // Get the selected slot
            const slot = await db.Slot.findOne({
                where: { 
                    id: slot_id,
                    is_booked: false
                }
            });

            if (!slot) {
                throw new Error('Selected slot is not available');
            }

            // Calculate end time based on services duration
            const startTime = new Date(`${slot.slot_date} ${slot.start_time}`);
            const endTime = new Date(startTime.getTime() + totalServiceTime * 60000);

            // Verify if enough consecutive slots are available
            const requiredSlots = await verifyConsecutiveSlots(
                slot.BarberSessionId, 
                slot.slot_date, 
                slot.start_time, 
                totalServiceTime
            );

            if (!requiredSlots) {
                throw new Error('Not enough consecutive slots available');
            }

            // Update appointmentData for appointment-based
            appointmentData.status = AppointmentENUM.Appointment;
            appointmentData.SlotId = slot_id;
            appointmentData.appointment_date = slot.slot_date;
            appointmentData.appointment_start_time = slot.start_time;
            appointmentData.appointment_end_time = endTime.toTimeString().split(' ')[0];

            // Mark slots as booked
            await markSlotsAsBooked(requiredSlots);
        }

        return appointmentData; // Return updated appointmentData
    } catch (error) {
        throw error; // Re-throw error to be handled by the caller
    }
}

exports.handleBarberCategoryLogicExp = handleBarberCategoryLogic;


async function validateAndAttachServices(appointment, service_ids, res) {
    if (!service_ids || !Array.isArray(service_ids) || service_ids.length === 0) {
        return; // No services to validate or attach
    }

    // Fetch valid services from the database
    const validServices = await db.Service.findAll({
        where: { id: service_ids },
        attributes: ['id', 'name', 'min_price', 'max_price', 'default_service_time']
    });

    console.log("Valid services fetched:", validServices);

    const validServiceIds = validServices.map(service => service.id);
    const invalidServiceIds = service_ids.filter(id => !validServiceIds.includes(id));

    // Check if all service_ids are valid
    if (invalidServiceIds.length > 0) {
        return sendResponse(res, false, 'Some selected services are invalid or duplicate', null, 400);
    }

    // Attach valid services to the appointment, including duplicates
    for (const serviceId of service_ids) {
        if (validServiceIds.includes(serviceId)) {
            await db.AppointmentService.create({
                AppointmentId: appointment.id,
                ServiceId: serviceId
            });
        }
    }

    return validServices; // Return valid services for potential further use
}

exports.validateAndAttachServicesExp = validateAndAttachServices;


async function fetchAppointmentWithServices(appointmentId) {
    const appointmentWithServices = await db.Appointment.findOne({
        where: { id: appointmentId },
        include: [
            {
                model: db.Salon,
                as: 'salon',
                attributes: { exclude: ['createdAt', 'updatedAt'] },
            },
            {
                model: db.Service,
                attributes: ['id', 'name', 'default_service_time'],
                through: { attributes: [] },
            }
        ],
    });

    if (appointmentWithServices) {
        // Fetch associated services manually to preserve duplicates
        const appointmentServices = await db.AppointmentService.findAll({
            where: { AppointmentId: appointmentWithServices.id }
        });
        const serviceIds = appointmentServices.map(as => as.ServiceId);

        // Fetch service details
        const servicesMap = await db.Service.findAll({
            where: { id: serviceIds },
            attributes: ['id', 'name', 'min_price', 'max_price', 'default_service_time']
        }).then(services => {
            return services.reduce((map, service) => {
                map[service.id] = service;
                return map;
            }, {});
        });

        // Map services back, preserving order and duplicates
        const services = appointmentServices.map(as => servicesMap[as.ServiceId]);
        appointmentWithServices.dataValues.Services = services;
    }

    return appointmentWithServices;
}

exports.fetchAppointmentWithServicesExp = fetchAppointmentWithServices;


exports.create = async (req, res) => {
    try {
        let { user_id, salon_id, barber_id, number_of_people, name, mobile_number, service_ids, slot_id, payment_mode, tip } = req.body;
        user_id = req.user ? req.user.id : user_id;
    
        // Get barber details including category
        const barber = await db.Barber.findByPk(barber_id);
        if (!barber) {
            return sendResponse(res, false, 'Barber not found', null, 404);
        }

        // Calculate total service time considering duplicates
        const services = await Service.findAll({
            where: { id: [...new Set(service_ids)] }, // Get unique service IDs for query
            attributes: ['id', 'default_service_time', 'min_price'],
        });

        // Fetch barber-specific service prices
        const barberServices = await db.BarberService.findAll({
            where: {
                BarberId: barber_id,
                ServiceId: { [db.Sequelize.Op.in]: [...new Set(service_ids)] },
            },
            attributes: ['ServiceId', 'price'],
        });

        // Create a map of barber-specific prices for quick lookup
        const barberServicePriceMap = barberServices.reduce((map, bs) => {
            map[bs.ServiceId] = Number(bs.price);
            return map;
        }, {});

        // Create a frequency map of service_ids
        const serviceFrequency = service_ids.reduce((freq, id) => {
            freq[id] = (freq[id] || 0) + 1;
            return freq;
        }, {});

        // Move this calculation before any conditionals
        const totalServiceTime = services.reduce((sum, service) => {
            const frequency = serviceFrequency[service.id] || 0;
            return sum + (service.default_service_time * frequency);
        }, 0);


        // Calculate total service cost, prioritizing barber-specific price over min_price
        const totalServiceCost = services.reduce((sum, service) => {
            const frequency = serviceFrequency[service.id] || 0;
            // Use barber-specific price if available, otherwise fall back to min_price
            const servicePrice = barberServicePriceMap[service.id] !== undefined 
                ? barberServicePriceMap[service.id] 
                : Number(service.min_price);
            return sum + (servicePrice * frequency);
        }, 0);

        const tax = parseFloat((totalServiceCost * 0.13).toFixed(2)); // 13% tax
        const validatedTip = isNaN(tip) ? 0 : Number(tip);
        const totalAmount = parseFloat((totalServiceCost + tax + validatedTip).toFixed(2));

        let appointmentData = {
            UserId: user_id,
            BarberId: barber_id,
            SalonId: salon_id,
            number_of_people: number_of_people ?? 1,
            name: name,
            mobile_number: mobile_number,
            service_ids: service_ids,
            tax: tax,
            tip: validatedTip,
            total_amount: totalAmount
        };

        // Call the new function to handle barber category logic
        appointmentData = await handleBarberCategoryLogic(barber, user_id, totalServiceTime, appointmentData, slot_id);

        if (payment_mode === PaymentMethodENUM.Pay_In_Person) {
            // For pay in person, create appointment with pending status
            appointmentData = {
                ...appointmentData,
                paymentStatus: 'Pending',
                paymentMode: PaymentMethodENUM.Pay_In_Person,
            };
            // Create appointment
            const appointment = await Appointment.create(appointmentData);

            // Create payment record
            await Payment.create({
                appointmentId: appointment.id,
                UserId: user_id,
                amount: totalServiceCost,
                tax: tax,
                tip: validatedTip,
                totalAmount: totalAmount,
                paymentStatus: 'Pending',
                paymentMethod: PaymentMethodENUM.Pay_In_Person,
            });
            
            // Ensure service_ids contains only valid and selected services
            // Validate and attach services
            const validServices = await validateAndAttachServices(appointment, service_ids, res);
            if (res.headersSent) return; // Exit if response was sent due to invalid services


            // Fetch appointment with services
            const appointmentWithServices = await fetchAppointmentWithServices(appointment.id);

            

            if (appointmentWithServices) {
                const salon = await db.Salon.findByPk(salon_id);
                const emailData = prepareEmailData(
                    appointment,
                    barber,
                    salon,
                    appointmentWithServices.dataValues.Services,
                    validatedTip,
                    tax,
                    totalAmount
                );  

                // Add this before sending the confirmation email
                const user = await db.USER.findOne({ where: {id : user_id }, attributes: ['email'] });
                if (!user) {
                    return sendResponse(res, false, 'User not found', null, 404);
                }
                
                const email = user.email; 

                // Send confirmation email
                await sendEmail(email,"Your Appointment Book Successfully",INVITE_BOOKING_APPOINTMENT_TEMPLATE_ID, emailData );
            }

            if(barber.category === BarberCategoryENUM.ForWalkIn) {
                const updatedAppointments = await getAppointmentsByRole(false);
                if(updatedAppointments)
                broadcastBoardUpdates(updatedAppointments);
            }

            // Send notifications
            await sendAppointmentNotifications(appointment, name, mobile_number, user_id, salon_id);

            
            return sendResponse(res, true, 'Appointment created successfully', appointmentWithServices, 201);

        }
    } catch (error) {
    console.error("Error creating appointment:", error);
    return sendResponse(res, false, error.message || 'Internal Server Error', null, 500);
    }
};

/* Appointment create end */





/* Appointment update start */

// Helper function to release booked slots
async function releaseBookedSlots(appointment) {
    try {
        // Find the slot that was initially booked
        const initialSlot = await db.Slot.findOne({
            where: {
                id: appointment.SlotId,  // Using the SlotId from appointment
                is_booked: true
            }
        });

        if (!initialSlot) {
            console.log("Initial slot not found for appointment:", appointment.id);
            return true; // Return true as there might not be slots to release
        }

        // Find all consecutive slots that were booked for this appointment
        const slots = await db.Slot.findAll({
            where: {
                slot_date: initialSlot.slot_date,
                start_time: {
                    [Op.gte]: initialSlot.start_time,
                    [Op.lt]: appointment.appointment_end_time
                },
                BarberSessionId: initialSlot.BarberSessionId,
                is_booked: true
            }
        });

        // Release all slots
        await Promise.all(slots.map(slot => 
            slot.update({ is_booked: false })
        ));

        return true;
    } catch (error) {
        console.error("Error releasing booked slots:", error);
        throw error; // Throw the error to be handled by the calling function
    }
}


exports.updateStatus = async (req, res) => {
    try {
      const { status } = req.body;
  
      // Find the appointment with the associated Barber
      const appointment = await Appointment.findByPk(req.params.id, {
        include: [
          {
            model: Barber,
            as: 'Barber', // Alias for the association
          },
          {
            model: Service,
            attributes: ['id', 'default_service_time'], // Ensure service time is fetched
            through: { attributes: [] },
        },
        ],
      });
  

      if (!appointment) {
        return sendResponse(res, false, "Appointment not found", null, 404);
      }

      if (appointment) {
        // Manually fetch associated services
        const appointmentServices = await AppointmentService.findAll({
            where: {
                AppointmentId: appointment.id
            }
        });
        const serviceIds = appointmentServices.map(as => as.ServiceId);
        // Get all service IDs
        const servicesMap = await Service.findAll({
            where: {
                id: serviceIds
            },
            attributes: ['id', 'name', 'min_price', 'max_price', 'default_service_time']
        }).then(services => {
            // Create a map of services by ID for quick lookup
            return services.reduce((map, service) => {
                map[service.id] = service;
                return map;
            }, {});
        });

        // Map back to maintain order and duplicates
        const services = appointmentServices.map(as => servicesMap[as.ServiceId]);
    
        // Add services to appointment object
        appointment.dataValues.Services = services;
    }

       // Get the barber to check category
       const barber = await db.Barber.findByPk(appointment.BarberId);
  
      // Check if the salon is closed, if so cancel appointments
      const salon = await Salon.findByPk(appointment.SalonId);
      if (salon && salon.isClosed) {
        const cancellationResult = await cancelCheckedInOrInSalonAppointments(appointment.SalonId);
        if (!cancellationResult) {
          return sendResponse(res, false, "Error canceling appointments", null, 500);
        }
        console.log(`Appointments were canceled for Salon ID ${appointment.SalonId}`);
      }
  
      // Define valid status transitions
      const validTransitions = {
        checked_in: ['in_salon', 'canceled'],
        appointment: ['canceled','completed'],
        in_salon: ['completed'],
        completed: [], // No transitions allowed
        canceled: [], // No transitions allowed
      };
  
      // Check if the new status is valid for the current status
      if (!validTransitions[appointment.status]?.includes(status)) {
        return sendResponse(
          res,
          false,
          `Sorry..!  You can't go back `,
          null,
          400
        );
      }
  
      // Check if the Barber is already serving another appointment in the Salon
      if (status === 'in_salon') {
        const activeAppointment = await Appointment.findOne({
          where: {
            BarberId: appointment.BarberId,
            SalonId: appointment.SalonId,
            status: 'in_salon',
          },
        });
  
        if (activeAppointment) {
          return sendResponse(
            res,
            false,
            "Sorry, this Barber is already serving another appointment.",
            null,
            400
          );
        }
  
        // Update status and perform corresponding actions
        appointment.in_salon_time = new Date();
        appointment.queue_position = 1; // Set priority queue position
        appointment.estimated_wait_time = 0; // Immediate service
      } else if (status === 'completed') {
        appointment.complete_time = status === 'completed' ? new Date() : null;
        appointment.estimated_wait_time = 0;
        appointment.queue_position = 0;

          // For appointment-based barbers (category 1), mark slots as completed
          if (barber.category === BarberCategoryENUM.ForAppointment) {
            // You might want to keep the slots marked as booked for record-keeping
            // or implement a new status for completed appointments' slots
        }

        const fcmTokens = await FcmToken.findAll({ where: { UserId: appointment.UserId } });
        if (fcmTokens.length > 0) {
          const notificationTitle = "Appointment completed";
          const notificationBody = `Your appointment has been completed. Thank you for choosing our service!`;
    
          for (const token of fcmTokens) {
            await sendNotificationToUser(token.token, notificationTitle, notificationBody);
          }
        }

      } else if ( status === 'canceled'){
        const canceledWaitTime = appointment.estimated_wait_time; // Initialize canceledWaitTime
        appointment.cancel_time = new Date();
 
        appointment.estimated_wait_time = 0;
        appointment.queue_position = 0;

        // Handle slot release based on barber category
        if (barber.category === BarberCategoryENUM.ForAppointment) {
            await releaseBookedSlots(appointment);
        } else if (barber.category === BarberCategoryENUM.ForWalkIn) {

          // Fetch the barber session
            const barberSession = await BarberSession.findOne({
                where: { BarberId: appointment.BarberId },
            });

            if (barberSession) {
                const totalServiceTime = appointment.Services.reduce((sum, service) => {
                    return sum + (service.default_service_time || 0);
                }, 0);

                let updatedRemainingTime = barberSession.remaining_time + totalServiceTime;
                const totalAvailableTime = barberSession.total_time;
                
                if (updatedRemainingTime > totalAvailableTime) {
                    updatedRemainingTime = totalAvailableTime;
                }

                await barberSession.update({ remaining_time: updatedRemainingTime });
            }

        }

        // Initiate refund if payment mode is Pay_Online
        if (appointment.paymentMode === PaymentMethodENUM.Pay_Online && appointment.stripePaymentIntentId) {
            const payment = await Payment.findOne({ where: { appointmentId: appointment.id } });
            if (payment && payment.paymentStatus === 'Success') {
                try {
                    const refund = await stripe.refunds.create({
                        payment_intent: appointment.stripePaymentIntentId,
                        reason: 'requested_by_customer',
                        metadata: {
                            appointmentId: appointment.id.toString(),
                            userId: appointment.UserId.toString(),
                        },
                    });

                    // Update Payment table immediately with refund initiation
                    await payment.update({
                        paymentStatus: 'Processing',
                        refundId: refund.id,
                        refundReason: 'requested_by_customer',
                    });

                    // Update Appointment table with processing status
                    await appointment.update({
                        paymentStatus: 'Processing',
                    });

                    console.log(`Refund initiated for Payment Intent ${appointment.stripePaymentIntentId}: Refund ID ${refund.id}`);
                } catch (refundError) {
                    console.error("Error initiating refund:", refundError);
                    return sendResponse(res, false, "Failed to initiate refund", null, 500);
                }
            }
        }

        // Send cancellation notification
        const fcmTokens = await FcmToken.findAll({ where: { UserId: appointment.UserId } });
        if (fcmTokens.length > 0) {
            const notificationTitle = "Appointment canceled";
            const notificationBody = `Your appointment has been canceled. If this was a mistake, please rebook your appointment`;

            for (const token of fcmTokens) {
                await sendNotificationToUser(token.token, notificationTitle, notificationBody);
            }
        }
    }

        
      appointment.status = status;
      await appointment.save();
  
      if (status === 'completed' || status === 'in_salon' || status === 'canceled'){
        // Recalculate wait times and queue positions
        await recalculateWaitTimesAndQueuePositionsForBarber(appointment.BarberId);
       
        // Fetch updated appointments and broadcast the updates
       const updatedAppointments = await getAppointmentsByRole(false);
       if(updatedAppointments)
       broadcastBoardUpdates(updatedAppointments);
      }


  
      // Notify the user about the updated wait time or status
      sendMessageToUser(appointment.UserId, 'waitTimeUpdate', appointment);
  
      const appointments = await Appointment.findAll({
        where: {
          BarberId: appointment.BarberId,
          status: ['checked_in', 'in_salon'],
        },
        include: [
          {
            model: Barber,
            as: 'Barber', // Include associated Barber
          },
        ],
      });
  
      appointments.forEach((element) => {
        // Notify users about the updated wait time or status
        sendMessageToUser(element.UserId, 'waitTimeUpdate', element);
      });

   
  
      return sendResponse(res, true, "Appointment status updated", appointment, 200);
    } catch (error) {
      return sendResponse(res, false, error.message, null, 500);
    }
};
  
/* Appointment update end */

// Cancel an appointment
exports.cancel = async (req, res) => {
    try {
        // Fetch the appointment by its ID with related services
        const appointment = await Appointment.findByPk(req.params.id, {
            include: [
                {
                    model: Service,
                    attributes: ['id', 'default_service_time'], // Ensure service time is fetched
                    through: { attributes: [] },
                },
            ],
        });

        const user = await db.USER.findByPk(appointment.UserId );

        if (!appointment) {
            return sendResponse(res, false, "Appointment not found", null, 404);
        }

        if (appointment.status === 'canceled') {
            return sendResponse(res, false, "Appointment is already canceled", null, 400);
        }

        // Get the barber to check category
        const barber = await db.Barber.findByPk(appointment.BarberId);

        const salon = await db.Salon.findOne({ where: { id: barber.SalonId } });
        const salonName = salon ? salon.name : 'the selected salon';
        const salonAddress = salon ? salon.address : 'the selected salon';


        // For appointment-based barbers (category 1), release the slots
        if (barber.category === BarberCategoryENUM.ForAppointment) {
            const slotsReleased = await releaseBookedSlots(appointment);
            if (!slotsReleased) {
                return sendResponse(res, false, "Error releasing appointment slots", null, 500);
            }
        } 
        // For walk-in barbers (category 2), handle remaining time
        else if (barber.category === BarberCategoryENUM.ForWalkIn) {
            const barberSession = await BarberSession.findOne({
                where: { BarberId: appointment.BarberId },
            });

            if (barberSession) {
                // Calculate the total service time to restore
                const totalServiceTime = appointment.Services.reduce((sum, service) => {
                    return sum + (service.default_service_time || 0);
                }, 0);

                // Calculate the new remaining time
                let updatedRemainingTime = barberSession.remaining_time + totalServiceTime;

                // Cap remaining time to the barber's total available time
                const totalAvailableTime = barberSession.total_time;
                if (updatedRemainingTime > totalAvailableTime) {
                    updatedRemainingTime = totalAvailableTime;
                }

                // Save the new remaining time to the database
                await barberSession.update({ remaining_time: updatedRemainingTime });
            }
        }

        // Check if payment mode is Pay_Online and initiate refund
        if (appointment.paymentMode === PaymentMethodENUM.Pay_Online && appointment.stripePaymentIntentId) {
            const payment = await Payment.findOne({ where: { appointmentId: appointment.id } });
            if (payment && payment.paymentStatus === 'Success') {
                try {
                    const refund = await stripe.refunds.create({
                        payment_intent: appointment.stripePaymentIntentId,
                        reason: 'requested_by_customer',
                        metadata: {
                            appointmentId: appointment.id.toString(),
                            userId: appointment.UserId.toString(),
                        },
                    });

                    // Update Payment table immediately with refund initiation
                    await payment.update({
                        paymentStatus: 'Processing', // Temporary status until webhook confirms
                        refundId: refund.id,
                        refundReason: 'requested_by_customer',
                    });

                    // Update Appointment table partially (status remains 'canceled' later)
                    await appointment.update({
                        paymentStatus: 'Processing',
                    });

                    console.log(`Refund initiated for Payment Intent ${appointment.stripePaymentIntentId}: Refund ID ${refund.id}`);
                } catch (refundError) {
                    console.error("Error initiating refund:", refundError);
                    return sendResponse(res, false, "Failed to initiate refund", null, 500);
                }
            }
        }

        // Update appointment status to canceled
        appointment.status = 'canceled';
        appointment.cancel_time = new Date();
        appointment.estimated_wait_time = 0;
        appointment.queue_position = 0;
        await appointment.save();

        // Recalculate wait times and queue positions for the barber
        await recalculateWaitTimesAndQueuePositionsForBarber(appointment.BarberId);

        const fcmTokens = await FcmToken.findAll({ where: { UserId: appointment.UserId } });
        if (fcmTokens.length > 0) {
          const notificationTitle = "Appointment canceled";
          const notificationBody = `Your appointment has been canceled. If this was a mistake, please rebook your appointment`;
    
          for (const token of fcmTokens) {
            await sendNotificationToUser(token.token, notificationTitle, notificationBody);
          }
        }

        // Fetch updated appointments and broadcast the updates
        const updatedAppointments = await getAppointmentsByRoleForAdmin(false);
        if(updatedAppointments)
        broadcastBoardUpdates(updatedAppointments);

     
     
        

        // // Send email notification
        let emailData;
        if (user) {
            emailData = {
                customer_name: appointment.name,
                barber_name: barber.name,
                appointment_date: appointment.appointment_date,
                appointment_start_time: `${appointment.appointment_start_time}`,
                salon_name: salonName,
                location: salonAddress,
                currentYear: new Date().getFullYear(),
                reschedule_url: `${process.env.FRONTEND_URL}/select_salon`,
                email_subject: "Your Appointment Has Been Canceled"
            };
            console.log("Email data:", emailData);

            await sendEmail(user.email, "Appointment Cancellation", INVITE_CANCEL_APPOINTMENT_TEMPLATE_ID, emailData);
            console.log("Email sent successfully.", user.email);
        }

        return sendResponse(res, true, "Appointment canceled successfully", null, 200);
    } catch (error) {
        console.error("Error canceling appointment:", error);
        return sendResponse(res, false, error.message || "Internal Server Error", null, 500);
    }
};


/* Checked_in appointment fetch start */

exports.findAll = async (req, res) => {
    const { page = 1, limit = 10, startDate, endDate, status, search, category } = req.query;
    const offset = (page - 1) * limit;

    try {
        if (!req.user) {
            return sendResponse(res, false, "User not authenticated", null, 401);
        }

        console.log("Authenticated user:", req.user);

        // Initialize appointment filter
        let appointmentFilter = {};

        const userRole = req.user.role;
        if (userRole === role.BARBER) {
            if (!req.user.barberId) {
                return sendResponse(res, false, "Unauthorized: Barber ID is missing.", null, 403);
            }
            appointmentFilter.BarberId = req.user.barberId;
        } else if ([role.SALON_OWNER, role.SALON_MANAGER].includes(userRole)) {
            if (!req.user.salonId) {
                return sendResponse(res, false, "Unauthorized: Salon ID is missing.", null, 403);
            }
            appointmentFilter.SalonId = req.user.salonId;
        } else if (userRole !== role.ADMIN) {
            return sendResponse(res, false, "Unauthorized: Invalid role.", null, 403);
        }

        // Date filters
        if (startDate || endDate) {
            if (category === "1") {
                // For category 1, only check appointment_date
                appointmentFilter.appointment_date = {
                    ...(startDate && { [Sequelize.Op.gte]: startDate }),
                    ...(endDate && { [Sequelize.Op.lte]: endDate })
                };
            } else if (category === "2") {
                // For category 2, appointment_date must be null
                appointmentFilter[Sequelize.Op.and] = [
                    { appointment_date: null },
                    {
                        createdAt: {
                            ...(startDate && { [Sequelize.Op.gte]: new Date(`${startDate}T00:00:00Z`) }),
                            ...(endDate && { [Sequelize.Op.lte]: new Date(`${endDate}T23:59:59Z`) }),
                        },
                    },
                ];
            } else {
                // For other categories, include createdAt and appointment_date
                appointmentFilter[Sequelize.Op.or] = [
                    {
                        createdAt: {
                            ...(startDate && { [Sequelize.Op.gte]: new Date(`${startDate}T00:00:00Z`) }),
                            ...(endDate && { [Sequelize.Op.lte]: new Date(`${endDate}T23:59:59Z`) }),
                        },
                    },
                ];
            }
        }

        // Status filter
        if (status === null || status === "" || status === undefined) {
            if (category === "1") {
                // Default statuses for category 1
                appointmentFilter.status = {
                    [Sequelize.Op.in]: [
                        AppointmentENUM.Canceled,
                        AppointmentENUM.Completed,
                        AppointmentENUM.Appointment,
                    ],
                };
            }
        } else {
            const allowedStatuses = [
                AppointmentENUM.In_salon,
                AppointmentENUM.Checked_in,
                AppointmentENUM.Canceled,
                AppointmentENUM.Completed,
                AppointmentENUM.Appointment,
            ];

            if (category === "1") {
                // For category 1, restrict statuses to Canceled, Completed, Appointment
                const allowedCategory1Statuses = [
                    AppointmentENUM.Canceled,
                    AppointmentENUM.Completed,
                    AppointmentENUM.Appointment,
                ];

                if (allowedCategory1Statuses.includes(status)) {
                    appointmentFilter.status = status;
                } else {
                    return sendResponse(
                        res,
                        false,
                        'Invalid status value for category 1. Allowed values are "canceled", "completed", "appointment".',
                        null,
                        400
                    );
                }
            } else {
                // For other categories, allow all statuses
                if (allowedStatuses.includes(status)) {
                    appointmentFilter.status = status;
                } else {
                    return sendResponse(
                        res,
                        false,
                        'Invalid status value. Allowed values are "in_salon", "checked_in", "canceled", "completed", "appointment".',
                        null,
                        400
                    );
                }
            }
        }

        // Search functionality
        const searchConditions = [];
        if (search) {
            searchConditions.push(
                Sequelize.literal(`"Barber"."name" ILIKE '%${search}%'`),
                Sequelize.literal(`"salon"."name" ILIKE '%${search}%'`),
                { name: { [Sequelize.Op.iLike]: `%${search}%` } }
            );
        }

        if (searchConditions.length > 0) {
            appointmentFilter[Sequelize.Op.or] = searchConditions;
        }

        // Fetch appointments with filters and pagination
        const appointments = await Appointment.findAndCountAll({
            where: appointmentFilter,
            limit: parseInt(limit),
            offset: parseInt(offset),
            distinct: true, // Ensures the count is distinct
            include: [
                {
                    model: Barber,
                    as: 'Barber',
                    attributes: ['id', 'name', 'availability_status', 'cutting_since', 'organization_join_date', 'photo', 'weekly_schedule'],
                    where: {
                        category: {
                            [Sequelize.Op.in]: [BarberCategoryENUM.ForAppointment, BarberCategoryENUM.ForWalkIn],
                        }
                    },
                },
                {
                    model: Salon,
                    as: 'salon',
                    attributes: ['id', 'name', 'address', 'phone_number', 'open_time', 'close_time', 'photos'],
                    required: true, // Ensures the table is included in the query
                },
                {
                    model: User,
                    as: 'User',
                    attributes: { exclude: ['password'] },
                },{
                    model: Service,
                    attributes: ['id', 'name', 'default_service_time'],
                    through: { attributes: [] },
                }
            ]
        });

        const totalPages = Math.max(1, Math.ceil(appointments.count / limit));

        return sendResponse(res, true, 'Fetched all appointments successfully', {
            totalItems: appointments.count,
            totalPages,
            currentPage: page,
            appointments: appointments.rows,
        }, 200);
    } catch (error) {
        console.error("Error fetching appointments:", error);
        return sendResponse(res, false, error.message, null, 500);
    }
};


/* Checked_in appointment fetch end */


/* furure appointment fetch start for calendar */

// API to fetch the all future appointments for the ADMIN calander
exports.findAllAppointments = async (req, res) => {
    const { 
        startDate, 
        endDate, 
        search,
        salonId,
        barberId
    } = req.query;

    try {
        if (!req.user) {
            return sendResponse(res, false, "User not authenticated", null, 401);
        }

        // Initialize appointment filter with Appointment status
        const appointmentFilter = {
            status: [AppointmentENUM.Appointment,AppointmentENUM.Completed] // Only fetch appointments
        };

        // Role-based access control
        const userRole = req.user.role;
        if (userRole === role.BARBER) {
            if (!req.user.barberId) {
                return sendResponse(res, false, "Unauthorized: Barber ID is missing.", null, 403);
            }
            appointmentFilter.BarberId = req.user.barberId;
        } else if ([role.SALON_OWNER, role.SALON_MANAGER].includes(userRole)) {
            if (!req.user.salonId) {
                return sendResponse(res, false, "Unauthorized: Salon ID is missing.", null, 403);
            }
            appointmentFilter.SalonId = req.user.salonId;
        } else if (userRole !== role.ADMIN) {
            return sendResponse(res, false, "Unauthorized: Invalid role.", null, 403);
        }

        // Filter by specific salon if provided
        if (salonId && (userRole === role.ADMIN || req.user.salonId === parseInt(salonId))) {
            appointmentFilter.SalonId = parseInt(salonId);
        }

        // Filter by specific barber if provided
        if (barberId) {
            appointmentFilter.BarberId = parseInt(barberId);
        }

        // Date filtering
        if (startDate || endDate) {
            appointmentFilter.appointment_date = {};
            if (startDate) {
                appointmentFilter.appointment_date[Sequelize.Op.gte] = new Date(startDate);
            }
            if (endDate) {
                appointmentFilter.appointment_date[Sequelize.Op.lte] = new Date(endDate);
            }
        }

        // Search filter
        if (search) {
            appointmentFilter[Sequelize.Op.or] = [
                { '$Barber.name$': { [Sequelize.Op.iLike]: `%${search}%` } },
                { '$salon.name$': { [Sequelize.Op.iLike]: `%${search}%` } },
                { name: { [Sequelize.Op.iLike]: `%${search}%` } }
            ];
        }

        // Fetch appointments without pagination
        const appointments = await Appointment.findAll({
            where: appointmentFilter,
            include: [
                {
                    model: Barber,
                    as: 'Barber',
                    attributes: { exclude: ['createdAt', 'updatedAt'] },
                    where: { category: BarberCategoryENUM.ForAppointment },
                    required: true
                },
                {
                    model: Salon,
                    as: 'salon',
                    attributes: [
                        'id', 
                        'name', 
                        'address', 
                        'phone_number',
                        'open_time',
                        'close_time'
                    ]
                },
                {
                    model: User,
                    as: 'User',
                    attributes: { exclude: ['password'] }
                },
                { 
                    model: Service, 
                    attributes: ['id', 'name', 'default_service_time'],
                    through: { attributes: [] }
                }
            ],
            order: [
                ['appointment_date', 'ASC'],
                ['appointment_start_time', 'ASC']
            ]
        });

        // Fetch haircut details for each appointment with a valid user
        const appointmentsWithDetails = await Promise.all(
            appointments.map(async (apt) => {
                const userId = apt.User?.id;
                let haircutDetails = [];
                
                if (userId) {
                    haircutDetails = await HaircutDetails.findAll({
                        where: { UserId: userId }
                    });
                }

                return {
                    id: apt.id,
                    appointment_date: apt.appointment_date,
                    number_of_people:apt.number_of_people,
                    estimated_wait_time:apt.estimated_wait_time,
                    queue_position : apt.queue_position,
                    mobile_number : apt.mobile_number,
                    name : apt.name,
                    check_in_time : apt.check_in_time,
                    in_salon_time:apt.in_salon_time,
                    complete_time :apt.complete_time,
                    cancel_time:apt.cancel_time,
                    BarberId:apt.BarberId,
                    SalonId: apt.SalonId,
                    status:apt.status,
                    time_slot: {
                        start: apt.appointment_start_time,
                        end: apt.appointment_end_time
                    },
                    status: apt.status,
                    Services: apt.Services,
                    User: apt.User,
                    Barber: {
                        name: apt.Barber?.name,
                        photo: apt.Barber?.photo,
                        availability: apt.Barber?.availability_status,
                        weekly_schedule: apt.Barber?.weekly_schedule,
                        background_color: apt.Barber?.background_color
                    },
                    salon: apt.salon,
                    haircutDetails: haircutDetails
                };
            })
        );

        const responseData = {
            appointments: appointmentsWithDetails
        };


        return sendResponse(res, true, 'Fetched appointments successfully', responseData, 200);

    } catch (error) {
        console.error("Error fetching appointments:", error);
        return sendResponse(res, false, error.message, null, 500);
    }
};

/* furure appointment fetch end for calendar */



// Get an appointment by ID for customer side 
exports.findOne = async (req, res) => {
    try {
        const { role: userRole, id: userId } = req.user; // Extract role and user ID from token
        const appointmentId = req.params.id;

        if (!appointmentId) {
            return sendResponse(res, false, "Appointment ID is required", null, 400);
        }

        let whereCondition = { id: appointmentId }; // Default condition: fetch by appointment ID
        let barberId = null;

        // Role-specific logic
        if (userRole === role.BARBER) {
            // Fetch Barber ID for the logged-in user
            const barber = await Barber.findOne({ where: { UserId: userId } });
            if (!barber) {
                return sendResponse(
                    res,
                    false,
                    "No barber profile found for this user",
                    null,
                    404
                );
            }
            barberId = barber.id;
            whereCondition.BarberId = barberId; // Barbers can only access their own appointments
        } else if (userRole === role.CUSTOMER) {
            // Customers can only access their own appointments
            whereCondition.UserId = userId;
        } else if (userRole === role.SALON_OWNER) {
            // Salon Owners can access appointments related to their salon's barbers
            const salon = await Salon.findOne({ where: { UserId: userId } });
            if (!salon) {
                return sendResponse(
                    res,
                    false,
                    "No salon profile found for this user",
                    null,
                    404
                );
            }
            whereCondition.SalonId = salon.id;
        } else if (userRole === role.SALON_MANAGER) {
            // Salon Managers can access appointments related to their assigned salon
            const userSalon = await UserSalon.findOne({ where: { UserId: userId } }); // Fetch assigned salon for the manager
            if (!userSalon) {
                return sendResponse(
                    res,
                    false,
                    "No assigned salon found for this manager",
                    null,
                    404
                );
            }

            const salonRole = await Salon.findOne({ where: { id: userSalon.SalonId } }); // Fetch salon details
            if (!salonRole) {
                return sendResponse(
                    res,
                    false,
                    "No salon profile found for this manager",
                    null,
                    404
                );
            }
            whereCondition.SalonId = salonRole.id; // Restrict appointments to the manager's assigned salon
        } else if (userRole !== role.ADMIN) {
            // For undefined roles, deny access
            return sendResponse(res, false, "Unauthorized access", null, 403);
        }

        // Fetch the appointment with Salon and Barber data
        const appointment = await Appointment.findOne({
            where: whereCondition,
            include: [
                {
                    model: Salon,
                    as: 'salon',
                    attributes: { exclude: ['createdAt', 'updatedAt'] },
                },
                {
                    model: Barber,
                    as: 'Barber',
                    attributes: { exclude: ['createdAt', 'updatedAt'] },
                    where: {
                        [Op.or]: [
                            { category: BarberCategoryENUM.ForWalkIn }, // Include ForWalkIn category
                            { category: BarberCategoryENUM.ForAppointment } // Include ForAppointment category
                        ]
                    }
                },
                { 
                    model: Service, 
                    attributes: ['id','name','min_price', 'max_price', 'default_service_time'], // Fetch the 'estimated_service_time' from the Service model
                    through: { attributes: [] } // Avoid extra attributes from the join table
                }
            ],
        });

        if (!appointment) {
            return sendResponse(res, false, "Appointment not found", null, 404);
        }
       
            // Manually fetch associated services
            const appointmentServices = await AppointmentService.findAll({
                where: {
                    AppointmentId: appointment.id
                }
            });
            const serviceIds = appointmentServices.map(as => as.ServiceId);
            // Get all service IDs
            const servicesMap = await Service.findAll({
                where: {
                    id: serviceIds
                },
                attributes: ['id', 'name', 'min_price', 'max_price', 'default_service_time']
            }).then(services => {
                // Create a map of services by ID for quick lookup
                return services.reduce((map, service) => {
                    map[service.id] = service;
                    return map;
                }, {});
            });

            // Map back to maintain order and duplicates
            const services = appointmentServices.map(as => servicesMap[as.ServiceId]);
        
            // Add services to appointment object
            appointment.dataValues.Services = services;

            // Fetch payment details for this appointment using appointmentId
            const payment = await Payment.findOne({
                where: { appointmentId: appointment.id },
                attributes: { exclude: ['createdAt', 'updatedAt', 'deletedAt'] }, // Exclude unnecessary fields
            });

            // Initialize receiptUrl
            let receiptUrl = null;

            // Get receipt URL if payment exists
            if (payment) {
                try {
                    const paymentIntent = await stripe.paymentIntents.retrieve(payment.paymentIntentId);
                    receiptUrl = paymentIntent.charges?.data[0]?.receipt_url;

                    // If not found in charges array, fetch from latest_charge
                    if (!receiptUrl && paymentIntent.latest_charge) {
                        const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
                        receiptUrl = charge.receipt_url;
                    }
                } catch (error) {
                    console.error(`Error retrieving receipt URL for payment ${payment.id}:`, error);
                }
            }

            // Prepare payment details (if payment exists)
            const paymentDetails = payment ? {
                id: payment.id,
                amount: payment.amount,
                tip: payment.tip,
                tax: payment.tax,
                discount: payment.discount,
                totalAmount: payment.totalAmount,
                currency: payment.currency,
                paymentStatus: payment.paymentStatus,
                receiptUrl: receiptUrl, // Add the receipt URL here
            } : null;
     

            // Additional logic for customers: Check if the salon is liked
            let isLike = false;
            if (userRole === role.CUSTOMER) {
                const favoriteSalon = await FavoriteSalon.findOne({
                    where: {
                        UserId: userId,
                        SalonId: appointment.SalonId,
                        status: "like",
                    },
                });
                isLike = !!favoriteSalon;
            }

        return sendResponse(res, true, "Fetched appointment successfully", {
            ...appointment.toJSON(),
            Service: services,
            payment: paymentDetails, // Add payment details (or null if no payment exists)
            is_like: isLike,
        }, 200);
    } catch (error) {
        console.error("Error fetching appointment:", error.message);
        return sendResponse(res, false, error.message || "Internal server error", null, 500);
    }
};



// Get an appointment by UserID
exports.findAppointmentUser = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;

        if (!userId) {
            return sendResponse(res, false, "Token is required", null, 400);
        }

        // Fetch appointments for the user
        const appointments = await Appointment.findAll({
            where: {
                UserId: userId,
                status: {
                    [Op.or]: [
                        AppointmentENUM.Checked_in,
                        AppointmentENUM.In_salon,
                        AppointmentENUM.Appointment,
                        AppointmentENUM.Completed,
                        AppointmentENUM.Canceled,
                    ],
                },
            },
            include: [
                {
                    model: Salon,
                    as: 'salon',
                    attributes: { exclude: ['createdAt', 'updatedAt'] },
                },
                {
                    model: Barber,
                    as: 'Barber',
                    attributes: { exclude: ['createdAt', 'updatedAt'] },
                },
            ],
        });

        // Fetch payment details for each appointment using appointmentId
        const appointmentsWithPayments = await Promise.all(appointments.map(async (appointment) => {
            let category = '';

            // Determine category based on BarberCategoryENUM
            if (appointment.Barber && appointment.Barber.category === BarberCategoryENUM.ForAppointment) {
                category = 'Appointment';
            } else if (appointment.Barber && appointment.Barber.category === BarberCategoryENUM.ForWalkIn) {
                category = 'Checked in';
            }

            // Fetch payment for this appointment using appointmentId
            const payment = await Payment.findOne({
                where: { appointmentId: appointment.id },
                attributes: { exclude: ['createdAt', 'updatedAt', 'deletedAt'] }, // Exclude unnecessary fields
            });

            // Initialize receiptUrl
            let receiptUrl = null;

            // Get receipt URL if payment exists
            if (payment) {
                try {
                    const paymentIntent = await stripe.paymentIntents.retrieve(payment.paymentIntentId);
                    receiptUrl = paymentIntent.charges?.data[0]?.receipt_url;

                    // If not found in charges array, fetch from latest_charge
                    if (!receiptUrl && paymentIntent.latest_charge) {
                        const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
                        receiptUrl = charge.receipt_url;
                    }
                } catch (error) {
                    console.error(`Error retrieving receipt URL for payment ${payment.id}:`, error);
                }
            }

            // Prepare payment details (if payment exists)
            const paymentDetails = payment ? {
                id: payment.id,
                amount: payment.amount,
                tip: payment.tip,
                tax: payment.tax,
                discount: payment.discount,
                totalAmount: payment.totalAmount,
                currency: payment.currency,
                paymentStatus: payment.paymentStatus,
                receiptUrl: receiptUrl, // Add the receipt URL here
            } : null;

            return {
                ...appointment.toJSON(), // Convert Sequelize instance to plain object
                category,
                payment: paymentDetails, // Add payment details (or null if no payment exists)
            };
        }));

        return sendResponse(res, true, 'Fetched appointments successfully', appointmentsWithPayments, 200);
    } catch (error) {
        console.error('Error fetching appointments:', error.stack || error.message); // Log full error for debugging
        return sendResponse(res, false, error.message || 'Internal server error', null, 500);
    }
};

// Get the waitlist position with neighbors
exports.getWaitlistPositionWithNeighbors = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null; // Get user ID from the token
        const appointmentId = req.params.id;

        // Ensure user ID is available
        if (!userId) {
            return sendResponse(res, false, "Unauthorized access", null, 401);
        }

        // Find the current appointment
        const currentAppointment = await Appointment.findByPk(appointmentId, {
            attributes: ['id', 'queue_position', 'status', 'BarberId', 'number_of_people'],
            include: [{ model: User, as: 'User', attributes: ['id', 'firstname', 'lastname', 'username'] }]
        });

        // If the appointment is not found
        if (!currentAppointment) {
            return sendResponse(res, false, "Appointment not found", null, 404);
        }

        // Get the BarberId from the current appointment
        const barberId = currentAppointment.BarberId;

        // Find all appointments for the same barber with status 'checked_in' or 'in_salon'
        const appointments = await Appointment.findAll({
            where: {
                BarberId: barberId,
                status: [AppointmentENUM.Checked_in,AppointmentENUM.In_salon]
            },
            order: [['queue_position', 'ASC']],
            attributes: ['queue_position', 'status', 'number_of_people'],
            include: [{ model: User, as: 'User', attributes: ['id', 'firstname', 'lastname', 'username'] }]
        });

        // Format the response with the required structure
        const formattedAppointments = appointments.map((app) => {
            const isCurrentUser = app.User?.id === userId; // Check if the user is the current user
            const fullName = `${app.User?.firstname || ''} ${app.User?.lastname || ''}`.trim() || 'N/A'; // Full name for the current user
            const maskedName = `${(app.User?.firstname?.charAt(0) || '').toUpperCase()}${(app.User?.lastname?.charAt(0) || '').toUpperCase()}`.trim();
            // Masked name for others

            return {
                no: app.queue_position, // Use the actual queue position
                username: isCurrentUser ? fullName : maskedName || 'N/A',
                status: app.status,
                isCurrentUser,
                currentPosition: currentAppointment.queue_position,
                barberId: barberId,
                number_of_people: app.number_of_people // Add the number of people field
            };
        });

        // Return the formatted waitlist with highlighted current user
        return sendResponse(res, true, `Fetched appointment waitlist for Barber ID ${barberId} with current user highlighted`,formattedAppointments, 200);

    } catch (error) {
        return sendResponse(res, false, error.message || 'Internal server error', null, 500);
    }
};

// Get Appointment Details by ID (including related User, HaircutDetails, Barber, and Salon) // Admin side 
exports.getAppointmentDetails = async (req, res) => {
    try {
        // Get the appointment ID from the URL parameter
        const appointmentId = req.params.id;

        // Fetch the appointment along with related models (User, Barber, Salon)
        const appointment = await Appointment.findByPk(appointmentId, {
            include: [
                {
                    model: User,
                    as: 'User',
                    attributes: { exclude: ['password'] }, // Exclude password field
                },
                {
                    model: Barber,
                    as: 'Barber',
                },
                {
                    model: Salon,
                    as: 'salon',
                }
            ]
        });

        // If the appointment is not found, return an error
        if (!appointment) {
            return sendResponse(res, false, "Appointment not found", null, 404);
        }

        // Fetch HaircutDetails using user_id from the fetched appointment
        const userId = appointment.User.id;
        const haircutDetails = await HaircutDetails.findOne({
            where: { UserId: userId },
        });

        // Send response with the appointment details, including fetched HaircutDetails
        return sendResponse(res, true, "Appointment details fetched successfully", {
            appointment,
            haircutDetails,
        }, 200);
    } catch (error) {
        // Handle any errors that occur during the process
        return sendResponse(res, false, error.message || 'Internal server error', null, 500);
    }
};

// Add time to estimated wait time
exports.addTimeToEstimatedWaitTime = async (req, res) => {
    try {
        const { additionalTime } = req.body;
        const appointmentId = req.params.id;

        // Validate the additionalTime
        if (isNaN(additionalTime) || additionalTime <= 0) {
            return sendResponse(res, false, "Invalid additional time. Please provide a positive number.", null, 400);
        }

        // Find the appointment by ID
        const appointment = await Appointment.findByPk(appointmentId);
        if (!appointment) {
            return sendResponse(res, false, "Appointment not found", null, 404);
        }

        // Add additional time to the estimated wait time for the current appointment
        appointment.estimated_wait_time += additionalTime;
        await appointment.save();

        // Fetch all appointments for the barber in queue order
        const appointments = await Appointment.findAll({
            where: { BarberId: appointment.BarberId, status: [AppointmentENUM.Checked_in,AppointmentENUM.In_salon] },
            order: [['queue_position', 'ASC']]
        });

        // Recalculate wait times for all appointments
        const barber = await Barber.findByPk(appointment.BarberId);
        if (!barber) {
            throw new Error("Barber not found");
        }

        let previousEstimatedWaitTime = 0;

        // Update each appointment's wait time
        for (let i = 0; i < appointments.length; i++) {
            const currentAppointment = appointments[i];

            if (i === 0) {
                // The first appointment in the queue (this one has already been updated)
                currentAppointment.estimated_wait_time = previousEstimatedWaitTime;
            } else {
                // For subsequent appointments, add the first user's additional time
                currentAppointment.estimated_wait_time += additionalTime;
            }

            // Save the updated wait time (without changing the queue_position)
            await currentAppointment.save();

            // Update the previous estimated wait time
            previousEstimatedWaitTime = currentAppointment.estimated_wait_time;
        }

        // Send the response
        return sendResponse(res, true, "Estimated wait time updated successfully for all affected appointments", appointments, 200);

    } catch (error) {
        return sendResponse(res, false, error.message || 'Internal server error', null, 500);
    }
};

const getAppointmentsByRole = async (ischeckRole,user) => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        let whereCondition = {
            createdAt: {
                [Op.between]: [startOfToday, endOfToday]
            },
            status: [AppointmentENUM.Checked_in,AppointmentENUM.In_salon,AppointmentENUM.Completed,AppointmentENUM.Canceled]
        };

        if(ischeckRole){
            if(user.role === role.BARBER){
                whereCondition.BarberId = user.barberId;
            }else if(user.role === role.SALON_OWNER || user.role === role.SALON_MANAGER){
                whereCondition.SalonId = user.salonId;
            }
        }

        // Add condition to only fetch appointments where the barber category is 'walk_in' (category 2)
        whereCondition['$Barber.category$'] = BarberCategoryENUM.ForWalkIn;


         // Fetch appointments
        const appointments = await Appointment.findAll({
            where: whereCondition,
            attributes: ['id', 'number_of_people', 'status', 'estimated_wait_time', 'queue_position', 'mobile_number', 'name', 'check_in_time', 'in_salon_time', 'complete_time', 'cancel_time', 'BarberId','SalonId'],
            include: [
                { model: User, as: 'User', attributes: ['id','firstname','lastname', 'profile_photo'] },
                { model: Barber, as: 'Barber', attributes: ['name','background_color'] },
                { model: Salon, as: 'salon', attributes: ['name'] },
                { model: Service, attributes: ['id','name', 'default_service_time'] },
            ],
            order: [['check_in_time', 'ASC']] // Optional: order by check-in time
        });

        if (appointments.length === 0) {
            return;
        }

        // Ensure each appointment's User is valid before attempting to access haircut details
        const appointmentsWithHaircutDetails = await Promise.all(
            appointments.map(async (appointment) => {
                const userId = appointment.User ? appointment.User.id : null;
    
                if (userId) {
                    const haircutDetails = await HaircutDetails.findAll({
                        where: { UserId: userId },
                    });
                    appointment.dataValues.haircutDetails = haircutDetails;
                }

                // Fetch payment details for this appointment using appointmentId
                const payment = await Payment.findOne({
                    where: { appointmentId: appointment.id },
                    attributes: { exclude: ['createdAt', 'updatedAt', 'deletedAt'] }, // Exclude unnecessary fields
                });

                // Initialize receiptUrl
                let receiptUrl = null;

                if (payment) {
                    try {
                        const paymentIntent = await stripe.paymentIntents.retrieve(payment.paymentIntentId);
                        receiptUrl = paymentIntent.charges?.data[0]?.receipt_url;

                        // If not found in charges array, fetch from latest_charge
                        if (!receiptUrl && paymentIntent.latest_charge) {
                            const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
                            receiptUrl = charge.receipt_url;
                        }
                    } catch (error) {
                        console.error(`Error retrieving receipt URL for payment ${payment.id}:`, error);
                    }
                }

                // Prepare payment details (if payment exists)
                appointment.dataValues.paymentDetails = payment ? {
                    id: payment.id,
                    amount: payment.amount,
                    tip: payment.tip,
                    tax: payment.tax,
                    discount: payment.discount,
                    totalAmount: payment.totalAmount,
                    currency: payment.currency,
                    paymentStatus: payment.paymentStatus,
                    receiptUrl: receiptUrl, // Include receipt URL here
                } : null;

                    
                return appointment;
            })
        );
    
        return appointmentsWithHaircutDetails;
};

const getAppointmentsByRoleForAdmin = async (ischeckRole,user) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    let whereCondition = {
        createdAt: {
            [Op.between]: [startOfToday, endOfToday]
        },
        status: [AppointmentENUM.Checked_in,AppointmentENUM.In_salon,AppointmentENUM.Completed,AppointmentENUM.Canceled]
    };

    if(ischeckRole){
        if(user.role === role.BARBER){
            whereCondition.BarberId = user.barberId;
        }else if(user.role === role.SALON_OWNER || user.role === role.SALON_MANAGER){
            whereCondition.SalonId = user.salonId;
        }
    }

    // Add condition to only fetch appointments where the barber category is 'walk_in' (category 2)
    whereCondition['$Barber.category$'] = BarberCategoryENUM.ForWalkIn;


     // Fetch appointments
    const appointments = await Appointment.findAll({
        where: whereCondition,
        attributes: ['id', 'number_of_people', 'status', 'estimated_wait_time', 'queue_position', 'mobile_number', 'name', 'check_in_time', 'in_salon_time', 'complete_time', 'cancel_time', 'BarberId','SalonId'],
        include: [
            { model: User, as: 'User', attributes: ['id','firstname','lastname', 'profile_photo'] },
            { model: Barber, as: 'Barber', attributes: ['name','background_color'] },
            { model: Salon, as: 'salon', attributes: ['name'] },
            { model: Service, attributes: ['id','name', 'default_service_time'] },
        ],
        order: [['check_in_time', 'ASC']] // Optional: order by check-in time
    });

    if (appointments.length === 0) {
        return;
    }

    // Ensure each appointment's User is valid before attempting to access haircut details
    const appointmentsWithHaircutDetails = await Promise.all(
        appointments.map(async (appointment) => {
            const userId = appointment.User ? appointment.User.id : null;

            if (userId) {
                const haircutDetails = await HaircutDetails.findAll({
                    where: { UserId: userId },
                });
                appointment.dataValues.haircutDetails = haircutDetails;
            }
                
            return appointment;
        })
    );

    return appointmentsWithHaircutDetails;
};

exports.getAppointmentsByRoleForAdminExp = getAppointmentsByRoleForAdmin;

const getInSalonAppointmentsByRole = async (ischeckRole,user) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    let whereCondition = {
        createdAt: {
            [Op.between]: [startOfToday, endOfToday]
        },
        status: [ 'in_salon']
    };

    if(ischeckRole){
        if(user.role === role.BARBER){
            whereCondition.BarberId = user.barberId;
        }else if(user.role === role.SALON_OWNER){
            whereCondition.SalonId = user.salonId;
        }
    }

     // Fetch appointments
    const appointments = await Appointment.findAll({
        where: whereCondition,
        attributes: ['id', 'number_of_people', 'status', 'estimated_wait_time', 'queue_position', 'mobile_number', 'name', 'check_in_time', 'in_salon_time', 'complete_time', 'cancel_time', 'BarberId','SalonId'],
        include: [
            { model: User, as: 'User', attributes: ['id','firstname','lastname','profile_photo'] },
            { model: Barber, as: 'Barber', attributes: ['name','background_color'] },
            { model: Salon, as: 'salon', attributes: ['name'] },
        ],
        order: [['check_in_time', 'ASC']] // Optional: order by check-in time
    });

    if (appointments.length === 0) {
        return;
    }

    return appointments;
};

// Board find Data
exports.findAllBoardData = async (req, res) => {
    try {

        if (!req.user) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        console.log("Authenticated user:", req.user);

             // Fetch appointments using the utility function
        const appointments = await getAppointmentsByRole(true,req.user);

        if (!appointments || appointments.length === 0) {
            return sendResponse(res, true, "No appointments booked yet!", null, 200);
        }

        // Send the response with the fetched appointments and their details
        return sendResponse(res, true, "Appointments fetched successfully", appointments, 200);

    } catch (error) {
        console.error('Error fetching appointments:', error);
        return sendResponse(res, false, error.message || 'Failed to fetch appointments', null, 500);
    }
};


//find InSalon Users
exports.findInSalonUsers = async (req, res) => {
    try {

        if (!req.user) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        console.log("Authenticated user:", req.user);

             // Fetch appointments using the utility function
        const appointments = await getInSalonAppointmentsByRole(true,req.user);

        if (!appointments || appointments.length === 0) {
            return sendResponse(res, true, "No appointments booked yet!", null, 200);
        }

        // Send the response with the fetched appointments and their details
        return sendResponse(res, true, "Appointments fetched successfully", appointments, 200);

    } catch (error) {
        console.error('Error fetching appointments:', error);
        return sendResponse(res, false, error.message || 'Failed to fetch appointments', null, 500);
    }
};


exports.appointmentByBarber = async (req, res) => {
    const {
        firstname,
        lastname,
        email,
        mobile_number,
        number_of_people,
        barber_id: barberIdFromBody,
        service_ids,
        slot_id,
        payment_mode,
        tip
    } = req.body;

    try {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

        // Validate required fields
        if (!firstname || !lastname || !email || !mobile_number || !number_of_people || !Array.isArray(service_ids) || service_ids.length === 0) {
            return sendResponse(res, false, 'All fields are required, including valid services', null, 400);
        }

        const barber_id = req.user?.barberId || barberIdFromBody;

        const barber = await Barber.findOne({
            where: { id: barber_id },
            include: [{
                model: Salon,
                as: 'salon'
            }],
        });

        if (!barber || !barber.salon) {
            return sendResponse(res, false, "The barber does not belong to a salon.", null, 400);
        }

        const salon_id = barber.salon.id;

        let user = null;

        const userExists = await User.findOne({ where: { email } });
        if (userExists) {
            user = userExists;
        } else {
            const userRole = await roles.findOne({ where: { role_name: role.CUSTOMER } });
            if (!userRole) {
                return sendResponse(res, false, "User role not found", null, 404);
            }

            const baseUsername = `${firstname.toLowerCase()}_${lastname.toLowerCase()}`;
            let username = baseUsername;
            let userWithSameUsername = await User.findOne({ where: { username } });

            let counter = 1;
            while (userWithSameUsername) {
                username = `${baseUsername}${counter}`;
                userWithSameUsername = await User.findOne({ where: { username } });
                counter++;
            }

            const generateRandomPassword = () => Math.random().toString(36).slice(-10);
            const plainPassword = generateRandomPassword();
            const hashedPassword = await bcrypt.hash(plainPassword, 10);

            user = await User.create({
                username,
                firstname,
                lastname,
                email,
                google_token: "",
                profile_photo: null,
                password: hashedPassword,
                RoleId: userRole.id,
                address: "",
                mobile_number
            });

            const customerData = {
                email,
                password: plainPassword,
                company_name: 'Shear Brilliance',
                name: `${firstname} ${lastname}`,
                currentYear: new Date().getFullYear(),
                email_subject: 'Added as a Customer',
            };

            await sendEmail(email, "Added as a Customer", INVITE_CUSTOMER_WITH_PASSWORD_TEMPLATE_ID, customerData);
            console.log(`Generated password for user: ${plainPassword}`);
        }

        const activeAppointment = await Appointment.findOne({
            where: {
                UserId: user.id,
                status: [AppointmentENUM.Checked_in, AppointmentENUM.In_salon]
            }
        });

        if (activeAppointment) {
            return sendResponse(res, false, "You already have an active appointment. Please complete or cancel it before booking a new one.", null, 400);
        }

        const services = await Service.findAll({
            where: { id: service_ids },
            attributes: ['default_service_time']
        });

        // Fetch barber-specific service prices
        const barberServices = await db.BarberService.findAll({
            where: {
                BarberId: barber_id,
                ServiceId: { [db.Sequelize.Op.in]: [...new Set(service_ids)] },
            },
            attributes: ['ServiceId', 'price'],
        });

        // Create a map of barber-specific prices for quick lookup
        const barberServicePriceMap = barberServices.reduce((map, bs) => {
            map[bs.ServiceId] = Number(bs.price);
            return map;
        }, {});

        const serviceFrequency = service_ids.reduce((freq, id) => {
            freq[id] = (freq[id] || 0) + 1;
            return freq;
        }, {});

        const totalServiceTime = services.reduce((sum, service) => {
            return sum + (service.default_service_time * (serviceFrequency[service.id] || 0));
        }, 0);

        const totalServiceCost = services.reduce((sum, service) => {
            const frequency = serviceFrequency[service.id] || 0;
            // Use barber-specific price if available, otherwise fall back to min_price
            const servicePrice = barberServicePriceMap[service.id] !== undefined 
                ? barberServicePriceMap[service.id] 
                : Number(service.min_price);
            return sum + (servicePrice * frequency);
        }, 0);

        const tax = parseFloat((totalServiceCost * 0.13).toFixed(2));
        const validatedTip = isNaN(tip) ? 0 : Number(tip);
        const totalAmount = parseFloat((totalServiceCost + tax + validatedTip).toFixed(2));

        // Define name explicitly here
        const name = `${firstname} ${lastname}`;

        let appointmentData = {
            BarberId: barber_id,
            SalonId: salon_id,
            UserId: user.id,
            number_of_people,
            mobile_number,
            name, // Use the defined name here
            tax,
            tip: validatedTip,
            total_amount: totalAmount
        };

        if (barber.category === BarberCategoryENUM.ForWalkIn) {
            let barberSession = await BarberSession.findOne({
                where: {
                    BarberId: barber_id,
                    session_date: {
                        [Op.between]: [todayStart, todayEnd]
                    }
                }
            });

            if (!barberSession) {
                return sendResponse(res, false, 'Barber is not available for appointments today', null, 400);
            }

            const activeBarberAppointments = await Appointment.findAll({
                where: {
                    BarberId: barber_id,
                    status: [AppointmentENUM.Checked_in, AppointmentENUM.In_salon]
                },
            });

            let remainingTime = calculateRemainingTime(barberSession, activeBarberAppointments);
            if (remainingTime < totalServiceTime) {
                return sendResponse(res, false, 'Not enough remaining time for this appointment', null, 400);
            }

            const { totalWaitTime, numberOfUsersInQueue } = await getEstimatedWaitTimeForBarber(barber_id);

            appointmentData = {
                ...appointmentData,
                status: AppointmentENUM.Checked_in,
                estimated_wait_time: totalWaitTime,
                queue_position: numberOfUsersInQueue + 1,
                check_in_time: new Date(),
            };

            await barberSession.update({
                remaining_time: remainingTime - totalServiceTime
            });
            console.log(`Updated remaining time for barber session: ${remainingTime - totalServiceTime}`);
        } else {
            if (!slot_id) {
                return sendResponse(res, false, 'Slot ID is required for scheduled appointments', null, 400);
            }

            const slot = await db.Slot.findOne({
                where: {
                    id: slot_id,
                    is_booked: false
                }
            });

            if (!slot) {
                return sendResponse(res, false, 'Selected slot is not available', null, 400);
            }

            const startTime = new Date(`${slot.slot_date} ${slot.start_time}`);
            const endTime = new Date(startTime.getTime() + totalServiceTime * 60000);

            const requiredSlots = await verifyConsecutiveSlots(
                slot.BarberSessionId,
                slot.slot_date,
                slot.start_time,
                totalServiceTime
            );

            if (!requiredSlots) {
                return sendResponse(res, false, 'Not enough consecutive slots available', null, 400);
            }

            appointmentData = {
                ...appointmentData,
                status: AppointmentENUM.Appointment,
                SlotId: slot_id,
                appointment_date: slot.slot_date,
                appointment_start_time: slot.start_time,
                appointment_end_time: endTime.toTimeString().split(' ')[0],
            };

            await markSlotsAsBooked(requiredSlots);
        }

        if (payment_mode === PaymentMethodENUM.Pay_In_Person) {
            appointmentData = {
                ...appointmentData,
                paymentStatus: 'Pending',
                paymentMode: PaymentMethodENUM.Pay_In_Person,
            };
        }

        const appointment = await Appointment.create(appointmentData);

        if (payment_mode === PaymentMethodENUM.Pay_In_Person) {
            await Payment.create({
                appointmentId: appointment.id,
                UserId: user.id,
                amount: totalServiceCost,
                tax: tax,
                tip: validatedTip,
                totalAmount: totalAmount,
                paymentStatus: 'Pending',
                paymentMethod: PaymentMethodENUM.Pay_In_Person,
            });

            const validServices = await validateAndAttachServices(appointment, service_ids, res);
            if (res.headersSent) return;

            const appointmentWithServices = await fetchAppointmentWithServices(appointment.id);

            if (appointmentWithServices) {
                const salon = await db.Salon.findByPk(salon_id);
                const emailData = prepareEmailData(
                    appointment,
                    barber,
                    salon,
                    appointmentWithServices.dataValues.Services,
                    validatedTip,
                    tax,
                    totalAmount
                );

                const email = user.email;

                await sendEmail(email, "Your Appointment Book Successfully", INVITE_BOOKING_APPOINTMENT_TEMPLATE_ID, emailData);
            }

            if (barber.category === BarberCategoryENUM.ForWalkIn) {
                const updatedAppointments = await getAppointmentsByRoleForAdmin(false);
                if (updatedAppointments)
                    broadcastBoardUpdates(updatedAppointments);
            }

            // Use the defined name and user.id here
            await sendAppointmentNotifications(appointment, name, mobile_number, user.id, salon_id);

            return sendResponse(res, true, 'Appointment created successfully', appointmentWithServices, 201);
        }
    } catch (error) {
        console.error('Error creating appointment:', error);
        return sendResponse(res, false, error.message || 'An error occurred while creating the appointment', null, 500);
    }
};


exports.getLastHaircutDetails = async (req, res) => {
    try {
        const { appointmentId } = req.params;

        // First fetch current appointment to get userId
        const currentAppointment = await Appointment.findByPk(appointmentId);
        
        if (!currentAppointment) {
            return res.status(404).json({ message: 'Current appointment not found.' });
        }

        // Find last completed appointment
        const lastAppointment = await Appointment.findOne({
            where: { 
                UserId: currentAppointment.UserId, 
                status: 'completed',
                id: { [Op.ne]: appointmentId }
            },
            order: [['complete_time', 'DESC']]
        });

        if (!lastAppointment) {
            return res.status(404).json({ 
                message: 'No previous completed appointments found for this user.' 
            });
        }

        // Fetch haircut details separately
        const haircutDetails = await HaircutDetails.findOne({
            where: { AppointmentId: lastAppointment.id }
        });

        if (!haircutDetails) {
            return res.status(404).json({ 
                message: 'No haircut details found for the last appointment.' 
            });
        }

        // Combine the data
        lastAppointment.dataValues.haircutDetails = haircutDetails;

        return sendResponse(res, true, 'Last HairCut Detail fetch Successfully', { lastHaircutDetails: haircutDetails }, 200);
    } catch (error) {
        console.error('Error fetching last haircut details:', error);
        return res.status(500).json({ 
            message: 'An error occurred while fetching last haircut details' 
        });
    }
};

exports.getAppointments = async (req, res) => {
    const { page = 1, limit = 10, startDate, endDate, status, search } = req.query;
    const offset = (page - 1) * limit;

    try {
        if (!req.user) {
            return sendResponse(res, false, "User not authenticated", null, 401);
        }

        console.log("Authenticated user:", req.user);

        // Initialize appointment filter
        const appointmentFilter = {};

        const userRole = req.user.role;
        if (userRole === role.BARBER) {
            if (!req.user.barberId) {
                return sendResponse(res, false, "Unauthorized: Barber ID is missing.", null, 403);
            }
            appointmentFilter.BarberId = req.user.barberId;
        } else if (userRole === role.SALON_OWNER) {
            if (!req.user.salonId) {
                return sendResponse(res, false, "Unauthorized: Salon ID is missing.", null, 403);
            }
            appointmentFilter.SalonId = req.user.salonId;
        } else if (userRole === role.SALON_MANAGER) {
            if (!req.user.salonId) {
                return sendResponse(res, false, "Unauthorized: Salon ID is missing.", null, 403);
            }
            appointmentFilter.SalonId = req.user.salonId;
        }else if (userRole !== role.ADMIN) {
            return sendResponse(res, false, "Unauthorized: Invalid role.", null, 403);
        }

        // Apply date filters if provided
        if (startDate || endDate) {
            appointmentFilter.createdAt = {};

            if (startDate) {
                appointmentFilter.createdAt[Sequelize.Op.gte] = new Date(`${startDate}T00:00:00Z`);
            }

            if (endDate) {
                appointmentFilter.createdAt[Sequelize.Op.lte] = new Date(`${endDate}T23:59:59Z`);
            }
        }

        // Apply status filter if provided
        if (status === null || status === "" || status === undefined) {
            // If no status is provided, fetch all appointments, regardless of status or date
            // No need to add any status or date filter in this case.
        }else{
            const allowedStatuses = [AppointmentENUM.In_salon,AppointmentENUM.Checked_in,AppointmentENUM.Canceled,AppointmentENUM.Completed];
            if (allowedStatuses.includes(status)) {
                appointmentFilter.status = status;
            } else {
                return sendResponse(res, false, 'Invalid status value. Allowed values are "in_salon", "checked_in", "canceled", "completed".', null, 400);
            }
        }

        // Add search functionality
        const searchConditions = [];
        if (search) {
            searchConditions.push(
                { '$Barber.name$': { [Sequelize.Op.iLike]: `%${search}%` } },
                { '$salon.name$': { [Sequelize.Op.iLike]: `%${search}%` } },
                // { '$User.username$': { [Sequelize.Op.iLike]: `%${search}%` } },
                {  name: { [Sequelize.Op.iLike]: `%${search}%` } }
            );
        }

        // Combine search filters
        if (searchConditions.length > 0) {
            appointmentFilter[Sequelize.Op.or] = searchConditions;
        }

        // Fetch appointments with filters and pagination
        const appointments = await Appointment.findAndCountAll({
            where: appointmentFilter,
            limit: parseInt(limit),
            offset: parseInt(offset),
            include: [
                {
                    model: Barber,
                    as: 'Barber',
                    attributes: ['id', 'name', 'availability_status', 'cutting_since', 'organization_join_date', 'photo', 'weekly_schedule'],
                    where: { category: BarberCategoryENUM.ForAppointment }, // Add this line to filter by barber category '1'
                },
                {
                    model: Salon,
                    as: 'salon',
                    attributes: ['id', 'name', 'address', 'phone_number', 'open_time', 'close_time', 'photos'],
                },
                {
                    model: User,
                    as: 'User',
                    attributes: { exclude: ['password'] },
                },
                { 
                    model: Service, 
                    attributes: ['id','name', 'default_service_time'], // Fetch the 'estimated_service_time' from the Service model
                    through: { attributes: [] } // Avoid extra attributes from the join table
                },
            ]
        });

        // Calculate total pages
        const totalPages = Math.max(1, Math.ceil(appointments.count / limit));

        return sendResponse(res, true, 'Fetched all appointments successfully', {
            totalItems: appointments.count,
            totalPages,
            currentPage: page,
            appointments: appointments.rows,
        }, 200);
    } catch (error) {
        console.error("Error fetching appointments:", error);
        return sendResponse(res, false, error.message, null, 500);
    }
};


exports.findOneDetails = async (req, res) => {
    try {
        const { role: userRole, id: userId } = req.user;
        const appointmentId = req.params.id;

        if (!appointmentId) {
            return sendResponse(res, false, "Appointment ID is required", null, 400);
        }

        let whereCondition = { id: appointmentId };
        let barberId = null;

        // Role-specific logic remains the same...
        if (userRole === role.BARBER) {
            const barber = await Barber.findOne({ where: { UserId: userId } });
            if (!barber) {
                return sendResponse(res, false, "No barber profile found for this user", null, 404);
            }
            barberId = barber.id;
            whereCondition.BarberId = barberId;
        } else if (userRole === role.CUSTOMER) {
            whereCondition.UserId = userId;
        } else if (userRole === role.SALON_OWNER) {
            const salon = await Salon.findOne({ where: { UserId: userId } });
            if (!salon) {
                return sendResponse(res, false, "No salon profile found for this user", null, 404);
            }
            whereCondition.SalonId = salon.id;
        } else if (userRole === role.SALON_MANAGER) {
            const userSalon = await UserSalon.findOne({ where: { UserId: userId } });
            if (!userSalon) {
                return sendResponse(res, false, "No assigned salon found for this manager", null, 404);
            }

            const salonRole = await Salon.findOne({ where: { id: userSalon.SalonId } });
            if (!salonRole) {
                return sendResponse(res, false, "No salon profile found for this manager", null, 404);
            }
            whereCondition.SalonId = salonRole.id;
        } else if (userRole !== role.ADMIN) {
            return sendResponse(res, false, "Unauthorized access", null, 403);
        }

        const appointment = await Appointment.findOne({
            where: whereCondition,
            include: [
                {
                    model: Salon,
                    as: 'salon',
                    attributes: { exclude: ['createdAt', 'updatedAt'] },
                },
                {
                    model: Barber,
                    as: 'Barber',
                    attributes: { exclude: ['createdAt', 'updatedAt'] },
                }
            ],
        });

        if (!appointment) {
            return sendResponse(res, false, "Appointment not found", null, 404);
        }

        // Get appointment services with potential duplicates
        const appointmentServices = await AppointmentService.findAll({
            where: {
                AppointmentId: appointment.id,
            },
            order: [['id', 'ASC']], // Maintain consistent order
        });

        // Get unique service IDs for fetching service details
        const serviceIds = appointmentServices.map(as => as.ServiceId);
        const uniqueServiceIds = [...new Set(serviceIds)];

        // Get all services details
        const servicesDetails = await Service.findAll({
            where: {
                id: uniqueServiceIds,
            },
            attributes: ['id', 'name', 'description', 'min_price', 'max_price', 'default_service_time'],
        });

        // Create a map for quick service lookup
        const servicesMap = servicesDetails.reduce((map, service) => {
            map[service.id] = service.toJSON();
            return map;
        }, {});

        // Get barber services with prices
        const barberServices = await BarberService.findAll({
            where: {
                BarberId: appointment.BarberId,
                SalonId: appointment.SalonId,
            },
            include: [
                {
                    model: Service,
                    as: 'service',
                    attributes: ['id', 'name', 'description', 'default_service_time', 'min_price', 'max_price'],
                },
            ],
            raw: true,
            nest: true,
        });

        // Create map of barber services with prices
        const barberServicePrices = barberServices.reduce((map, bs) => {
            map[bs.service.id] = bs.price;
            return map;
        }, {});

        // Create Services array maintaining original order and duplicates
        const services = appointmentServices.map(as => ({
            id: servicesMap[as.ServiceId].id,
            name: servicesMap[as.ServiceId].name,
            min_price: servicesMap[as.ServiceId].min_price,
            max_price: servicesMap[as.ServiceId].max_price,
            default_service_time: servicesMap[as.ServiceId].default_service_time
        }));

        // Create barbersWithServices array maintaining same order and duplicates as Services
        const barbersWithServices = appointmentServices.map(as => ({
            id: servicesMap[as.ServiceId].id,
            name: servicesMap[as.ServiceId].name,
            description: servicesMap[as.ServiceId].description,
            default_service_time: servicesMap[as.ServiceId].default_service_time,
            min_price: servicesMap[as.ServiceId].min_price,
            max_price: servicesMap[as.ServiceId].max_price,
            barber_price: barberServicePrices[servicesMap[as.ServiceId].id] || servicesMap[as.ServiceId].min_price,
        }));

        let isLike = false;
        if (userRole === role.CUSTOMER) {
            const favoriteSalon = await FavoriteSalon.findOne({
                where: {
                    UserId: userId,
                    SalonId: appointment.SalonId,
                    status: "like",
                },
            });
            isLike = !!favoriteSalon;
        }

        // Convert appointment to plain object and add our custom fields
        const appointmentData = appointment.toJSON();
        appointmentData.Services = services;
        appointmentData.barbersWithServices = barbersWithServices;
        appointmentData.is_like = isLike;

        return sendResponse(res, true, "Fetched appointment successfully", appointmentData, 200);

    } catch (error) {
        console.error("Error fetching appointment:", error.message);
        return sendResponse(res, false, error.message || "Internal server error", null, 500);
    }
};


exports.appointmentByUserId = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;

        if (!userId) {
            return sendResponse(res, false, "User is not authenticated or User ID is missing in the token", null, 401);
        }

        const { category } = req.query;

        // Get today's date boundaries
        const todayStart = moment().startOf('day').toDate();
        const todayEnd = moment().endOf('day').toDate();
        
        let whereCondition = {
            UserId: userId,
        };

        // Apply category filtering with date conditions
        if (category === '1') {
            // For appointments (category 1): Show only future appointments
            whereCondition.status = AppointmentENUM.Appointment;
            whereCondition.appointment_date = {
                [Op.gte]: todayStart // Greater than or equal to today's start
            };
        } else {
            // For check-ins (category 2): Show only today's check-ins
            whereCondition.status = {
                [Op.or]: [AppointmentENUM.Checked_in, AppointmentENUM.In_salon]
            };
            whereCondition.createdAt = {
                [Op.between]: [todayStart, todayEnd]
            };
        }

        const appointments = await Appointment.findAll({
            where: whereCondition,
            include: [
                {
                    model: Salon,
                    as: 'salon',
                    attributes: { exclude: ['createdAt', 'updatedAt'] },
                },
                {
                    model: Barber,
                    as: 'Barber',
                    attributes: { exclude: ['createdAt', 'updatedAt'] },
                },
            ],
            order: [['appointment_date', 'DESC']], // Sort by appointment date
        });

        const appointmentsWithType = appointments.map((appointment) => {
            let category = '';

            if (appointment.Barber) {
                if (appointment.Barber.category === BarberCategoryENUM.ForAppointment) {
                    category = 'Appointment';
                } else if (appointment.Barber.category === BarberCategoryENUM.ForWalkIn) {
                    category = 'Checked in';
                }
            }

            return {
                ...appointment.toJSON(),
                category,
            };
        });

        if (!appointments.length) {
            return sendResponse(res, false, "No appointments found for this user", null, 200);
        }

        return sendResponse(res, true, 'Fetched appointments successfully', appointmentsWithType, 200);
    } catch (error) {
        return sendResponse(res, false, error.message || 'Internal server error', null, 500);
    }
};


exports.getAppointmentsByRoleExp = getAppointmentsByRole;

exports.getInSalonAppointmentsByRoleExp = getInSalonAppointmentsByRole;

