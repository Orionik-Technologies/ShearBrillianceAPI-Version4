const db = require("../models");
const fs = require('fs');
const path = require('path'); // Make sure path is imported
const { put } = require('@vercel/blob'); // Import 'put' directly if using Vercel's blob SDK upload method
const sendResponse = require('../helpers/responseHelper');  // Import the helper
const validateInput = require('../helpers/validatorHelper');  // Import the helper
const { where } = require("sequelize");
const bcrypt = require('bcrypt');
const { sendEmail } = require("../services/emailService");
const { INVITE_BARBER_TEMPLATE_ID, INVITE_BARBER_CHANGE_CATEGORY_TEMPLATE_ID } = require("../config/sendGridConfig");
const {role}= require('../config/roles.config');
const { Op } = require("sequelize");
const { AppointmentENUM } = require("../config/appointment.config");
const AppointmentService = db.AppointmentService;
const AWS = require('aws-sdk');
const { BarberCategoryENUM } = require("../config/barberCategory.config");
const moment = require("moment");
const { barberSlotManager } = require('../controllers/barbersessioncron.controller');
const Slot = db.Slot;
const Service = db.Service;
const BarberService = db.BarberService;
// Import necessary modules



const Barber = db.Barber;
const User = db.USER;
const Salon = db.Salon; 
const Appointment = db.Appointment;
const roles = db.roles;
const UserSalon = db.UserSalon;
const BarberSession = db.BarberSession;

// Function to update the barber's status based on appointments
async function updateBarberStatus(barberId, availability_status) {
  try {
    // Validate the incoming availability_status
    const validStatuses = ['available', 'unavailable'];
    const requestedStatus = availability_status?.toLowerCase();
    if (!validStatuses.includes(requestedStatus)) {
      throw new Error(`Invalid availability status: ${availability_status}. Must be 'available' or 'unavailable'.`);
    }

    // Fetch the barber's current status
    const barber = await Barber.findOne({ where: { id: barberId } });
    if (!barber) {
      throw new Error(`Barber with ID ${barberId} not found`);
    }
    const currentStatus = barber.availability_status?.toLowerCase();

    // Check for active appointments
    const activeAppointments = await Appointment.findOne({
      where: {
        BarberId: barberId,
        status: [AppointmentENUM.In_salon, AppointmentENUM.Checked_in], // Ongoing or upcoming appointments
      },
    });

    let newStatus = requestedStatus;

    // Logic for determining newStatus
    if (activeAppointments) {
      // If there are active appointments and user requests 'available', warn but allow override
      if (requestedStatus === 'available') {
        console.warn(
          `Barber ${barberId} has active appointments but status is being set to 'available' per request.`
        );
        newStatus = 'available'; // Respect the user's explicit request
      } else {
        // If user requests 'unavailable' or doesn't specify, enforce 'unavailable'
        newStatus = 'unavailable';
        console.log(
          `Barber ${barberId} has active appointments, setting status to 'unavailable'.`
        );
      }
    } else {
      // No active appointments, use the requested status
      newStatus = requestedStatus;
      console.log(
        `No active appointments for Barber ${barberId}, setting status to '${newStatus}'.`
      );
    }

    // Only update if the status has changed
    if (currentStatus !== newStatus) {
      await Barber.update(
        { availability_status: newStatus },
        { where: { id: barberId } }
      );
      console.log(`Barber ${barberId} status updated from '${currentStatus}' to '${newStatus}'.`);
    } else {
      console.log(`Barber ${barberId} status unchanged: '${currentStatus}'.`);
    }

    return newStatus; // Return the final status for potential use by the caller
  } catch (error) {
    console.error('Error updating barber status:', error.message);
    throw error; // Propagate the error to the caller
  }
}
 
const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint('https://tor1.digitaloceanspaces.com'),
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

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


// Parse and validate servicesWithPrices
const parseServicesWithPrices = (servicesWithPrices) => {
  try {
    // First, parse the outer array if it's a string
    let parsedArray = typeof servicesWithPrices === 'string' 
      ? JSON.parse(servicesWithPrices) 
      : servicesWithPrices;

    if (!Array.isArray(parsedArray)) {
      throw new Error('Input must be an array');
    }

    // Process each element in the array
    const processedArray = parsedArray.map(item => {
      try {
        // If item is already an object, return it
        if (typeof item === 'object' && item !== null) {
          return item;
        }
        
        // If item is a string, try to parse it
        if (typeof item === 'string') {
          // Remove escaped quotes and newlines
          const cleanString = item
            .replace(/\\"/g, '"')  // Replace escaped quotes
            .replace(/\\n/g, '')   // Remove newlines
            .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
            .trim();               // Remove leading/trailing whitespace
          
          return JSON.parse(cleanString);
        }
        
        throw new Error(`Invalid item type: ${typeof item}`);
      } catch (error) {
        console.error('Error processing array item:', error);
        throw error;
      }
    });

    return processedArray;
  } catch (error) {
    console.error('Error parsing servicesWithPrices:', error);
    throw new Error('Failed to parse services with prices');
  }
};


exports.create = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    // Validate required fields
     let { firstname, lastname, email, mobile_number, password, availability_status, cutting_since, organization_join_date, SalonId, address, background_color, weekly_schedule, category, position, non_working_days } = req.body;
     let { servicesWithPrices } = req.body;

    if (!firstname || !lastname || !email || !mobile_number || !password || !availability_status || !cutting_since || !organization_join_date || !SalonId || !background_color || !weekly_schedule || !category || !position) {
      return sendResponse(res, false, 'All fields are required', null, 400);  // Return a 400 error if any field is missing
    }

     // Whitespace validation for required fields
    const requiredFields = [
      { name: 'firstname', value: firstname },
      { name: 'lastname', value: lastname },
      { name: 'email', value: email },
      { name: 'mobile_number', value: mobile_number },
      { name: 'password', value: password }
    ];

    for (const field of requiredFields) {
      if (!validateInput(field.value, 'whitespace')) {
        return sendResponse(res, false, `Enter valid  ${field.name}`, null, 400);
      }
    }

    // Name validation for firstname and lastname
    if (!validateInput(firstname, 'nameRegex')) {
      return sendResponse(res, false, 'Firstname must contain only letters and spaces.', null, 400);
    }

    if (!validateInput(lastname, 'nameRegex')) {
      return sendResponse(res, false, 'Lastname must contain only letters and spaces.', null, 400);
    }
    
    // Validate email
    if (!validateInput(email, 'email')) {
      return sendResponse(res, false, 'Invalid email format', null, 400);
    }

    // Validate password
    if (!validateInput(password, 'password')) {
      return sendResponse(
        res,
        false,
        'Enter valid password',
        null,
        400
      );
    }

    // Validate mobile number
    if (!validateInput(mobile_number, 'mobile_number')) {
      return sendResponse(
        res,
        false,
        'Enter valid mobile number',
        null,
        400
      );
    }

     // Parse weekly_schedule from JSON string to object
     let weeklyScheduleObj;
     try {
       weeklyScheduleObj = JSON.parse(weekly_schedule);
     } catch (error) {
       return sendResponse(res, false, 'Invalid weekly_schedule format', null, 400);
     }
 
     // Validate weekly_schedule object
     if (!weeklyScheduleObj || typeof weeklyScheduleObj !== 'object' || Array.isArray(weeklyScheduleObj)) {
       return sendResponse(res, false, 'weekly_schedule must be an object', null, 400);
     }
 
     // List of valid days
     const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

     // Check for invalid days in weekly_schedule input
    const inputDays = Object.keys(weeklyScheduleObj);
    for (const day of inputDays) {
      if (!validDays.includes(day)) {
        return sendResponse(res, false, `Invalid day in weekly_schedule: ${day}`, null, 400);
      }
    }

    // Create normalized schedule with only valid input days
    const normalizedSchedule = { ...weeklyScheduleObj };

    // Replace the input schedule with the normalized one
    weekly_schedule = normalizedSchedule;

    // Validate non_working_days
    let validatedNonWorkingDays = [];
    if (non_working_days !== undefined && non_working_days !== null && non_working_days !== '') {
      try {
        if (typeof non_working_days === 'string') {
          validatedNonWorkingDays = non_working_days.split(',').map(day => parseInt(day.trim(), 10));
        } else if (Array.isArray(non_working_days)) {
          validatedNonWorkingDays = non_working_days;
        } else {
          validatedNonWorkingDays = JSON.parse(non_working_days);
        }
      } catch (e) {
        return sendResponse(res, false, 'non_working_days must be a valid array or a comma-separated string', null, 400);
      }

      if (!Array.isArray(validatedNonWorkingDays)) {
        return sendResponse(res, false, 'non_working_days must be an array', null, 400);
      }

      // Validate day values (1-7)
      const invalidDays = validatedNonWorkingDays.filter(day => 
        !Number.isInteger(Number(day)) || Number(day) < 1 || Number(day) > 7
      );
      if (invalidDays.length > 0) {
        return sendResponse(res, false, 'Days must be integers between 1 and 7', null, 400);
      }

      // Remove duplicates and ensure numbers
      validatedNonWorkingDays = [...new Set(validatedNonWorkingDays.map(Number))];
    }

    // Check for conflicts between non_working_days and weekly_schedule
    const dayNumberToKey = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const dayNumber of validatedNonWorkingDays) {
      const dayKey = dayNumberToKey[dayNumber - 1];
      if (weekly_schedule[dayKey]) { // Check only if day exists in weekly_schedule
        const daySchedule = weekly_schedule[dayKey];
        if (daySchedule.start_time !== null || daySchedule.end_time !== null) {
          return sendResponse(
            res,
            false,
            `Cannot have working hours on non-working day (day ${dayNumber})`,
            null,
            400
          );
        }
      }
    }

    // Calculate actual working days (exclude non_working_days and check times)
    const workingDays = Object.keys(weekly_schedule).filter(dayKey => {
      const dayNumber = validDays.indexOf(dayKey) + 1;
      if (validatedNonWorkingDays.includes(dayNumber)) return false;
      const { start_time, end_time } = weekly_schedule[dayKey];
      return start_time !== null && end_time !== null;
    });

    // Ensure at least 2 working days
    if (workingDays.length < 2) {
      return sendResponse(res, false, 'Barber must be available for at least 2 working days per week', null, 400);
    }

     // Validate time format, round times, and check start < end
     for (const day of workingDays) {
      let { start_time, end_time } = weekly_schedule[day];
      
      // Validate HH:mm format
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
        return sendResponse(res, false, `${day}: Times must be in HH:mm format`, null, 400);
      }

      // Round times
      start_time = roundTimeToNearestSlot(start_time);
      end_time = roundTimeToNearestSlot(end_time);
      weekly_schedule[day].start_time = start_time;
      weekly_schedule[day].end_time = end_time;

      // Convert to minutes for comparison
      const startMinutes = parseInt(start_time.split(':')[0]) * 60 + parseInt(start_time.split(':')[1]);
      const endMinutes = parseInt(end_time.split(':')[0]) * 60 + parseInt(end_time.split(':')[1]);
      if (startMinutes >= endMinutes) {
        return sendResponse(res, false, `${day}: start_time must be before end_time`, null, 400);
      }
    }

    let profile_photo = null;
    if (req.file) {
      const fileBuffer = req.file.buffer; // Get file buffer

      // Validate the file type (optional)
      if (!req.file.mimetype.startsWith('image/')) {
        return sendResponse(res, false, 'Only image files are allowed!', null, 400);  // Return an error if the file is not an image
      }

      // Upload to DigitalOcean Spaces
      const params = {
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: `barber-photo/${Date.now()}-${req.file.originalname}`, // Using 'barber-photo' folder
        Body: req.file.buffer,
        ACL: 'public-read',
        ContentType: req.file.mimetype,
      };

      try {
        const uploadResult = await s3.upload(params).promise();
        profile_photo = uploadResult.Location; // Obtain the URL after upload
      } catch (error) {
        console.error('Error uploading photo to DigitalOcean Spaces:', error);
        return sendResponse(res, false, 'Failed to upload photo', error.message, 500);
      }
    }

    // Check if the user already exists by email
    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return sendResponse(res, false, "Email already exists", null, 409);
    }

    // Find the default user role
    const barberRole = await roles.findOne({ where: { role_name: role.BARBER } });
    if (!barberRole) {
      return sendResponse(res, false, "User role not found", "The default user role could not be found in the system. Please contact support.", 500);
    }

    // Check if barber with the same name exists in the salon
    const barberExists = await Barber.findOne({
      where: { name: `${firstname} ${lastname}`, SalonId }
    });
    if (barberExists) {
      return sendResponse(res, false, "Barber already exists in this salon", null, 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Automatically generate a unique username
    let baseUsername = `${firstname.toLowerCase()}_${lastname.toLowerCase()}`;
    let username = baseUsername;
    let userWithSameUsername = await User.findOne({ where: { username } });

    let counter = 1;
    while (userWithSameUsername) {
      username = `${baseUsername}${counter}`;
      userWithSameUsername = await User.findOne({ where: { username } });
      counter++;
    }

    const user = await User.create({
      username: username,
      firstname: firstname,
      lastname: lastname,
      email: email,
      google_token: "",
      profile_photo: profile_photo,
      password: hashedPassword,
      RoleId: barberRole.id,
      address: address,
      mobile_number: mobile_number
    }, { transaction });

    if (user) {
      // Create the barber associated with the user
      let barber = await Barber.create({
        name: firstname + " " + lastname,
        availability_status,
        cutting_since,  // Expecting YYYY-MM-DD
        organization_join_date,  // Expecting YYYY-MM-DD
        photo: profile_photo,  // Use uploaded photo URL or null if no file uploaded
        SalonId,  // ID of the salon
        UserId: user.id,  // Link the barber to the user
        background_color,  // Link the barber to the user
        weekly_schedule, // Use the new weekly_schedule field
        category,
        position,
        non_working_days: validatedNonWorkingDays || [] // Add non_working_days with default empty array
      }, { transaction });

      // Parse and validate servicesWithPrices
      let parsedServicesWithPrices;

      try {
        parsedServicesWithPrices = parseServicesWithPrices(servicesWithPrices);
      } catch (error) {
        return sendResponse(res, false, 'Invalid format for servicesWithPrices. Must be a valid JSON array.', null, 400);
      }

      console.log('Parsed services:', parsedServicesWithPrices);

      const barberServices = [];
      for (const service of parsedServicesWithPrices) {
        const { ServiceId, price } = service;

        // Validate ServiceId and price
        const roundedPrice = price !== undefined ? parseFloat(price).toFixed(2) : '0.00';
        if (!ServiceId || isNaN(roundedPrice) || roundedPrice < 0) {
          return sendResponse(res, false, `Invalid service price data for ServiceId: ${ServiceId}`, null, 400);
        }

        // Check if the service exists and is active
        const serviceExists = await Service.findOne({
          where: { id: ServiceId, isActive: true },
          transaction,
        });

        if (!serviceExists) {
          return sendResponse(res, false, `Service with ID ${ServiceId} does not exist or is inactive`, null, 404);
        }

        // Add the service to the array for bulk insertion
        barberServices.push({
          BarberId: barber.id,
          ServiceId,
          SalonId: barber.SalonId,
          price: parseFloat(roundedPrice),
        });
      }

      // Proceed with saving barberServices to the database
      await BarberService.bulkCreate(barberServices, { transaction });


       // Generate sessions and slots for next 4 weeks
       const today = moment().startOf('day');
       const fourWeeksLater = moment(today).add(4, 'weeks').endOf('day');
       
       await barberSlotManager.maintainBarberSessions(
         barber,
         today,
         fourWeeksLater,
         transaction
       );
 
       // Reload barber with user data
       const updatedBarber = await Barber.findOne({
         where: { id: barber.id },
         include: [{ 
           model: User, 
           as: 'user', 
           attributes: { exclude: ['password'] } 
         }],
         transaction
       });
 

      // Prepare email data for SendGrid
      const emailData = {
        barber_name: `${firstname} ${lastname}`,
        email: email,
        password: password,
        company_name: 'Shear Brilliance',
        currentYear: new Date().getFullYear()
      };
      
      await transaction.commit();

      // Send confirmation email to the barber
      await sendEmail(email, "Added as a Barber", INVITE_BARBER_TEMPLATE_ID, emailData);

      return sendResponse(res, true, 'Barber created successfully', { barber : updatedBarber }, 200);
    }

    // Return success response with the created data
    return sendResponse(res, true, 'Something is wrong', null, 500);

  } catch (error) {
    // Log the error for debugging
    console.error('Error creating barber:', error);

    // Return error response with a message
    return sendResponse(res, false, error.message || 'An error occurred while creating the barber', null, 500);
  }
};

// Get all barbers along with their salons
exports.findAll = async (req, res) => {
  try {
    const { salonId, category } = req.query;

    const whereCondition = {
      availability_status: {
        [Op.in]: ['available', 'unavailable'],
      },
    };

    if (salonId) {
      whereCondition.SalonId = salonId;
    }
    if (category) {
      whereCondition.category = category;
    }

    const barbers = await Barber.findAll({
      where: whereCondition,
      attributes: { exclude: ['createdAt', 'updatedAt'] },
      include: [
        {
          model: Salon,
          as: 'salon'
        },
        {
          model: User,
          as: 'user',
          attributes: { exclude: ['password'] }
        }
      ]
    });

    const barbersWithServices = await Promise.all(
      barbers.map(async (barber) => {
        const barberData = barber.toJSON();

        // Fetch services with raw: true to get plain objects
        const barberServices = await BarberService.findAll({
          where: {
            BarberId: barber.id,
            SalonId: barber.SalonId
          },
          include: [{
            model: Service,
            as: 'service',
            attributes: ['id', 'name', 'description', 'default_service_time', 'min_price', 'max_price']
          }],
          raw: true,
          nest: true // This helps in nesting the joined data
        });

        // Format services to include only necessary data
        barberData.servicesWithPrices  = barberServices.map(bs => ({
          id: bs.service.id,
          name: bs.service.name,
          description: bs.service.description,
          default_service_time: bs.service.default_service_time,
          min_price: bs.service.min_price,
          max_price: bs.service.max_price,
          barber_price: bs.price // Price from BarberService table
        }));

        return barberData;
      })
    );

    return sendResponse(res, true, 'Barbers retrieved successfully', barbersWithServices, 200);
  } catch (error) {
    return sendResponse(res, false, error.message, null, 500);
  }
};


// Admin side API with pagination and a unified search query for username, salonName, and status
exports.adminBarberfindAll = async (req, res) => {
  try {
    const { page = 1, limit, search } = req.query;
    const offset = limit ? (page - 1) * limit : null;
    const parsedLimit = limit ? parseInt(limit) : null; // If limit is not provided, set it to null
    const user = req.user;
    const userRole = req.user.role;

    // Initialize whereCondition for the filters
    const whereCondition = {};

     // If the user is a Barber, filter by their barberId
     if (userRole === role.BARBER) {
      whereCondition.id = user.barberId; // Filter results to only show the logged-in barber's data
    }

    // If the user is a Salon Manager, get their associated salon
    else if (userRole === role.SALON_MANAGER) {
      const userSalon = await UserSalon.findOne({
        where: { UserId: user.id },
        attributes: ['SalonId'] // Only fetch the SalonId
      });

      if (!userSalon) {
        return sendResponse(res, false, 'No salon association found for the Salon Manager', null, 404);
      }

      whereCondition.SalonId = userSalon.SalonId;
    } 
    // If the user is a Salon Owner, filter by their associated salonId
    else if (userRole === role.SALON_OWNER) {
      whereCondition.SalonId = user.salonId;
    }

    // Add search conditions if search query is provided
    if (search) {
      const allowedStatuses = ['available', 'unavailable', 'running'];
      if (allowedStatuses.includes(search)) {
        whereCondition.availability_status = { [Op.eq]: search };
      } else {
        whereCondition[Op.or] = [
          {
            '$salon.name$': { [Op.iLike]: `%${search}%` }
          },
          {
            '$user.username$': { [Op.iLike]: `%${search}%` }
          }
        ];
      }
    }

    const barbers = await Barber.findAndCountAll({
      where: whereCondition,
      attributes: { exclude: ['createdAt', 'updatedAt'] },
      include: [
        {
          model: Salon,
          as: 'salon',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'user',
          attributes: { exclude: ['password'] }
        }
      ],
      limit: parsedLimit,
      offset: offset,
      order: [['name', 'ASC']]
    });

    // Fetch services for each barber and include them in the response
    const barbersWithServices = await Promise.all(
      barbers.rows.map(async (barber) => {
        const barberData = barber.toJSON();

        // Fetch services associated with the barber and their salon
        const barberServices = await BarberService.findAll({
          where: {
            BarberId: barber.id,
            SalonId: barber.SalonId
          },
          include: [{
            model: Service,
            as: 'service',
            attributes: ['id', 'name', 'description', 'default_service_time', 'min_price', 'max_price']
          }],
          raw: true,
          nest: true // This helps in nesting the joined data
        });

        // Format services to include only necessary data
        barberData.servicesWithPrices = barberServices.map(bs => ({
          id: bs.service.id,
          name: bs.service.name,
          description: bs.service.description,
          default_service_time: bs.service.default_service_time,
          min_price: bs.service.min_price,
          max_price: bs.service.max_price,
          barber_price: bs.price // Price from BarberService table
        }));

        return barberData;
      })
    );

    const totalPages = parsedLimit ? Math.ceil(barbers.count / parsedLimit) : 1;

    sendResponse(res, true, 'Barbers retrieved successfully', {
      totalItems: barbers.count,
      totalPages: totalPages,
      currentPage: parsedLimit ? parseInt(page) : 1,
      barbers: barbersWithServices
    }, 200);
  } catch (error) {
    console.error('Error fetching barbers:', error);
    return sendResponse(res, false, error.message, null, 500);
  }
};


// Get a barber by ID
exports.findOne = async (req, res) => {
  try {
    const barber = await Barber.findByPk(req.params.id, {
      attributes: { exclude: ['createdAt', 'updatedAt'] }, // Exclude timestamps
      include: [
        {
          model: Salon,
          as: 'salon'
        },
        {
          model: User,   // This is the association you want to include
          as: 'user',     // Use the alias you defined in the association (if any)
          attributes: { exclude: ['password'] } // Exclude password from User
        }
      ]
    });
    if (!barber) {
      return sendResponse(res,  false, "Barber not found", null, 404);
    }
    sendResponse(res,  true, 'Barber retrieved successfully', barber, 200);
  } catch (error) {
    sendResponse(res, false, error.message, null, 500);
  }
};

// Update a barber by ID
exports.update = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    let { firstname, lastname, mobile_number, address, availability_status, cutting_since, organization_join_date, SalonId, background_color, weekly_schedule, category, position, non_working_days } = req.body;
    let { servicesWithPrices } = req.body;

    if (!['available', 'unavailable'].includes(availability_status?.toLowerCase())) {
      return sendResponse(res, false, 'Invalid availability status', null, 400);
    }
     // Whitespace validation for required fields
    const requiredFields = [
      { name: 'firstname', value: firstname },
      { name: 'lastname', value: lastname },
      { name: 'mobile_number', value: mobile_number }
    ];

    for (const field of requiredFields) {
      if (!validateInput(field.value, 'whitespace')) {
        return sendResponse(res, false, `Enter valid  ${field.name}`, null, 400);
      }
    }

    // Name validation for firstname and lastname
    if (!validateInput(firstname, 'nameRegex')) {
      return sendResponse(res, false, 'Firstname must contain only letters', null, 400);
    }

    if (!validateInput(lastname, 'nameRegex')) {
      return sendResponse(res, false, 'Lastname must contain only letters', null, 400);
    }
    
    // Validate mobile number
    if (!validateInput(mobile_number, 'mobile_number')) {
      return sendResponse(
        res,
        false,
        'Enter valid mobile number',
        null,
        400
      );
    }

    // Find the barber record
    let barber = await Barber.findOne({ where: { id: req.params.id } });
    if (!barber) {
      return sendResponse(res, false, "Barber not found", null, 404);
    }
    const oldWeeklySchedule = barber.weekly_schedule;

    const updates = { ...req.body };
    const oldNonWorkingDays = barber.non_working_days;

    // Validate non_working_days
    let validatedNonWorkingDays = barber.non_working_days;
    if (non_working_days !== undefined && non_working_days !== null && non_working_days !== '') {
      try {
        if (typeof non_working_days === 'string') {
          validatedNonWorkingDays = non_working_days.split(',').map(day => parseInt(day.trim(), 10));
        } else if (Array.isArray(non_working_days)) {
          validatedNonWorkingDays = non_working_days;
        } else {
          validatedNonWorkingDays = JSON.parse(non_working_days);
        }

        const invalidDays = validatedNonWorkingDays.filter(day =>
          !Number.isInteger(day) || day < 1 || day > 7
        );
        if (invalidDays.length > 0) {
          return sendResponse(res, false, 'Days must be integers between 1 and 7', null, 400);
        }

        validatedNonWorkingDays = [...new Set(validatedNonWorkingDays)];
      } catch (error) {
        return sendResponse(res, false, 'non_working_days must be a valid array, JSON string, or comma-separated string', null, 400);
      }
    } else {
      validatedNonWorkingDays = null;
    }

    // Validate weekly_schedule if provided
    if (weekly_schedule) {
      try {
        weekly_schedule = JSON.parse(weekly_schedule);
      } catch (error) {
        return sendResponse(res, false, 'Invalid weekly_schedule format', null, 400);
      }

      // Validate weekly_schedule object
      if (!weekly_schedule || typeof weekly_schedule !== 'object' || Array.isArray(weekly_schedule)) {
        return sendResponse(res, false, 'weekly_schedule must be an object', null, 400);
      }

      // List of valid days
      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

      // Check for invalid days in weekly_schedule input
      const inputDays = Object.keys(weekly_schedule);
      for (const day of inputDays) {
        if (!validDays.includes(day)) {
          return sendResponse(res, false, `Invalid day in weekly_schedule: ${day}`, null, 400);
        }
      }

      // Normalize schedule with only valid input days
      const normalizedSchedule = { ...weekly_schedule };

      // Replace the input schedule with the normalized one
      weekly_schedule = normalizedSchedule;

      // Validate time format, round times, and check start < end
      const workingDays = Object.keys(weekly_schedule).filter(dayKey => {
        const dayNumber = validDays.indexOf(dayKey) + 1;
        if (validatedNonWorkingDays && validatedNonWorkingDays.includes(dayNumber)) return false;
        const { start_time, end_time } = weekly_schedule[dayKey];
        return start_time !== null && end_time !== null;
      });

      // Ensure at least 2 working days
      if (workingDays.length < 2) {
        return sendResponse(res, false, 'Barber must be available for at least 2 working days per week', null, 400);
      }

      for (const day of workingDays) {
        let { start_time, end_time } = weekly_schedule[day];

        // Validate HH:mm format
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
          return sendResponse(res, false, `${day}: Times must be in HH:mm format`, null, 400);
        }

        // Round times
        start_time = roundTimeToNearestSlot(start_time);
        end_time = roundTimeToNearestSlot(end_time);
        weekly_schedule[day].start_time = start_time;
        weekly_schedule[day].end_time = end_time;

        // Convert to minutes for comparison
        const startMinutes = parseInt(start_time.split(':')[0]) * 60 + parseInt(start_time.split(':')[1]);
        const endMinutes = parseInt(end_time.split(':')[0]) * 60 + parseInt(end_time.split(':')[1]);
        if (startMinutes >= endMinutes) {
          return sendResponse(res, false, `${day}: start_time must be before end_time`, null, 400);
        }
      }

      updates.weekly_schedule = weekly_schedule;
    }

    // Check if a new profile photo is uploaded
    if (req.file) {
      const fileBuffer = req.file.buffer;

      const params = {
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: `barber-photo/${Date.now()}-${req.file.originalname}`,
        Body: fileBuffer,
        ACL: 'public-read',
        ContentType: req.file.mimetype,
      };

      try {
        const uploadResult = await s3.upload(params).promise();
        updates.photo = uploadResult.Location;
      } catch (error) {
        console.error('Error uploading photo to cloud storage:', error);
        return sendResponse(res, false, 'Failed to upload photo', error.message, 500);
      }
    } else {
      updates.photo = barber.photo;
    }

    // Find and update the related user record
    const user = await User.findOne({ where: { id: barber.UserId } });
    if (!user) {
      return sendResponse(res, false, "User associated with barber not found", null, 404);
    }

    const updatedFirstname = firstname || user.firstname;
    const updatedLastname = lastname || user.lastname;

    let baseUsername = `${updatedFirstname.toLowerCase()}_${updatedLastname.toLowerCase()}`;
    let username = baseUsername;
    let userWithSameUsername = await User.findOne({ where: { username } });

    let counter = 1;
    while (userWithSameUsername && userWithSameUsername.id !== user.id) {
      username = `${baseUsername}${counter}`;
      userWithSameUsername = await User.findOne({ where: { username } });
      counter++;
    }

       // Check if weekly schedule OR category changed
    const oldCategory = barber.category; // Capture before update
    console.log('Old category:', oldCategory);

    await user.update({
      firstname: updatedFirstname,
      lastname: updatedLastname,
      username,
      mobile_number: mobile_number || user.mobile_number,
      address: address || user.address,
    });

    // Update the barber record
    await barber.update({
      name: `${updatedFirstname} ${updatedLastname}`,
      availability_status : availability_status.toLowerCase(),
      cutting_since,
      background_color,
      organization_join_date,
      SalonId: SalonId || barber.SalonId,
      weekly_schedule: updates.weekly_schedule || barber.weekly_schedule,
      category,
      position,
      photo: updates.photo,
      non_working_days: validatedNonWorkingDays || [],
    },{
      validate: true // Force model validation
    });

    console.log('Updated barber:', barber);

    // Reload the barber with updated data
    const updatedBarber = await Barber.findOne({
      where: { id: barber.id },
      include: [{ model: User, as: 'user', attributes: { exclude: ['password'] } }]
    });

 
    const newCategory = updatedBarber.category;

   
    console.log('New category:', newCategory);

    const categoryChanged = oldCategory !== newCategory;

    console.log('Category changed:', categoryChanged);

    // Check if the weekly schedule has changed
    if (JSON.stringify(oldWeeklySchedule) !== JSON.stringify(updatedBarber.weekly_schedule) || categoryChanged) {
      try {
        // Trigger the schedule update logic
        await barberSlotManager.updateBarberSessionsForScheduleChange(barber.id, categoryChanged ,{ transaction });
      } catch (error) {
        console.error('Error updating sessions for schedule change:', error);
        // Handle the error if needed (e.g., log it or notify the admin)
      }
    }

    // Update barber sessions if non_working_days changed
    if (validatedNonWorkingDays !== null &&
      JSON.stringify(oldNonWorkingDays) !== JSON.stringify(validatedNonWorkingDays)) {
      try {
        await barberSlotManager.updateBarberSessionsForNonWorkingDays(
          barber.id,
          oldNonWorkingDays,
          validatedNonWorkingDays
        );
      } catch (error) {
        console.error('Error updating barber sessions:', error);
      }
    }

    if (servicesWithPrices) {
      let parsedServicesWithPrices;

      try {
        parsedServicesWithPrices = parseServicesWithPrices(servicesWithPrices);
      } catch (error) {
        return sendResponse(res, false, 'Invalid format for servicesWithPrices. Must be a valid JSON array.', null, 400);
      }
    
      for (const service of parsedServicesWithPrices) {
        const { ServiceId, price } = service;
    
        const roundedPrice = price !== undefined ? parseFloat(price).toFixed(2) : '0.00';
        if (!ServiceId || isNaN(roundedPrice) || roundedPrice < 0) {
          return sendResponse(res, false, `Invalid service price data for ServiceId: ${ServiceId}`, null, 400);
        }
    
        const serviceExists = await Service.findOne({
          where: { id: ServiceId, isActive: true },
        });
    
        if (!serviceExists) {
          return sendResponse(res, false, `Service with ID ${ServiceId} does not exist or is inactive`, null, 404);
        }
    
        // Check if the barber already has this service
        const barberService = await BarberService.findOne({
          where: { BarberId: barber.id, ServiceId: ServiceId, SalonId: barber.SalonId },
        });
    
        if (barberService) {
          // If service exists for this barber, update the price
          await barberService.update({
            price: parseFloat(roundedPrice),
          });
        } else {
          // If service doesn't exist for this barber, create a new entry
          await BarberService.create({
            BarberId: barber.id,
            ServiceId,
            SalonId: barber.SalonId,
            price: parseFloat(roundedPrice),
          });
        }
      }
    }
    
    // Update barber status based on appointments after update
    await updateBarberStatus(barber.id, availability_status);

    // Reload the barber with updated data
    barber = await Barber.findOne({
      where: { id: barber.id },
      include: [{ model: User, as: 'user', attributes: { exclude: ['password'] } }]
    });

    await transaction.commit();

    return sendResponse(res, true, "Barber updated successfully", { barber }, 200);

  } catch (error) {
    console.error('Error updating barber:', error);
    await transaction.rollback();
    return sendResponse(res, false, error.message || 'An error occurred while updating the barber', null, 500);
  }
};


// Delete a barber by ID
exports.delete = async (req, res) => {
  try {
    console.log("BarberId:", req.params.id);

    // Find the barber and associated user
    const barber = await Barber.findOne({
      where: { id: req.params.id },
      include: [{ model: User, as: 'user' }],
    });

    // If barber not found, return error
    if (!barber) {
      return sendResponse(res, false, "Barber not found", null, 404);
    }

    // Delete associated appointments and related data
    const appointments = await Appointment.findAll({ where: { BarberId: req.params.id } });
    for (const appointment of appointments) {
      // Delete related records in AppointmentServices
      await AppointmentService.destroy({ where: { AppointmentId: appointment.id } });
      // Delete the appointment
      await Appointment.destroy({ where: { id: appointment.id } });
    }

    // Delete the associated user
    if (barber.user) {
      await User.destroy({ where: { id: barber.user.id } });
    }

    // Delete the barber
    await Barber.destroy({ where: { id: req.params.id } });

    // Return success response
    sendResponse(res, true, "Barber and associated data deleted successfully", null, 200);
  } catch (error) {
    console.error("Error deleting barber:", error);
    sendResponse(res, false, "Error deleting barber", error.message, 500);
  }
};


// Manually set barber status (useful for leave or unavailability)
exports.setBarberStatus = async (req, res) => {
  try {
    const { status } = req.body;  // Accept the new status from the request

    // Only allow valid statuses
    if (!['available', 'unavailable', 'running'].includes(status)) {
      return sendResponse(res, false, "Invalid status", null, 400);
    }

    await Barber.update({ availability_status: status }, { where: { id: req.params.id } });

    sendResponse(res,  true, "Barber status updated successfully", null, 200);
  } catch (error) {
    sendResponse(res, false, error.message, null, 500);
  }
};

// Complete an appointment
exports.completeAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id);

    if (!appointment) {
      return sendResponse(res, false, "Appointment not found", null, 404);
    }

    // Update appointment status to completed
    appointment.status = 'completed';
    await appointment.save();

    // Update barber status based on remaining appointments
    await updateBarberStatus(appointment.barber_id);

    sendResponse(res,  true, "Appointment completed", null, 200);
  } catch (error) {
    sendResponse(res,  false, error.message, null, 500);
  }
};

//Barber status patch API
exports.updateAvailabilityStatus = async (req, res) => {
  try {
    const { status } = req.body;

    // Validate request body
    if (!status) {
      return sendResponse(res, false, "Status is required", null, 400);
    }

    // Normalize status to lowercase
    const normalizedStatus = status.toLowerCase();

    // Allowed statuses based on ENUM definition
    const allowedStatuses = ['available', 'unavailable', 'running'];
    if (!allowedStatuses.includes(normalizedStatus)) {
      return sendResponse(res, false, "Invalid status value. Allowed values are 'available', 'unavailable', or 'running'.", null, 400);
    }

    // Find the barber record by user ID
    const barber = await Barber.findOne({ where: { UserId: req.params.userId } });
    if (!barber) {
      return sendResponse(res, false, "Barber not found", null, 404);
    }

    // Update the barber's availability status
    barber.availability_status = normalizedStatus;
    await barber.save();

    // Optionally trigger additional logic when status changes to "running"
    if (normalizedStatus === 'running') {
      console.log(`Barber ID ${barber.id} associated with User ID ${req.params.userId} is now running`);
      // Add additional logic if necessary
    }

    // Return successful response
    return sendResponse(res, true, "Barber availability status updated successfully", { barber }, 200);

  } catch (error) {
    console.error('Error updating barber availability status:', error);
    return sendResponse(res, false, error.message || "An error occurred while updating the barber's availability status", null, 500);
  }
};

// Update barber category
exports.updateCategory = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    
    try {
        const { id } = req.params;
        const { category } = req.body;

        // Map user-friendly category names to enum values
        const categoryMap = {
            ForAppointment: '1',
            ForWalkIn: '2'
        };
        const mappedCategory = categoryMap[category] || category;

        // Validate category
        if (!mappedCategory || !Object.values(BarberCategoryENUM).includes(mappedCategory)) {
            return sendResponse(
                res,
                false,
                'Invalid category. Allowed values are ForAppointment and ForWalkIn.',
                null,
                400
            );
        }

        // Find the barber
        const barber = await Barber.findOne({ 
            where: { id },
            transaction
        });

        if (!barber) {
            await transaction.rollback();
            return sendResponse(res, false, 'Barber not found', null, 404);
        }

        const oldCategory = barber.category;
        
        // If changing from walk-in to appointment-based
        if (oldCategory === 2 && mappedCategory === 1) {
            const today = moment().startOf('day');
            const fourWeeksLater = moment(today).add(4, 'weeks').endOf('day');
            
            // Get all existing sessions without slots
            const existingSessions = await BarberSession.findAll({
                where: {
                    BarberId: id,
                    session_date: {
                        [Op.between]: [today.format('YYYY-MM-DD'), fourWeeksLater.format('YYYY-MM-DD')]
                    }
                },
                transaction
            });

            // Generate slots for each existing session
            for (const session of existingSessions) {
                const slots = await barberSlotManager.generateSlots({
                    ...session.dataValues,
                    category: 1 // Force category to 1 for slot generation
                }, barber);
                
                if (slots.length > 0) {
                    await Slot.bulkCreate(slots, { transaction });
                    
                    // Emit socket event for new slots
                    barberSlotManager.emitSocketEvent('sessionCreated', {
                        barberId: barber.id,
                        salonId: barber.SalonId,
                        sessionId: session.id,
                        date: session.session_date,
                        hasSlots: true,
                        startTime: session.start_time,
                        endTime: session.end_time
                    });
                }
            }
        } else if(oldCategory === 1 && mappedCategory === 2){
            const today = moment().startOf('day');
            
            // Find future appointments
            const futureAppointments = await Appointment.findAll({
                where: {
                    BarberId: id,
                    appointment_date: {
                        [Op.gte]: today.format('YYYY-MM-DD')
                    },
                    status: 'appointment'
                },
                transaction
            });

            // Cancel future appointments
            for (const appointment of futureAppointments) {
                await appointment.update({
                    status: 'canceled',
                    cancellation_reason: 'Barber changed to walk-in only',
                    cancelled_by: 'Admin System'
                }, { transaction });

                // Emit socket event for cancelled appointment
                barberSlotManager.emitSocketEvent('appointmentCancelled', {
                    appointmentId: appointment.id,
                    barberId: id,
                    reason: 'Barber changed to walk-in only'
                });

                const salon = await db.Salon.findOne({ where: { id: barber.SalonId } });
                const salonName = salon ? salon.name : 'the selected salon';
                
                const user = await db.USER.findByPk(appointment.UserId );
                // // Send email notification
                  if (user) {
                    const emailData = {
                        customer_name: appointment.name,
                        barber_name: barber.name,
                        appointment_date: appointment.appointment_date,
                        appointment_start_time: `${appointment.appointment_start_time}`,
                        location: salonName,
                        currentYear: new Date().getFullYear(),
                        reschedule_url: `${process.env.FRONTEND_URL}/select_salon`,
                        email_subject: "Appointment Transferred Successfully",
                    };
        
                  await sendEmail(user.email, "Appointment Cancellation", INVITE_BARBER_CHANGE_CATEGORY_TEMPLATE_ID, emailData);
                  }
          }

            

            // Delete all future slots
            await Slot.destroy({
                where: {
                    slot_date: {
                        [Op.gte]: today.format('YYYY-MM-DD')
                    },
                    BarberSessionId: {
                        [Op.in]: (await BarberSession.findAll({
                            where: { BarberId: id },
                            attributes: ['id']
                        })).map(session => session.id)
                    }
                },
                transaction
            });
        }

        // Update barber category
        await barber.update({
            category: mappedCategory
        }, { transaction });

        await transaction.commit();

        // Fetch updated barber data
        const updatedBarber = await Barber.findOne({
            where: { id },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: { exclude: ['password'] }
                }
            ]
        });

        return sendResponse(
            res,
            true,
            'Barber category updated successfully',
            { barber: updatedBarber },
            200
        );

    } catch (error) {
        await transaction.rollback();
        console.error('Error updating barber category:', error);
        return sendResponse(
            res,
            false,
            error.message || 'An error occurred while updating the barber category',
            null,
            500
        );
    }
};
