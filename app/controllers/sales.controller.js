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
const userTimezone = 'Asia/Kolkata';

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


exports.shareSalesData = async (req, res) => {
    const { startDate, endDate } = req.query;

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

        const timezone = 'Asia/Kolkata';
        const start = moment.tz(startDate, 'YYYY-MM-DD', timezone).startOf('day');
        const end = moment.tz(endDate, 'YYYY-MM-DD', timezone).endOf('day');

        if (!start.isValid() || !end.isValid() || start.isAfter(end)) {
            return res.status(400).json({ success: false, message: 'Invalid date range' });
        }
        const reportStartDate = start.toDate();
        const reportEndDate = end.toDate();

        let salesData = [];
        let paymentData = [];

        if (userRole === role.ADMIN) {
            salesData = await Appointment.findAll({
                attributes: [
                    'SalonId',
                    [db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.createdAt')), 'date'],
                    [db.Sequelize.fn('COUNT', db.Sequelize.col('Appointment.id')), 'appointments'],
                    'paymentMode',
                ],
                where: {
                    status: 'completed',
                    createdAt: { [Op.between]: [reportStartDate, reportEndDate] },
                },
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
            salesData = await Appointment.findAll({
                attributes: [
                    'SalonId',
                    [db.Sequelize.fn('DATE', db.Sequelize.col('Appointment.createdAt')), 'date'],
                    [db.Sequelize.fn('COUNT', db.Sequelize.col('Appointment.id')), 'appointments'],
                    [db.Sequelize.fn('SUM', db.Sequelize.col('Services.max_price')), 'revenue'],
                    'paymentMode',
                ],
                where: {
                    status: 'completed',
                    createdAt: { [Op.between]: [reportStartDate, reportEndDate] },
                    SalonId: req.user.salonId,
                },
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
                        [Op.in]: db.Sequelize.literal(`(SELECT id FROM Appointments WHERE SalonId = ${req.user.salonId})`)
                    }
                },
                group: [db.Sequelize.fn('DATE', db.Sequelize.col('Payment.createdAt'))],
                order: [[db.Sequelize.fn('DATE', db.Sequelize.col('Payment.createdAt')), 'ASC']],
                raw: true,
            });
        }

        // Fetch salon names
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

        // Structure the response data
        const responseData = {
            period: {
                startDate: start.format('YYYY-MM-DD'),
                endDate: end.format('YYYY-MM-DD'),
                timezone: timezone
            },
            salons: salons,
            salesData: salesData.map(item => ({
                salonId: item.SalonId,
                salonName: salonMap[item.SalonId] || `ID ${item.SalonId}`,
                date: item.date,
                appointments: item.appointments,
                revenue: item.revenue || 0,
                paymentMode: item.paymentMode === 'Pay_In_Person' ? 'Offline' : 
                           item.paymentMode === 'Pay_Online' ? 'Online' : 'N/A'
            })),
            paymentData: paymentData.map(item => ({
                date: item.date,
                totalPayment: parseFloat(item.totalPayment || 0).toFixed(2)
            })),
            generatedAt: moment().tz(timezone).format('YYYY-MM-DD HH:mm:ss')
        };

        res.json({
            success: true,
            message: 'Sales data retrieved successfully',
            data: responseData
        });

    } catch (error) {
        console.error('Error sharing sales data:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};