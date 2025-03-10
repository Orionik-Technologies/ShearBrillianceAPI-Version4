const db = require("../models");
const Salon = db.Salon;
const Barber = db.Barber;
const Appointment = db.Appointment;
const AppointmentService = db.AppointmentService;
const Service =db.Service;
const User = db.USER;
const Payment = db.Payment;
const { role } = require('../config/roles.config');
const jwt = require('jsonwebtoken');
const roles = db.roles;
const { Op } = require('sequelize'); // Make sure you import Op from Sequelize for date comparisons
const moment = require('moment'); // You can use the moment library to easily work with dates
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const sendResponse = require('../helpers/responseHelper');  // Import the helper
const { put } = require('@vercel/blob'); // Import 'put' directly if using Vercel's blob SDK upload method
const AWS = require('aws-sdk');
const userTimezone = 'America/Toronto';
// const puppeteer = require('puppeteer');
const pdf = require('html-pdf');
const s3 = new AWS.S3({
    endpoint: new AWS.Endpoint('https://tor1.digitaloceanspaces.com'), // Replace with your DigitalOcean Spaces endpoint
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});



// Helper function to get the date range
function getDateRange(filter) {
    const today = moment(); // Get the current date using moment
    let startDate, endDate;

    if (filter === 'last_7_days') {
        startDate = moment().subtract(7, 'days').startOf('day'); // Subtract 7 days and set to start of the day
    } else if (filter === 'last_30_days') {
        startDate = moment().subtract(30, 'days').startOf('day'); // Subtract 30 days and set to start of the day
    }

    endDate = today.endOf('day'); // Set the end date to the end of the current day
    return { startDate, endDate };
}

// Helper function to format sales data
function formatSalesData(salesData, startDate, endDate) {
    const formattedData = [];
    const dateMap = {};

    // Initialize the date map with all dates in the range
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateString = currentDate.toISOString().split('T')[0];
        dateMap[dateString] = { date: dateString, appointments: 0, revenue: 0 };
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Populate the date map with actual sales data
    salesData.forEach((data) => {
        const date = data.date;
        dateMap[date] = {
            date,
            appointments: parseInt(data.appointments, 10),
            revenue: parseFloat(data.revenue || 0).toFixed(2),
        };
    });

    // Convert the date map to an array
    for (const date in dateMap) {
        formattedData.push(dateMap[date]);
    }

    return formattedData;
}

exports.getAppointmentSalesData = async (req, res) => {
    const { filter } = req.query;

    try {

        // Step 1: Extract the userId from the JWT token (req.user should already have the decoded token)
        const userId = req.user ? req.user.id : null;
        
        if (!userId) {
                      return res.status(401).json({ success: false, message: 'Unauthorized: No user ID found', code: 401 });
        }
          
        // Step 2: Fetch the user and their role (ensure the role is included in the query)
        const user = await User.findByPk(userId, { include: {
                      model: roles,  // Include the associated Role model
                      as: 'role',    // Alias for the Role model (adjust based on your model's actual alias)
        } });
          
        if (!user || !user.role) {
                      return res.status(403).json({ success: false, message: 'Unauthorized User' });
        }
          
        const userRole = user.role.role_name;


        // Validate filter
        if (!filter || !['last_7_days', 'last_30_days'].includes(filter)) {
            return res.status(400).json({ success: false, message: 'Invalid filter' });
        }

        // Get date range
        const { startDate, endDate } = getDateRange(filter);

        let salesData = [];
        if (userRole === role.ADMIN) {
            // Query for completed appointments within the date range
            salesData = await Appointment.findAll({
                attributes: [
                    [db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.appointment_date')), 'date'], // Group by date
                    [db.Sequelize.fn('COUNT',db.Sequelize.col('Appointment.id')), 'appointments'], // Count appointments
                    [db.Sequelize.fn('SUM', db.Sequelize.col('Services.max_price')), 'revenue'],
                    [db.Sequelize.fn('SUM', db.Sequelize.col('Services.min_price')), 'revenue'], // Sum of service prices
                ],
                where: {
                    status: 'completed',
                    appointment_date: {
                        [Op.between]: [startDate, endDate],
                    },
                },
                include: [
                    {
                        model: Service,
                        through: { attributes: [] }, // Exclude intermediate table fields
                        attributes: [], // Only need the price field
                    },
                ],
                group: [db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.appointment_date'))], // Group by date
                order: [[db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.appointment_date')), 'ASC']], // Order by date
                raw: true, // Return raw data
            });
        }
        else if(userRole === role.SALON_MANAGER){
            // Query for completed appointments within the date range
            salesData = await Appointment.findAll({
                attributes: [
                    [db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.appointment_date')), 'date'], // Group by date
                    [db.Sequelize.fn('COUNT',db.Sequelize.col('Appointment.id')), 'appointments'], // Count appointments
                    [db.Sequelize.fn('SUM', db.Sequelize.col('Services.max_price')), 'revenue'],
                    [db.Sequelize.fn('SUM', db.Sequelize.col('Services.min_price')), 'revenue'], // Sum of service prices
                ],
                where: {
                    status: 'completed',
                    appointment_date: {
                        [Op.between]: [startDate, endDate],
                    },
                    SalonId: req.user.salonId
                },
                include: [
                    {
                        model: Service,
                        through: { attributes: [] }, // Exclude intermediate table fields
                        attributes: [], // Only need the price field
                    },
                ],
                group: [db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.appointment_date'))], // Group by date
                order: [[db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.appointment_date')), 'ASC']], // Order by date
                raw: true, // Return raw data
            });
        }
        
        // Format the response
        const formattedData = formatSalesData(salesData, startDate, endDate);

        res.json({
            success: true,
            message: 'Sales data retrieved successfully',
            data: formattedData,
        });
    } catch (error) {
        console.error('Error fetching sales data:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getWalkInSalesData = async (req, res) => {
    const { filter } = req.query;

    try {

        // Step 1: Extract the userId from the JWT token (req.user should already have the decoded token)
        const userId = req.user ? req.user.id : null;
        
        if (!userId) {
                      return res.status(401).json({ success: false, message: 'Unauthorized: No user ID found', code: 401 });
        }
          
        // Step 2: Fetch the user and their role (ensure the role is included in the query)
        const user = await User.findByPk(userId, { include: {
                      model: roles,  // Include the associated Role model
                      as: 'role',    // Alias for the Role model (adjust based on your model's actual alias)
        } });
          
        if (!user || !user.role) {
                      return res.status(403).json({ success: false, message: 'Unauthorized User' });
        }
          
        const userRole = user.role.role_name;


        // Validate filter
        if (!filter || !['last_7_days', 'last_30_days'].includes(filter)) {
            return res.status(400).json({ success: false, message: 'Invalid filter' });
        }

        // Get date range
        const { startDate, endDate } = getDateRange(filter);

        let salesData = [];
        if (userRole === role.ADMIN) {
            // Query for completed appointments within the date range
            salesData = await Appointment.findAll({
                attributes: [
                    [db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.createdAt')), 'date'], // Group by date
                    [db.Sequelize.fn('COUNT',db.Sequelize.col('Appointment.id')), 'appointments'], // Count appointments
                    [db.Sequelize.fn('SUM', db.Sequelize.col('Services.max_price')), 'revenue'],
                    [db.Sequelize.fn('SUM', db.Sequelize.col('Services.min_price')), 'revenue'], // Sum of service prices
                ],
                where: {
                    status: 'completed',
                    createdAt: {
                        [Op.between]: [startDate, endDate],
                    },
                },
                include: [
                    {
                        model: Service,
                        through: { attributes: [] }, // Exclude intermediate table fields
                        attributes: [], // Only need the price field
                    },
                ],
                group: [db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.createdAt'))], // Group by date
                order: [[db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.createdAt')), 'ASC']], // Order by date
                raw: true, // Return raw data
            });
        }
        else if(userRole === role.SALON_MANAGER){
            // Query for completed appointments within the date range
            salesData = await Appointment.findAll({
                attributes: [
                    [db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.createdAt')), 'date'], // Group by date
                    [db.Sequelize.fn('COUNT',db.Sequelize.col('Appointment.id')), 'appointments'], // Count appointments
                    [db.Sequelize.fn('SUM', db.Sequelize.col('Services.max_price')), 'revenue'],
                    [db.Sequelize.fn('SUM', db.Sequelize.col('Services.min_price')), 'revenue'], // Sum of service prices
                ],
                where: {
                    status: 'completed',
                    createdAt: {
                        [Op.between]: [startDate, endDate],
                    },
                    SalonId: req.user.salonId
                },
                include: [
                    {
                        model: Service,
                        through: { attributes: [] }, // Exclude intermediate table fields
                        attributes: [], // Only need the price field
                    },
                ],
                group: [db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.createdAt'))], // Group by date
                order: [[db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.createdAt')), 'ASC']], // Order by date
                raw: true, // Return raw data
            });
        }
        
        // Format the response
        const formattedData = formatSalesData(salesData, startDate, endDate);

        res.json({
            success: true,
            message: 'Sales data retrieved successfully',
            data: formattedData,
        });
    } catch (error) {
        console.error('Error fetching sales data:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.gettopService = async (req, res) => {
    try {

        // Step 1: Extract the userId from the JWT token (req.user should already have the decoded token)
        const userId = req.user ? req.user.id : null;
        
        if (!userId) {
                      return res.status(401).json({ success: false, message: 'Unauthorized: No user ID found', code: 401 });
        }
          
        // Step 2: Fetch the user and their role (ensure the role is included in the query)
        const user = await User.findByPk(userId, { include: {
                      model: roles,  // Include the associated Role model
                      as: 'role',    // Alias for the Role model (adjust based on your model's actual alias)
        } });
          
        if (!user || !user.role) {
                      return res.status(403).json({ success: false, message: 'Unauthorized User' });
        }
          
        const userRole = user.role.role_name;

        let topServicesWithDetails = [];
        if (userRole === role.ADMIN) {
            // Fetch top 5 services by number of appointments
            const topServices = await AppointmentService.findAll({
                attributes: [
                    'ServiceId',
                    [db.sequelize.fn('COUNT', db.sequelize.col('AppointmentId')), 'usageCount']
                ],
                group: ['ServiceId'],
                order: [[db.sequelize.fn('COUNT', db.sequelize.col('AppointmentId')), 'DESC']],
                limit: 5,
            });

            // Fetch service details
            const serviceIds = topServices.map(service => service.ServiceId);
            const serviceDetails = await Service.findAll({
                where: { id: serviceIds },
                attributes: ['id', 'name', 'description', 'isActive'], // Add relevant fields
            });

            topServicesWithDetails = topServices.map(service => {
                const serviceInfo = serviceDetails.find(s => s.id === service.ServiceId);
                return {
                    serviceId: service.ServiceId,
                    usageCount: service.dataValues.usageCount,
                    serviceName: serviceInfo ? serviceInfo.name : 'Unknown',
                    serviceDescription: serviceInfo ? serviceInfo.description : 'No description',
                    servicePrice: serviceInfo ? serviceInfo.price : null,
                    serviceisActive: serviceInfo ? serviceInfo.isActive : 'Not found',
                };
            });
        }
        else if(userRole === role.SALON_MANAGER){
                // Query for service usage data
                const servicesUsage = await db.sequelize.query(
                    `
                    SELECT 
                      "AppointmentService"."ServiceId" AS serviceId,
                      COUNT("AppointmentService"."ServiceId") AS usageCount,
                      "Services"."name" AS serviceName,
                      "Services"."description" AS serviceDescription,
                      "Services"."isActive" AS serviceIsActive
                    FROM 
                      public."AppointmentServices" AS "AppointmentService"
                    INNER JOIN 
                      public."Services" ON "AppointmentService"."ServiceId" = "Services"."id"
                    INNER JOIN 
                      public."Appointments" ON "AppointmentService"."AppointmentId" = "Appointments"."id"
                    WHERE 
                      "Appointments"."SalonId" = :salonId
                    GROUP BY 
                      "AppointmentService"."ServiceId", 
                      "Services"."id", 
                      "Services"."name", 
                      "Services"."description", 
                      "Services"."isActive"
                    `,
                    {
                      replacements: { salonId: req.user.salonId }, // Replaces :salonId in the query
                      type: db.sequelize.QueryTypes.SELECT, // Specifies the query type
                    }
                  );
                   // Map the results to the desired format
                topServicesWithDetails = servicesUsage.map(service => ({
                    serviceId: service.serviceid,
                    usageCount: service.usagecount,
                    serviceName: service.servicename,
                    serviceDescription: service.servicedescription,
                    serviceIsActive: service.serviceisactive,
                }));
        }

        res.json({
            success: true,
            message: 'Top services data retrieved successfully',
            data: topServicesWithDetails,
        });
    } catch (error) {
        console.error('Error fetching sales data:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getTopSalons = async (req, res) => {
    try {
        // Step 1: Extract the userId from the JWT token (req.user should already have the decoded token)
        const userId = req.user ? req.user.id : null;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No user ID found', code: 401 });
        }

        // Step 2: Fetch the user and their role
        const user = await User.findByPk(userId, {
            include: {
                model: roles,  // Include the Role model
                as: 'role',    // Alias for the Role model
            }
        });

        if (!user || !user.role) {
            return res.status(403).json({ success: false, message: 'Unauthorized User' });
        }

        const userRole = user.role.role_name;

        let topSalonsWithDetails = [];
        if (userRole === role.ADMIN) {
            // Fetch top 3 salons by number of appointments
            const topSalons = await Appointment.findAll({
                attributes: [
                    'SalonId',
                    [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'appointmentsCount']
                ],
                group: ['SalonId'],
                order: [[db.sequelize.fn('COUNT', db.sequelize.col('id')), 'DESC']],
                limit: 3,
            });

            // Fetch salon details for the top 3 salons
            const salonIds = topSalons.map(salon => salon.SalonId);
            const salonData = await Salon.findAll({
                where: { id: salonIds },
                attributes: ['id', 'name'], // Fetch salon details like id and name
            });

            // Combine salon data with appointment counts
            topSalonsWithDetails = topSalons.map(salon => {
                const salonDetails = salonData.find(s => s.id === salon.SalonId);
                return {
                    salonId: salon.SalonId,
                    appointmentsCount: salon.dataValues.appointmentsCount,
                    salonName: salonDetails ? salonDetails.name : 'Unknown',
                };
            });
        } else if (userRole === role.SALON_MANAGER) {
            // For SALON_MANAGER, fetch data only for their specific salon
            const salonUsage = await db.sequelize.query(
                `
                SELECT 
                  "Appointments"."SalonId" AS salonId,
                  COUNT("Appointments"."id") AS appointmentsCount,
                  "Salons"."name" AS salonName
                FROM 
                  public."Appointments" AS "Appointments"
                INNER JOIN 
                  public."Salons" ON "Appointments"."SalonId" = "Salons"."id"
                WHERE 
                  "Appointments"."SalonId" = :salonId
                GROUP BY 
                  "Appointments"."SalonId", 
                  "Salons"."id", 
                  "Salons"."name"
                `,
                {
                    replacements: { salonId: req.user.salonId }, // Replace :salonId with the user's salonId
                    type: db.sequelize.QueryTypes.SELECT, // Specify query type
                }
            );

            // Map the results to the desired format
            topSalonsWithDetails = salonUsage.map(salon => ({
                salonId: salon.salonid,
                appointmentsCount: salon.appointmentscount,
                salonName: salon.salonname,
            }));
        }

        res.json({
            success: true,
            message: 'Top salons data retrieved successfully',
            data: topSalonsWithDetails,
        });
    } catch (error) {
        console.error('Error fetching top salons data:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getTopBarbers = async (req, res) => {
    try {
        // Step 1: Extract the userId from the JWT token (req.user should already have the decoded token)
        const userId = req.user ? req.user.id : null;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No user ID found', code: 401 });
        }

        // Step 2: Fetch the user and their role
        const user = await User.findByPk(userId, {
            include: {
                model: roles,  // Include the Role model
                as: 'role',    // Alias for the Role model
            }
        });

        if (!user || !user.role) {
            return res.status(403).json({ success: false, message: 'Unauthorized User' });
        }

        const userRole = user.role.role_name;

        let topBarbersWithDetails = [];
        if (userRole === role.ADMIN) {
            // Fetch top 5 barbers by number of appointments
            const topBarbers = await Appointment.findAll({
                attributes: [
                    'BarberId',
                    [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'appointmentsCount']
                ],
                group: ['BarberId'],
                order: [[db.sequelize.fn('COUNT', db.sequelize.col('id')), 'DESC']],
                limit: 3,
            });

            // Fetch barber details including SalonId and background_color
            const barberIds = topBarbers.map(barber => barber.BarberId);
            const barberData = await Barber.findAll({
                where: { id: barberIds },
                attributes: ['id', 'name', 'SalonId', 'background_color'], // Added background_color
            });

            // Fetch salon details for the barbers' salons
            const salonIds = barberData.map(barber => barber.SalonId).filter(id => id);
            const salonData = await Salon.findAll({
                where: { id: salonIds },
                attributes: ['id', 'name'],
            });

            // Map top barbers with their details including background_color
            topBarbersWithDetails = topBarbers.map(barber => {
                const barberDetails = barberData.find(b => b.id === barber.BarberId);
                const salonDetails = salonData.find(s => s.id === barberDetails?.SalonId);
                return {
                    barberId: barber.BarberId,
                    appointmentsCount: barber.dataValues.appointmentsCount,
                    barberName: barberDetails ? barberDetails.name : 'Unknown',
                    salonName: salonDetails ? salonDetails.name : 'Unknown',
                    backgroundColor: barberDetails ? barberDetails.background_color : null // Added background_color
                };
            });
        } else if (userRole === role.SALON_MANAGER) {
            // Query for barber usage data specific to the salon, including background_color
            const barbersUsage = await db.sequelize.query(
                `
                SELECT 
                  "Appointments"."BarberId" AS barberId,
                  COUNT("Appointments"."id") AS appointmentsCount,
                  "Barbers"."name" AS barberName,
                  "Salons"."name" AS salonName,
                  "Barbers"."background_color" AS backgroundColor
                FROM 
                  public."Appointments" AS "Appointments"
                INNER JOIN 
                  public."Barbers" ON "Appointments"."BarberId" = "Barbers"."id"
                INNER JOIN 
                  public."Salons" ON "Barbers"."SalonId" = "Salons"."id"
                WHERE 
                  "Appointments"."SalonId" = :salonId
                GROUP BY 
                  "Appointments"."BarberId", 
                  "Barbers"."id", 
                  "Barbers"."name",
                  "Salons"."id",
                  "Salons"."name",
                  "Barbers"."background_color"
                ORDER BY 
                  appointmentsCount DESC
                LIMIT 5
                `,
                {
                    replacements: { salonId: req.user.salonId },
                    type: db.sequelize.QueryTypes.SELECT,
                }
            );

            // Map the results to the desired format including backgroundColor
            topBarbersWithDetails = barbersUsage.map(barber => ({
                barberId: barber.barberid,
                appointmentsCount: barber.appointmentscount,
                barberName: barber.barbername,
                salonName: barber.salonname,
                backgroundColor: barber.backgroundcolor // Added backgroundColor
            }));
        }

        res.json({
            success: true,
            message: 'Top barbers data retrieved successfully',
            data: topBarbersWithDetails,
        });
    } catch (error) {
        console.error('Error fetching top barbers data:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};


exports.getPaymentData = async (req, res) => {
    try {
        const { filter } = req.query; // Accepts filter as query param: 'today', '7days', '30days'

        let startDate;
        const endDate = new Date(); // Current date
        if (filter === 'today') {
            startDate = new Date();
            startDate.setHours(0, 0, 0, 0); // Start of the day
        } else if (filter === '7days') {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
        } else if (filter === '30days') {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
        }

        const whereClause = startDate ? { createdAt: { [Op.between]: [startDate, endDate] } } : {};

        // Fetch appointments within the given timeframe
        const appointments = await Appointment.findAll({
            where: whereClause,
            attributes: ['id', 'paymentMode']
        });

        const appointmentIds = appointments.map(app => app.id);

        // Fetch payments with successful status linked to the filtered appointments
        const payments = await Payment.findAll({
            where: {
                appointmentId: { [Op.in]: appointmentIds },
                paymentStatus: 'Success'
            },
            attributes: ['appointmentId', 'totalAmount']
        });

        const paymentMap = payments.reduce((map, payment) => {
            map[payment.appointmentId] = payment.totalAmount;
            return map;
        }, {});

        // Calculate totals
        const totals = appointments.reduce((acc, appointment) => {
            const totalAmount = paymentMap[appointment.id];
            if (totalAmount) {
                if (appointment.paymentMode === 'Pay_Online') {
                    acc.online += parseFloat(totalAmount) || 0;
                } else if (appointment.paymentMode === 'Pay_In_Person') {
                    acc.offline += parseFloat(totalAmount) || 0;
                }
                acc.total += parseFloat(totalAmount) || 0;
            }
            return acc;
        }, { online: 0, offline: 0, total: 0 });

        return res.json({ success: true, data: totals });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error fetching revenue data', error: error.message });
    }
};


exports.generateSalesReport = async (req, res) => {
    const { startDate, endDate, salonId, barberId } = req.query;

    try {
        const userId = req.user ? req.user.id : null;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No user ID found', code: 401 });
        }

        const user = await User.findByPk(userId, {
            include: { model: roles, as: 'role' }
        });
        if (!user || !user.role) {
            return res.status(403).json({ success: false, message: 'Unauthorized User' });
        }
        const userRole = user.role.role_name;

        // Validate and normalize dates
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
        }

        const timezone = 'America/Toronto';
        const start = moment.tz(startDate, 'YYYY-MM-DD', timezone).startOf('day');
        const end = moment.tz(endDate, 'YYYY-MM-DD', timezone).endOf('day');

        if (!start.isValid() || !end.isValid() || start.isAfter(end)) {
            return res.status(400).json({ success: false, message: 'Invalid date range' });
        }
        const reportStartDate = start.toDate();
        const reportEndDate = end.toDate();

        let salesData = [];
        let paymentData = [];

        // Build dynamic where clause for appointments
        const appointmentWhereClause = {
            status: 'completed',
            createdAt: { [Op.between]: [reportStartDate, reportEndDate] },
        };
        if (salonId) appointmentWhereClause.SalonId = salonId;
        if (barberId) appointmentWhereClause.BarberId = barberId;

        // Fetch data based on user role
        if (userRole === role.ADMIN) {
            salesData = await Appointment.findAll({
                attributes: [
                    'SalonId',
                    [db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.createdAt')), 'date'],
                    [db.Sequelize.fn('COUNT', db.Sequelize.col('Appointment.id')), 'appointments'],
                    'paymentMode',
                ],
                where: appointmentWhereClause,
                group: [
                    'SalonId',
                    db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.createdAt')),
                    'paymentMode'
                ],
                order: [
                    'SalonId',
                    [db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.createdAt')), 'ASC'],
                    'paymentMode'
                ],
                raw: true,
            });

            paymentData = await Payment.findAll({
                attributes: [
                    [db.Sequelize.fn('DATE', db.Sequelize.col('createdAt')), 'date'],
                    [db.Sequelize.fn('SUM', db.Sequelize.col('totalAmount')), 'totalPayment'],
                ],
                where: {
                    paymentStatus: 'Success',
                    createdAt: { [Op.between]: [reportStartDate, reportEndDate] },
                },
                group: [db.Sequelize.fn('DATE', db.Sequelize.col('createdAt'))],
                order: [[db.Sequelize.fn('DATE', db.Sequelize.col('createdAt')), 'ASC']],
                raw: true,
            });
        } else if (userRole === role.SALON_MANAGER) {
            // For SALON_MANAGER, ensure SalonId matches user's salon unless overridden by query
            appointmentWhereClause.SalonId = salonId || req.user.salonId;

            salesData = await Appointment.findAll({
                attributes: [
                    'SalonId',
                    [db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.createdAt')), 'date'],
                    [db.Sequelize.fn('COUNT', db.Sequelize.col('Appointment.id')), 'appointments'],
                    [db.Sequelize.fn('SUM', db.Sequelize.col('Services.max_price')), 'revenue'],
                    'paymentMode',
                ],
                where: appointmentWhereClause,
                include: [{ model: Service, through: { attributes: [] }, attributes: [] }],
                group: [
                    'SalonId',
                    db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.createdAt')),
                    'paymentMode'
                ],
                order: [
                    'SalonId',
                    [db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.createdAt')), 'ASC'],
                    'paymentMode'
                ],
                raw: true,
            });

            paymentData = await Payment.findAll({
                attributes: [
                    [db.Sequelize.fn('DATE', db.Sequelize.col('Payment.createdAt')), 'date'],
                    [db.Sequelize.fn('SUM', db.Sequelize.col('totalAmount')), 'totalPayment'],
                ],
                where: {
                    paymentStatus: 'Success',
                    createdAt: { [Op.between]: [reportStartDate, reportEndDate] },
                    appointmentId: {
                        [Op.in]: db.Sequelize.literal(`(SELECT id FROM Appointments WHERE SalonId = ${appointmentWhereClause.SalonId} AND status = 'completed'${barberId ? ` AND BarberId = ${barberId}` : ''})`)
                    }
                },
                group: [db.Sequelize.fn('DATE', db.Sequelize.col('Payment.createdAt'))],
                order: [[db.Sequelize.fn('DATE', db.Sequelize.col('Payment.createdAt')), 'ASC']],
                raw: true,
            });
        }

        // Process sales and payment data (unchanged logic)
        const groupedSalesData = {};
        salesData.forEach(entry => {
            const normalizedDate = moment.tz(entry.date, timezone).format('YYYY-MM-DD');
            if (!groupedSalesData[entry.SalonId]) {
                groupedSalesData[entry.SalonId] = {};
            }
            if (!groupedSalesData[entry.SalonId][normalizedDate]) {
                groupedSalesData[entry.SalonId][normalizedDate] = [];
            }
            groupedSalesData[entry.SalonId][normalizedDate].push({
                appointments: parseInt(entry.appointments),
                paymentMode: entry.paymentMode,
                revenue: parseFloat(entry.revenue || 0).toFixed(2)
            });
        });

        const formattedDataBySalon = {};
        Object.keys(groupedSalesData).forEach(salonId => {
            const dates = Object.keys(groupedSalesData[salonId]).sort();
            const formattedDates = formatSalesData(
                dates.map(date => ({
                    date,
                    appointments: groupedSalesData[salonId][date].reduce((sum, e) => sum + e.appointments, 0)
                })),
                reportStartDate,
                reportEndDate
            );

            formattedDataBySalon[salonId] = {
                dailyData: formattedDates.map(dateEntry => ({
                    ...dateEntry,
                    details: groupedSalesData[salonId][dateEntry.date] || [],
                })),
                totals: {
                    totalAppointments: 0,
                    totalPayment: 0
                }
            };
        });

        const paymentMap = {};
        paymentData.forEach(payment => {
            const normalizedDate = moment.tz(payment.date, timezone).format('YYYY-MM-DD');
            paymentMap[normalizedDate] = parseFloat(payment.totalPayment || 0).toFixed(2);
        });

        Object.keys(formattedDataBySalon).forEach(salonId => {
            formattedDataBySalon[salonId].dailyData = formattedDataBySalon[salonId].dailyData.map(entry => {
                const totalPayment = paymentMap[entry.date] || '0.00';
                formattedDataBySalon[salonId].totals.totalAppointments += entry.appointments;
                formattedDataBySalon[salonId].totals.totalPayment += parseFloat(totalPayment);
                return {
                    ...entry,
                    totalPayment
                };
            });
            formattedDataBySalon[salonId].totals.totalPayment = formattedDataBySalon[salonId].totals.totalPayment.toFixed(2);
        });

        const salonIds = [...new Set(salesData.map(item => item.SalonId))];
        const salons = await Salon.findAll({
            where: { id: salonIds },
            attributes: ['id', 'name'],
            raw: true
        });
        const salonMap = salons.reduce((acc, salon) => {
            acc[salon.id] = salon.name;
            return acc;
        }, {});

        // Generate HTML content with enhanced styling
        const htmlContent = generateHTMLReport(formattedDataBySalon, salonMap, start, end, timezone);

        // PDF options for a nice layout
        const pdfOptions = {
            format: 'A4',
            orientation: 'portrait',
            border: {
                top: '20mm',
                bottom: '20mm',
                left: '15mm',
                right: '15mm'
            },
            type: 'pdf'
        };

        const fileName = `sales_report_${start.format('YYYYMMDD')}_to_${end.format('YYYYMMDD')}_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, fileName);

        // Generate PDF from HTML
        await new Promise((resolve, reject) => {
            pdf.create(htmlContent, pdfOptions).toFile(filePath, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        // Upload to S3
        const fileBuffer = fs.readFileSync(filePath);
        const uploadParams = {
            Bucket: process.env.DO_SPACES_BUCKET,
            Key: `reports/${fileName}`,
            Body: fileBuffer,
            ACL: 'public-read',
            ContentType: 'application/pdf',
        };

        const uploadResult = await s3.upload(uploadParams).promise();
        const downloadUrl = uploadResult.Location;

        fs.unlinkSync(filePath);

        res.json({
            success: true,
            message: 'Sales report with payment data generated and uploaded successfully',
            data: { downloadUrl },
        });
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Enhanced HTML Report Generator for a User-Friendly and Nice Look''''


function generateHTMLReport(formattedDataBySalon, salonMap, start, end, timezone) {
    let html = `
        <html>
        <head>
            <style>
                body {
                    font-family: 'Helvetica', sans-serif;
                    margin: 0;
                    padding: 0;
                    color: #333;
                }
                .container {
                    width: 100%;
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1 {
                    text-align: center;
                    color: #2c3e50;
                    font-size: 28px;
                    margin-bottom: 10px;
                }
                .subtitle {
                    text-align: center;
                    font-size: 14px;
                    color: #7f8c8d;
                    margin-bottom: 20px;
                }
                h2 {
                    color: #be9342;
                    font-size: 20px;
                    border-bottom: 2px solid #be9342;
                    padding-bottom: 5px;
                    margin-top: 30px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 10px;
                    text-align: right;
                    font-size: 12px;
                }
                th {
                    background-color: #be9342;
                    color: white;
                    font-weight: bold;
                }
                tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                tr:hover {
                    background-color: #f1f1f1;
                }
                .totals {
                    font-weight: bold;
                    font-size: 14px;
                    color: #2c3e50;
                    margin-top: 15px;
                    padding: 10px;
                    background-color: #ecf0f1;
                    border-radius: 5px;
                }
                .footer {
                    text-align: center;
                    font-size: 10px;
                    color: #95a5a6;
                    margin-top: 30px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Shear Brilliance Sales Report</h1>
                <p class="subtitle">${start.format('MMMM Do YYYY')} to ${end.format('MMMM Do YYYY')}</p>
                <p class="subtitle">Generated on: ${moment().tz(timezone).format('MMMM Do YYYY, h:mm:ss a')}</p>
    `;

    for (const [salonId, salonData] of Object.entries(formattedDataBySalon)) {
        html += `
            <h2>Salon: ${salonMap[salonId] || `ID ${salonId}`}</h2>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Appointments</th>
                        <th>Payment Mode</th>
                        <th>Total Payment</th>
                    </tr>
                </thead>
                <tbody>
        `;

        salonData.dailyData.forEach(entry => {
            entry.details.forEach((detail, index) => {
                const paymentModeStr = detail.paymentMode === 'Pay_In_Person' ? 'Offline' :
                                       detail.paymentMode === 'Pay_Online' ? 'Online' : 'N/A';
                html += `
                    <tr>
                        ${index === 0 ? `<td rowspan="${entry.details.length}">${entry.date}</td>` : ''}
                        <td>${detail.appointments}</td>
                        <td>${paymentModeStr}</td>
                        ${index === 0 ? `<td rowspan="${entry.details.length}">$${entry.totalPayment}</td>` : ''}
                    </tr>
                `;
            });
        });

        html += `
                </tbody>
            </table>
            <div class="totals">
                <p>Total Appointments: ${salonData.totals.totalAppointments}</p>
                <p>Total Payment: $${salonData.totals.totalPayment}</p>
            </div>
        `;
    }

    html += `
                <div class="footer">
                    <p>Generated by Shear Brilliance - All Rights Reserved</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return html;
}

// Helper function to fill in missing dates (unchanged)
function formatSalesData(data, startDate, endDate) {
    const dateMap = new Map(data.map(d => [d.date, d]));
    const result = [];
    const current = moment(startDate);
    const end = moment(endDate);

    while (current.isSameOrBefore(end, 'day')) {
        const dateStr = current.format('YYYY-MM-DD');
        result.push({
            date: dateStr,
            appointments: dateMap.get(dateStr)?.appointments || 0,
            revenue: dateMap.get(dateStr)?.revenue || '0.00'
        });
        current.add(1, 'day');
    }
    return result;
}

