const db = require("../models");
const Salon = db.Salon;
const Appointment = db.Appointment;
const FavoriteSalon = db.FavoriteSalon;
const Barber = db.Barber;
const Service = db.Service;
const User = db.USER;
const roles = db.roles;
const BarberSession = db.BarberSession;
const { Op, where } = require('sequelize');
const fs = require('fs');
const path = require('path'); // Make sure path is imported
const { put } = require('@vercel/blob'); // Import 'put' directly if using Vercel's blob SDK upload method
const sendResponse = require("../helpers/responseHelper"); // Import sendResponse helper
const bcrypt = require('bcrypt');
const { INVITE_SALON_TEMPLATE_ID } = require("../config/sendGridConfig");
const { sendEmail } = require("../services/emailService");
const{role}= require('../config/roles.config');
const AWS = require('aws-sdk');
const validateInput = require('../helpers/validatorHelper');  // Import the helper
const { BarberCategoryENUM } = require("../config/barberCategory.config");

let io; // Declare io in the controller's scope

// Initialize with the Socket.IO instance
exports.initialize = (socketIo) => {
    io = socketIo;
};

// Function to calculate estimated wait time for a particular salon
const getEstimatedWaitTimeForSalon = async (salonId) => {
    const appointments = await Appointment.findAll({
        where: { SalonId: salonId, status: ['checked_in', 'in_salon'] },
        order: [['queue_position', 'ASC']]
    });

    if (!appointments.length) return 0;

    let totalWaitTime = 0;

    for (let appointment of appointments) {
        const defaultServiceTime = appointment.default_service_time || 30; // Fallback to 30 mins if no default
        totalWaitTime += defaultServiceTime;
        appointment.estimated_wait_time = totalWaitTime;
        await appointment.save();
    }

    return totalWaitTime;
};

// Example function to calculate estimated wait time for a barber
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
  



exports.calculateBarberWaitTime = getEstimatedWaitTimeForBarber;    

// Service function to cancel specific appointments
const cancelCheckedInAppointments = async (salonId) => {
    try {
      // Fetch appointments with statuses 'checked_in' or 'in_salon' for the salon
      const appointments = await Appointment.findAll({
        where: {
          SalonId: salonId,
          status: { 
            [Op.in]: ['checked_in'], // Adjust these to match your statuses
          },
        },
      });
  
      if (appointments.length === 0) {
        console.log(`No appointments found to cancel for Salon ID ${salonId}`);
        return true; // No appointments to cancel, consider it a success
      }
  
      // Update the status of these appointments to 'canceled'
      const result = await Appointment.update(
        { 
            status: 'canceled', 
            estimated_wait_time: 0, 
            queue_position: 0 
        },
        {
          where: {
            SalonId: salonId,
            status: { [Op.in]: ['checked_in'] },
          },
        }
      );
  
      console.log(`${result[0]} appointments were canceled for Salon ID ${salonId}`);

    //   await recalculateWaitTimesAndQueuePositionsForBarber(salonId);

      return true;
    } catch (error) {
      console.error('Error canceling appointments:', error);
      return false;
    }
  };

//  Salon create
const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint('https://tor1.digitaloceanspaces.com'),  
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

exports.create = async (req, res) => {
    try {
        let photoUrls = [];
        
        const { name, firstname, lastname, email, password, address, phone_number, services, pricing, open_time, close_time, weekend_day, weekend_start, weekend_end, google_url, status } = req.body;

        // Validate required fields before proceeding
        if (!email || !password || !firstname || !lastname || !name || !address || !phone_number || !open_time || !close_time || !status) {
            return sendResponse(res, false, 'All fields are required to create a salon', null, 400);
        }

        const requiredFields = [
            { name: 'name', value: name },
            { name: 'firstname', value: firstname },
            { name: 'lastname', value: lastname },
            { name: 'email', value: email },
            { name: 'address', value: address },
            { name: 'phone_number', value: phone_number },
            { name: 'password', value: password }
          ];
          
        // Validate required fields (skip password if not being updated)
        for (const field of requiredFields) {
            if (field.value !== undefined) {
                // Use specific validation for address
                if (field.name === 'address') {
                    if (!validateInput(field.value, 'address')) {
                        return sendResponse(res, false, `Enter valid ${field.name}`, null, 400);
                    }
                } else {
                    // General whitespace validation for other fields
                    if (!validateInput(field.value, 'whitespace')) {
                        return sendResponse(res, false, `Enter valid ${field.name}`, null, 400);
                    }
                }
            }
        }

         // Name validation for salonName firstname and lastname
         if (!validateInput(name, 'nameRegex')) {
            return sendResponse(res, false, 'Firstname must contain only letters', null, 400);
        }

        if (!validateInput(firstname, 'nameRegex')) {
            return sendResponse(res, false, 'Firstname must contain only letters', null, 400);
        }
    
        if (!validateInput(lastname, 'nameRegex')) {
            return sendResponse(res, false, 'Lastname must contain only letters', null, 400);
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
              'Enter Valid Password',
              null,
              400
            );
        }
      
          // Validate mobile number
        if (!validateInput(phone_number, 'phone_number')) {
            return sendResponse(
              res,
              false,
              'Enter valid phone number',
              null,
              400
            );
        }      

        // Check if there are any files to upload and process each file
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const fileBuffer = file.buffer;

                // Upload each photo to DigitalOcean Spaces
                const params = {
                    Bucket: process.env.DO_SPACES_BUCKET,
                    Key: `salon-photos/${Date.now()}-${file.originalname}`, // Unique key for each file
                    Body: fileBuffer,
                    ACL: 'public-read', // Make the file publicly accessible
                    ContentType: file.mimetype, // Set the content type based on the file's MIME type
                };

                // Upload file to DigitalOcean Spaces
                const uploadResult = await s3.upload(params).promise();
                photoUrls.push(uploadResult.Location); // Add the uploaded file's URL to the array
            }
        }

        // Separate the first photo as profile photo if available
        const profilePhoto = photoUrls[0] || null;
        const salonPhotos = photoUrls;  // Remaining photos for the salon

        // Check if the user already exists by email
        const userExists = await User.findOne({ where: { email: email } });
        if (userExists) {
            return sendResponse(res, false, "Email already exists", null, 409);
        }

        // Find the default role for the salon
        const salonRole = await roles.findOne({ where: { role_name: role.SALON_OWNER } });
        if (!salonRole) {
            return sendResponse(res, false, "Salon owner role not found", null, 500);
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(req.body.password, 10);

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

        // Create a user for the salon owner
        const user = await User.create({
            username: username,
            firstname: firstname,
            lastname: lastname,
            email: email,
            google_token: "", // empty for now
            profile_photo: profilePhoto, // Assign the first photo as the profile photo
            password: hashedPassword,
            RoleId: salonRole.id,
            address: req.body.address, // Store address in User table
            mobile_number: req.body.phone_number, // Store phone number in User table as mobile_number
        });

        if(user){
            // Create the salon with the associated user
            let salon = await Salon.create({
                name: name,
                address: address,
                phone_number: phone_number,
                open_time: open_time,
                close_time: close_time,
                weekend_day: weekend_day || false,
                weekend_start: weekend_start || null,
                weekend_end: weekend_end || null,
                photos: JSON.stringify(salonPhotos), // store remaining photos as JSON array
                services: services,
                pricing: pricing,
                UserId: user.id,
                google_url: google_url,
                status: status
            });

            // Reload the salon instance to include the user
            salon = await Salon.findOne({
                where: { id: salon.id },
                include: [{ model: User, as: 'user', attributes: { exclude: ['password'] } }]
            });

            // Send confirmation email to the salon owner
            const sendSalonEmail = {
                email: email,
                password: password,
                company_name: 'Shear Brilliance',
                currentYear: new Date().getFullYear() 
            };

            // Send confirmation email (you can replace `sendEmail` with actual email sending logic)
            await sendEmail(email, "Added as a Salon", INVITE_SALON_TEMPLATE_ID, sendSalonEmail);

            return sendResponse(res, true, "Salon created successfully", { salon }, 201);
        }

        // Return success response with the created data
        return sendResponse(res, true, 'Something went wrong', null, 500);
    
    } catch (error) {
        console.error('Error creating salon:', error);
        return sendResponse(res, false, error.message || 'An error occurred while creating the salon', null, 400);
    }
};


// Find all salons with optional filtering for favorites
exports.findAll = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;

        // Check if the 'favorites' query parameter is true
        const includeFavorites = req.query.favorites === 'true';

        // Check if the 'onlyfavorites' query parameter is true
        const onlyFavorites = req.query.onlyfavorites === 'true';

        const { searchName } = req.query;

        // Initialize salon filter
        const salonFilter = {};

        // Apply search filters if provided
        if (searchName) {
            salonFilter[Op.or] = [
                { name: { [Op.iLike]: `%${searchName}%` } },
                { address: { [Op.iLike]: `%${searchName}%` } }
            ];
        }

        // If 'onlyfavorites' is true, we fetch only the salons marked as 'like' by the user
        if (onlyFavorites && userId) {
            const favoriteSalons = await FavoriteSalon.findAll({
                where: { UserId: userId, status: 'like' },
                attributes: ['SalonId']
            });

            if (favoriteSalons.length === 0) {
                return sendResponse(res, true, "No favorite salons found", [], 200);
            }

            const favoriteSalonIds = favoriteSalons.map(fav => fav.SalonId);
            salonFilter.id = { [Op.in]: favoriteSalonIds };
        }

        // Fetch salons based on the filter
        const salons = await Salon.findAll({
            where: salonFilter,
            attributes: ['id', 'name', 'address', 'photos', 'phone_number', 'open_time', 'close_time', 'google_url', 'status', 'services', 'pricing', 'faq', 'weekend_day', 'weekend_start', 'weekend_end', 'UserId'],
            include: [
                {
                    model: User,   // This is the association you want to include
                    as: 'user',         // Use the alias you defined in the association (if any)
                    attributes: { exclude: ['password'] } // Exclude password from User
                }
            ],
            order: [['createdAt', 'DESC']],
        });

        let favoriteSalonIds = [];

        if (includeFavorites && userId) {
            const favoriteSalons = await FavoriteSalon.findAll({
                where: { UserId: userId, status: 'like' },
                attributes: ['SalonId']
            });
            favoriteSalonIds = favoriteSalons.map(fav => fav.SalonId);
        }

        // Process each salon to add appointment count, barbers, and estimated wait time
        const salonsWithDetails = await Promise.all(salons.map(async (salon) => {
            const appointmentCount = await Appointment.count({
                where: { SalonId: salon.id }
            });

            const barberWhereClause = {};
            if (salon.id) barberWhereClause.SalonId = salon.id; // Add SalonId filter if provided
            barberWhereClause.category = BarberCategoryENUM.ForWalkIn;


             // Automatically calculate today's date range
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
            const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

            // Define where clause for barber sessions
            const sessionWhereClause = {
                session_date: {
                    [Op.between]: [todayStart.toISOString(), todayEnd.toISOString()] // Filter for today's session_date
                }
            };

            // If the user is a customer, add the current time filter
            if (userId && req?.user?.role === role.CUSTOMER) {
                const currentTime = new Date().toTimeString().split(" ")[0]; // Get current time in HH:MM:SS format
                sessionWhereClause[Op.and] = [
                    { start_time: { [Op.lte]: currentTime } }, // Current time is after or equal to start_time
                    { end_time: { [Op.gte]: currentTime } }   // Current time is before or equal to end_time
                ];
            }

            // Fetch barber sessions
            const barberSessionsData = await BarberSession.findAll({
                where: sessionWhereClause,
                order: [['start_time', 'ASC']],
                include: [
                {
                    model: Barber,
                    as: 'barber',
                    where: barberWhereClause, // Conditionally filter by SalonId and BarberId
                    attributes: { exclude: ['createdAt', 'updatedAt'] },
                    include: [
                    {
                        model: Salon,
                        as: 'salon',
                        attributes: { exclude: ['createdAt', 'updatedAt'] }
                    },
                    {
                        model: User,
                        as: 'user',
                        attributes: { exclude: ['password'] }
                    }
                    ]
                }
                ]
            });

            // const barbers = await Barber.findAll({
            //     where: { SalonId: salon.id },
            //     attributes: ['id', 'name', 'default_service_time', 'cutting_since', 'organization_join_date', 'photo', 'availability_status']
            // });

            const barbersWithWaitTime = await Promise.all(barberSessionsData.map(async (session) => {
                const barberWaitTime = await getEstimatedWaitTimeForBarber(session.BarberId);
                return {
                    barber_id: session.barber.id,
                    barber_name: session.barber.name,
                    cutting_since: session.barber.cutting_since,
                    organization_join_date: session.barber.organization_join_date,
                    photo: session.barber.photo,
                    estimated_wait_time: barberWaitTime.totalWaitTime,
                    availability_status: session.barber.availability_status
                };
            }));

            const totalWaitTime = barbersWithWaitTime.reduce((sum, barber) => sum + barber.estimated_wait_time, 0);
            const averageWaitTime = barbersWithWaitTime.length > 0 ? Math.floor(totalWaitTime / barbersWithWaitTime.length) : 0;

            const waitTimes = barbersWithWaitTime.map(barber => barber.estimated_wait_time);
            const minWaitTime = waitTimes.length > 0 ? Math.min(...waitTimes) : 0;
            const maxWaitTime = waitTimes.length > 0 ? Math.max(...waitTimes) : 0;

            // Check if the salon is liked by the user
            const isLike = favoriteSalonIds.includes(salon.id);

            return {
                salon: salon,
                salon_id: salon.id,
                salon_name: salon.name,
                address: salon.address,
                appointment_count: appointmentCount,
                is_like: isLike,
                barbers: barbersWithWaitTime,
                estimated_wait_time: totalWaitTime,  // Add total estimated wait time here
                average_wait_time: averageWaitTime,
                min_wait_time: minWaitTime,              // Minimum estimated wait time
                max_wait_time: maxWaitTime            // Maximum estimated wait time  
            };
        }));

        //Sort salons with `is_like = true` first if `includeFavorites` is true and userId is present
        if (includeFavorites && userId) {
            salonsWithDetails.sort((a, b) => (b.is_like === true) - (a.is_like === true));
        }
        sendResponse(res, true, "Salons fetched successfully", salonsWithDetails, 200);
    } catch (error) {
        console.error("Error fetching salons:", error);
        sendResponse(res, false, error.message, null, 500);
    }
};

// Find all salons with optional filtering for favorites
exports.adminSalonfindAll = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;

        // Extract query parameters
        const { page = 1, limit = 10, searchName } = req.query;
        const offset = (page - 1) * limit;

        // Check if the 'favorites' query parameter is true
        const includeFavorites = req.query.favorites === 'true';

        // Check if the 'onlyfavorites' query parameter is true
        const onlyFavorites = req.query.onlyfavorites === 'true';

        // Initialize filters
        const salonFilter = {};
      
        // Apply search filters if provided
        if (searchName) {
             // Check if searchName matches allowed enum values for status (open/close)
             const allowedStatusValues = ['open', 'close']; // Enum values for salon status
             if (allowedStatusValues.includes(searchName)) {
                 salonFilter.status = { [Op.eq]: searchName }; // Strict comparison for status enum
             } else {
                salonFilter[Op.or] = [
                    // Search by salon name
                    { 
                        name: { [Op.iLike]: `%${searchName}%` } 
                    },
                    {
                        '$user.username$': { [Op.iLike]: `%${searchName}%` } // Search for username
                    }
                ];
             }
        }


        // If 'onlyfavorites' is true, we fetch only the salons marked as 'like' by the user
        if (onlyFavorites && userId) {
            const favoriteSalons = await FavoriteSalon.findAll({
                where: { UserId: userId, status: 'like' },
                attributes: ['SalonId']
            });

            if (favoriteSalons.length === 0) {
                return sendResponse(res, true, "No favorite salons found", {
                    totalItems: 0,
                    totalPages: 0,
                    currentPage: page,
                    salons: []
                }, 200);
            }

            const favoriteSalonIds = favoriteSalons.map(fav => fav.SalonId);
            salonFilter.id = { [Op.in]: favoriteSalonIds };
        }


        // If user is a Barber, filter by their associated SalonId (from Barber table)
        if (req.user.role === role.BARBER && req.user.barberId) {
            const barber = await Barber.findOne({
                where: { id: req.user.barberId },
                attributes: ['SalonId']
            });
            if (barber && barber.SalonId) {
                salonFilter.id = barber.SalonId; // Fetch salons based on the barber's SalonId
            }
        }
         // If salon manager (e.g., user role is salon manager), filter by salon
        if (req.user.role === role.SALON_MANAGER || req.user.role === role.SALON_OWNER) {
            salonFilter.id = req.user.salonId; // Assuming you have a salonId associated with the user
        }

        // Fetch salons based on the filter
        const salons = await Salon.findAndCountAll({
            where: salonFilter,
            attributes: ['id', 'name', 'address', 'photos', 'phone_number', 'open_time', 'close_time', 'google_url', 'status', 'services', 'pricing', 'faq', 'weekend_day', 'weekend_start', 'weekend_end', 'UserId'],
            include: [
                {
                    model: User,   // This is the association you want to include
                    as: 'user' ,         // Use the alias you defined in the association (if any)
                    attributes: { exclude: ['password'] } // Exclude password from User
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit), // Pagination limit
            offset: parseInt(offset) // Pagination offset
        });

        let favoriteSalonIds = [];

        if (includeFavorites && userId) {
            const favoriteSalons = await FavoriteSalon.findAll({
                where: { UserId: userId, status: 'like' },
                attributes: ['SalonId']
            });
            favoriteSalonIds = favoriteSalons.map(fav => fav.SalonId);
        }

        // Process each salon to add appointment count, barbers, and estimated wait time
        const salonsWithDetails = await Promise.all(salons.rows.map(async (salon) => {
            const appointmentCount = await Appointment.count({
                where: { SalonId: salon.id }
            });

            const barbers = await Barber.findAll({
                where: { SalonId: salon.id },
                attributes: ['id', 'name', 'cutting_since', 'organization_join_date', 'photo','availability_status']
            });

            const barbersWithWaitTime = await Promise.all(barbers.map(async (barber) => {
                const barberWaitTime = await getEstimatedWaitTimeForBarber(barber.id);
                return {
                    barber_id: barber.id,
                    barber_name: barber.name,
                    cutting_since: barber.cutting_since,
                    organization_join_date: barber.organization_join_date,
                    photo: barber.photo,
                    estimated_wait_time: barberWaitTime.totalWaitTime,
                    availability_status:barber.availability_status
                };
            }));

            const totalWaitTime = barbersWithWaitTime.reduce((sum, barber) => sum + barber.estimated_wait_time, 0);
            const averageWaitTime = barbersWithWaitTime.length > 0 ? Math.floor(totalWaitTime / barbersWithWaitTime.length) : 0;

            const waitTimes = barbersWithWaitTime.map(barber => barber.estimated_wait_time);
            const minWaitTime = waitTimes.length > 0 ? Math.min(...waitTimes) : 0;
            const maxWaitTime = waitTimes.length > 0 ? Math.max(...waitTimes) : 0;

            // Check if the salon is liked by the user
            const isLike = favoriteSalonIds.includes(salon.id);

            return {
                salon: salon,
                salon_id: salon.id,
                salon_name: salon.name,
                address: salon.address,
                appointment_count: appointmentCount,
                is_like: isLike,
                barbers: barbersWithWaitTime,
                estimated_wait_time: totalWaitTime,  // Add total estimated wait time here
                average_wait_time: averageWaitTime,
                min_wait_time: minWaitTime,              // Minimum estimated wait time
                max_wait_time: maxWaitTime            // Maximum estimated wait time  
            };
        }));

        //Sort salons with `is_like = true` first if `includeFavorites` is true and userId is present
        if (includeFavorites && userId) {
            salonsWithDetails.sort((a, b) => (b.is_like === true) - (a.is_like === true));
        }
         // Calculate total pages
         const totalPages = Math.ceil(salons.count / limit);

         // Respond with the result
         sendResponse(res, true, "Salons fetched successfully", {
             totalItems: salons.count,
             totalPages,
             currentPage: parseInt(page),
             salons: salonsWithDetails
         }, 200);
         
    } catch (error) {
        console.error("Error fetching salons:", error);
        sendResponse(res, false, error.message, null, 500);
    }
};


// Get a salon by ID with estimated wait time and weekend details
exports.findOne = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        const includeFavorites = req.query.favorites === 'true';

        // Find the salon by ID
        const salon = await Salon.findByPk(req.params.id, {
            attributes: ['id', 'name', 'address', 'photos', 'phone_number', 'open_time', 'close_time', 'google_url', 'status', 'services', 'pricing', 'faq', 'weekend_day', 'weekend_start', 'weekend_end']
        });

        if (!salon) {
            return sendResponse(res, false, "Salon not found", null, 404);
        }

        // Fetch appointment count for the salon
        const appointmentCount = await Appointment.count({
            where: { SalonId: salon.id }
        });

        const barberWhereClause = {};
        if (salon.id) barberWhereClause.SalonId = salon.id; // Add SalonId filter if provided
        barberWhereClause.category = BarberCategoryENUM.ForWalkIn;

         // Automatically calculate today's date range
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

        // Define where clause for barber sessions
        const sessionWhereClause = {
            session_date: {
                [Op.between]: [todayStart.toISOString(), todayEnd.toISOString()] // Filter for today's session_date
            }
        };

        // If the user is a customer, add the current time filter
        if (userId && req?.user?.role === role.CUSTOMER) {
            const currentTime = new Date().toTimeString().split(" ")[0]; // Get current time in HH:MM:SS format
            sessionWhereClause[Op.and] = [
                { start_time: { [Op.lte]: currentTime } }, // Current time is after or equal to start_time
                { end_time: { [Op.gte]: currentTime } }   // Current time is before or equal to end_time
            ];
        }

        // Fetch barber sessions
        const barberSessionsData = await BarberSession.findAll({
            where: sessionWhereClause,
            order: [['start_time', 'ASC']],
            include: [
            {
                model: Barber,
                as: 'barber',
                where: barberWhereClause, // Conditionally filter by SalonId and BarberId
                attributes: { exclude: ['createdAt', 'updatedAt'] },
                include: [
                {
                    model: Salon,
                    as: 'salon',
                    attributes: { exclude: ['createdAt', 'updatedAt'] }
                },
                {
                    model: User,
                    as: 'user',
                    attributes: { exclude: ['password'] }
                }
                ]
            }
            ]
        });


        // Fetch barbers and calculate estimated wait times for each barber
        // const barbers = await Barber.findAll({
        //     where: { SalonId: salon.id },
        //     attributes: ['id', 'name', 'default_service_time', 'cutting_since', 'organization_join_date', 'photo', 'availability_status']
        // });

        const barbersWithWaitTime = await Promise.all(barberSessionsData.map(async (session) => {
            const barberWaitTime = await getEstimatedWaitTimeForBarber(session.BarberId);
            return {
                barber_id: session.barber.id,
                barber_name: session.barber.name,
                cutting_since: session.barber.cutting_since,
                organization_join_date: session.barber.organization_join_date,
                photo: session.barber.photo,
                estimated_wait_time: barberWaitTime.totalWaitTime,
                availability_status: session.barber.availability_status
            };
        }));


        // Check if the salon is a favorite for the user, if applicable
        let isFavorite = false;
        let isLike = false;
        if (includeFavorites && userId) {
            const favorite = await FavoriteSalon.findOne({
                where: { UserId: userId, SalonId: salon.id, status: 'like' },
                attributes: ['SalonId']
            });
            isFavorite = !!favorite;
            isLike = isFavorite;
        }



        // Calculate the total estimated wait time for all barbers in this salon
        const totalWaitTime = barbersWithWaitTime.reduce((sum, barber) => sum + barber.estimated_wait_time, 0);
        const averageWaitTime = barbersWithWaitTime.length > 0 ? Math.floor(totalWaitTime / barbersWithWaitTime.length) : 0;

        const waitTimes = barbersWithWaitTime.map(barber => barber.estimated_wait_time);
        const minWaitTime = waitTimes.length > 0 ? Math.min(...waitTimes) : 0;
        const maxWaitTime = waitTimes.length > 0 ? Math.max(...waitTimes) : 0;


        sendResponse(res, true, "Salon fetched successfully", {
            salon: salon,
            salon_id: salon.id,
            salon_name: salon.name,
            address: salon.address,
            appointment_count: appointmentCount,
            barbers: barbersWithWaitTime,
            is_like: isLike,
            estimated_wait_time: totalWaitTime,  // Add total estimated wait time here
            average_wait_time: averageWaitTime,
            min_wait_time: minWaitTime,              // Minimum estimated wait time
            max_wait_time: maxWaitTime
        }, 200);

    } catch (error) {
        console.error("Error fetching salon:", error);
        sendResponse(res, false, error.message, null, 500);
    }
};

// Update a salon by ID (including photo uploads and weekend details)
exports.update = async (req, res) => {
    try {
        let updates = { ...req.body };

        // Validate required fields before proceeding
        const requiredFields = [
            { name: 'name', value: updates.name },
            { name: 'firstname', value: updates.firstname },
            { name: 'lastname', value: updates.lastname },
            { name: 'address', value: updates.address },
            { name: 'phone_number', value: updates.phone_number },
        ];

        // Validate required fields (skip password if not being updated)
        for (const field of requiredFields) {
            if (field.value !== undefined) {
                // Use specific validation for address
                if (field.name === 'address') {
                    if (!validateInput(field.value, 'address')) {
                        return sendResponse(res, false, `Enter valid ${field.name}`, null, 400);
                    }
                } else {
                    // General whitespace validation for other fields
                    if (!validateInput(field.value, 'whitespace')) {
                        return sendResponse(res, false, `Enter valid ${field.name}`, null, 400);
                    }
                }
            }
        }

        // Name validation for salonName, firstname and lastname
        if (!validateInput(updates.name, 'nameRegex')) {
            return sendResponse(res, false, 'Salon name must contain only letters and spaces.', null, 400);
        }

        if (!validateInput(updates.firstname, 'nameRegex')) {
            return sendResponse(res, false, 'Firstname must contain only letters and spaces.', null, 400);
        }
    
        if (!validateInput(updates.lastname, 'nameRegex')) {
            return sendResponse(res, false, 'Lastname must contain only letters and spaces.', null, 400);
        }

        // Validate phone number format if provided
        if (updates.phone_number !== undefined && !validateInput(updates.phone_number, 'phone_number')) {
            return sendResponse(res, false, 'Enter valid phone number', null, 400);
        }

        let newPhotoUrls = [];

        // Find the salon record
        let salon = await Salon.findOne({
            where: { id: req.params.id },
            include: [
                {
                    model: User,
                    as: 'user', // Association alias
                    attributes: { exclude: ['password'] } // Exclude password from User
                }
            ]
        });

        if (!salon) {
            return sendResponse(res, false, "Salon not found", null, 404);
        }

        // Check if salon status is changing to 'closed' and cancel appointments
        if (req.body.status && req.body.status === 'close' && salon.status !== 'close') {
            const cancellationResult = await cancelCheckedInAppointments(salon.id);
            if (!cancellationResult) {
                return sendResponse(res, false, "Error canceling appointments", null, 500);
            }
            console.log(`Appointments were canceled for Salon ID ${salon.id}`);
        }

        // Check if new photos are uploaded
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const fileBuffer = file.buffer;

                // Upload each photo to DigitalOcean Spaces
                const params = {
                    Bucket: process.env.DO_SPACES_BUCKET, // The name of your DigitalOcean Space
                    Key: `salon-photos/${Date.now()}-${file.originalname}`, // Unique file name
                    Body: fileBuffer,
                    ACL: 'public-read', // Make the file publicly accessible
                    ContentType: file.mimetype, // Set content type based on MIME
                };

                const result = await s3.upload(params).promise();
                newPhotoUrls.push(result.Location); // Add URL of uploaded photo
            }
            updates.photos = JSON.stringify(newPhotoUrls); // Update photos
        } else {
            // If no new photos, retain the current salon photos
            updates.photos = salon.photos;
        }

        // Update the google_url only if it's defined, otherwise retain the current value
        if (req.body.google_url !== undefined && req.body.google_url !== null) {
            updates.google_url = req.body.google_url;
        } else {
            updates.google_url = salon.google_url; // Retain existing value
        }

        // Update weekend information if provided
        if (req.body.weekend_day !== undefined) updates.weekend_day = req.body.weekend_day;
        if (req.body.weekend_start !== undefined) updates.weekend_start = req.body.weekend_start;
        if (req.body.weekend_end !== undefined) updates.weekend_end = req.body.weekend_end;
        if (req.body.status !== undefined) updates.status = req.body.status;
        if (req.body.address !== undefined) updates.address = req.body.address;
        

        // Update the salon record
        await salon.update(updates);

        // Access associated user
        const user = salon.user;

        // Update user details if provided
        const userUpdates = {
            firstname: req.body.firstname || user.firstname,
            lastname: req.body.lastname || user.lastname,
            address: req.body.address || user.address,
            mobile_number: req.body.phone_number || user.phone_number
        };

        // Handle profile photo update if included in req.body
        if (req.body.profile_photo) {
            userUpdates.profile_photo = req.body.profile_photo;
        }

        // Update user information
        await user.update(userUpdates);

        salon = await Salon.findOne({
            where: { id: salon.id },
            include: [{ model: User, as: 'user', attributes: { exclude: ['password'] } }]
        });

        // Return successful response
        return sendResponse(res, true, "Salon and associated user updated successfully", { salon }, 200);
    } catch (error) {
        console.error('Error updating salon:', error);
        return sendResponse(res, false, error.message || 'An error occurred while updating the salon', null, 500);
    }
};



// Delete a salon by ID
exports.delete = async (req, res) => {
    try {
        console.log("SalonId:", req.params.id);

        // Find the salon and associated user
        const salon = await Salon.findOne({
            where: { id: req.params.id },
            include: [{ model: User, as: 'user' }],
        });

        // If salon not found, return error
        if (!salon) {
            return sendResponse(res, false, "Salon not found", null, 404);
        }

        // Delete the associated user
        if (salon.user) {
            await User.destroy({ where: { id: salon.user.id } });
        }

        // Delete the salon
        await Salon.destroy({ where: { id: req.params.id } });

        // Return success response
        sendResponse(res, true, "Salon and associated user deleted successfully", null, 200);
    } catch (error) {
        console.error("Error deleting salon:", error);
        sendResponse(res, false, "Error deleting salon", error.message, 500);
    }
};

// Controller to update the status of a Salon by ID
exports.updateStatus = async (req, res) => {
    try {
        const { status } = req.body;

        // Validate request body
        if (!status) {
            return sendResponse(res, false, "Status is required", null, 400);
        }

        // Normalize status to lowercase
        const normalizedStatus = status.toLowerCase();

        // Allowed statuses based on your ENUM definition
        const allowedStatuses = ['open', 'close'];
        if (!allowedStatuses.includes(normalizedStatus)) {
            return sendResponse(res, false, "Invalid status value. Allowed values are 'open' or 'close'.", null, 400);
        }

        // Find the salon record by ID
        let salon = await Salon.findOne({ where: { id: req.user.salonId } });

        if (!salon) {
            return sendResponse(res, false, "Salon not found", null, 404);
        }

        // If changing status to 'close', handle additional logic (e.g., cancel appointments)
        if (normalizedStatus === 'close' && salon.status !== 'close') {
            const cancellationResult = await cancelCheckedInAppointments(salon.id);
            if (!cancellationResult) {
                return sendResponse(res, false, "Error canceling appointments", null, 500);
            }
            console.log(`Checked-in appointments canceled for Salon ID ${salon.id}`);
        }

        // Update the status
        salon.status = normalizedStatus;
        await salon.save(salon);

        // Return successful response
        return sendResponse(res, true, "Salon status updated successfully", { salon }, 200);
    } catch (error) {
        console.error('Error updating salon status:', error);
        return sendResponse(res, false, error.message || "An error occurred while updating the salon status", null, 500);
    }
};



