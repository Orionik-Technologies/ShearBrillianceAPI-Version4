const db = require("../models");
const Salon = db.Salon;
const Barber = db.Barber;
const Appointment = db.Appointment;
const AppointmentService = db.AppointmentService;
const Service =db.Service;
const User = db.USER;
const UserSalon = db.UserSalon;
const Payment = db.Payment;
const { role } = require('../config/roles.config');
const jwt = require('jsonwebtoken');
const roles = db.roles;
const { Op, where } = require('sequelize'); // Make sure you import Op from Sequelize for date comparisons
const moment = require('moment'); // You can use the moment library to easily work with dates
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const sendResponse = require('../helpers/responseHelper');  // Import the helper
const { put } = require('@vercel/blob'); // Import 'put' directly if using Vercel's blob SDK upload method
const AWS = require('aws-sdk');
const pdf = require('html-pdf'); // Add this at the top with other imports

const s3 = new AWS.S3({
    endpoint: new AWS.Endpoint('https://tor1.digitaloceanspaces.com'), // Replace with your DigitalOcean Spaces endpoint
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

//common Dashboard 
exports.getDashboardData = async (req, res) => {
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

        // Step 3: Collect data based on role
        let data = {};

        // Helper function to calculate payment totals without associations
        const calculatePaymentTotals = async (appointmentWhereClause) => {
            // First get appointments
            const appointments = await Appointment.findAll({
                where: appointmentWhereClause,
                attributes: ['id', 'paymentMode']
            });

            // Get all appointment IDs
            const appointmentIds = appointments.map(appointment => appointment.id);

            // Fetch corresponding payments using appointmentId
            const payments = await Payment.findAll({
                where: {
                    appointmentId: { [Op.in]: appointmentIds },
                    paymentStatus: 'Success' // Only successful payments
                },
                attributes: ['appointmentId', 'totalAmount']
            });

            // Create a map of payments by appointmentId for efficient lookup
            const paymentMap = payments.reduce((map, payment) => {
                map[payment.appointmentId] = payment.totalAmount;
                return map;
            }, {});

            // Calculate totals using appointments and payment map
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

            return totals;
        };

        
        if (userRole === role.ADMIN) {
            // Admin specific data
            const customerRole = await db.roles.findOne({ where: { role_name: role.CUSTOMER } });
            const barberRole = await db.roles.findOne({ where: { role_name: role.BARBER } });
            const salonOwnerRole = await db.roles.findOne({ where: { role_name: role.SALON_OWNER } });
            const adminRole = await db.roles.findOne({ where: { role_name: role.ADMIN } });
            
            if (!customerRole || !barberRole || !salonOwnerRole || !adminRole) {
                return res.status(400).json({ success: false, message: 'One or more roles not found' });
            }

            // Most Famous Salons (Top 3 salons with the highest number of appointments)
            const topSalons = await Appointment.findAll({
                attributes: ['SalonId', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'appointmentsCount']],
                group: ['SalonId'],
                order: [[db.sequelize.fn('COUNT', db.sequelize.col('id')), 'DESC']],
                limit: 3
            });

            // Fetch salon details for the top 3 salons
            const salonIds = topSalons.map(salon => salon.SalonId);
            const salonData = await Salon.findAll({
                where: {
                    id: salonIds
                },
                attributes: ['id', 'name']  // Fetch salon details like id and name
            });

            // Combine salon data with appointment counts
            const topSalonsWithDetails = topSalons.map(salon => {
                const salonDetails = salonData.find(s => s.id === salon.SalonId);
                return {
                    salonId: salon.SalonId,
                    appointmentsCount: salon.dataValues.appointmentsCount,
                    salonName: salonDetails ? salonDetails.name : 'Unknown'
                };
            });

            // Most Famous Barbers (Top 3 barbers with the highest number of appointments)
            const topBarbers = await Appointment.findAll({
                attributes: ['BarberId', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'appointmentsCount']],
                group: ['BarberId'],
                order: [[db.sequelize.fn('COUNT', db.sequelize.col('id')), 'DESC']],
                limit: 3
            });

            // Fetch barber details for the top 3 barbers
            const barberIds = topBarbers.map(barber => barber.BarberId);
            const barberData = await Barber.findAll({
                where: {
                    id: barberIds
                },
                attributes: ['id', 'name']  // Fetch barber details like id and name
            });

            // Combine barber data with appointment counts
            const topBarbersWithDetails = topBarbers.map(barber => {
                const barberDetails = barberData.find(b => b.id === barber.BarberId);
                return {
                    barberId: barber.BarberId,
                    appointmentsCount: barber.dataValues.appointmentsCount,
                    barberName: barberDetails ? barberDetails.name : 'Unknown'
                };
            });

             // Fetch top 3 services by number of appointments
             const topServices = await AppointmentService.findAll({
                attributes: [
                    'ServiceId',
                    [db.sequelize.fn('COUNT', db.sequelize.col('AppointmentId')), 'usageCount']
                ],
                group: ['ServiceId'],
                order: [[db.sequelize.fn('COUNT', db.sequelize.col('AppointmentId')), 'DESC']],
                limit: 3,
            });

            // Fetch service details
            const serviceIds = topServices.map(service => service.ServiceId);
            const serviceDetails = await Service.findAll({
                where: { id: serviceIds },
                attributes: ['id', 'name', 'description','isActive'], // Add relevant fields
            });

            const topServicesWithDetails = topServices.map(service => {
                const serviceInfo = serviceDetails.find(s => s.id === service.ServiceId);
                return {
                    serviceId: service.ServiceId,
                    usageCount: service.dataValues.usageCount,
                    serviceName: serviceInfo ? serviceInfo.name : 'Unknown',
                    serviceDescription: serviceInfo ? serviceInfo.description : 'No description',
                    serviceMaxPrice: serviceInfo ? serviceInfo.max_price : null,
                    serviceMinPrice: serviceInfo ? serviceInfo.min_price : null,
                    serviceisActive: serviceInfo ? serviceInfo.isActive : 'Not found',
                };
            });

            const paymentTotals = await calculatePaymentTotals({});

            data = {
               
                // totalAdmins: await User.count({ where: { RoleId: adminRole.id } }),
                totalBarbers: await Barber.count(),
                // totalSalonOwners: await User.count({ where: { RoleId: salonOwnerRole.id}}),
                totalCustomers: await User.count({ where: { RoleId: customerRole.id } }), // Use customerRole.id
                totalSalons: await Salon.count(),
                totalAppointments: await Appointment.count(),
                activeAppointmentsCount: await Appointment.count({ where: { status: 'in_salon' } }), // Active appointments only with 'in_salon' status
                pendingFutureAppointmentsCount: await Appointment.count({ where: { status: 'appointment' } }), // Pending appointments
                pendingAppointmentsCount: await Appointment.count({ where: { status: 'checked_in' } }), // Pending appointments
                completedAppointmentsCount: await Appointment.count({ where: { status: 'completed',appointment_date: {
                    [Op.ne]: null,
                },  } }),
                completedWalkInCount: await Appointment.count({ where: { status: 'completed',appointment_date: null  } }),
                canceledAppointmentsCount: await Appointment.count({ where: { status: 'canceled' } }),
                totalService : await Service.count(),
                topSalonsWithDetails,
                topBarbersWithDetails,
                topServicesWithDetails,
                revenue: {
                    online: paymentTotals.online,
                    offline: paymentTotals.offline,
                    total: paymentTotals.total
                }
           
            };


        } else if (userRole === role.SALON_OWNER || userRole === role.SALON_MANAGER) {

            let salonOwnerSalons = [];
            if(userRole == role.SALON_OWNER){
                // Salon Owner specific data
                salonOwnerSalons = await Salon.findAll({ where: { UserId: userId } });

                if (salonOwnerSalons.length === 0) {
                    return res.status(404).json({ success: false, message: 'No salons found for this role' });
                } 
            }
            else{
                salonOwnerSalons = await Salon.findAll({ where: { id: req.user.salonId } });
            }

            const salonIds = salonOwnerSalons.map(salon => salon.id);
            const paymentTotals = await calculatePaymentTotals({ SalonId: salonIds });

            // Collecting active appointments for the owned salons (only 'in_salon' status)
            const activeAppointmentsCount = await Appointment.count({
                where: {
                    SalonId: salonOwnerSalons.map(salon => salon.id),
                    status: 'in_salon'  // Only active appointments with 'in_salon' status
                }
            });

            const pendingAppointmentsCount = await Appointment.count({
                where: {
                    SalonId: salonOwnerSalons.map(salon => salon.id),
                    status: 'checked_in'  // Pending appointments (checked_in)
                }
            });

            const pendingFutureAppointmentsCount = await Appointment.count({
                where: {
                    SalonId: salonOwnerSalons.map(salon => salon.id),
                    status: 'appointment',
                    appointment_date: null
                }
            });

            const completedAppointmentsCount = await Appointment.count({
                where: {
                    SalonId: salonOwnerSalons.map(salon => salon.id),
                    status: 'completed',
                    appointment_date: {
                        [Op.ne]: null,
                    }, 
                }
            });
            const completedWalkInCount = await Appointment.count({
                where: {
                    SalonId: salonOwnerSalons.map(salon => salon.id),
                    status: 'completed',
                    appointment_date: null
                }
            });

            
            const canceledAppointmentsCount = await Appointment.count({
                where: {
                    SalonId: salonOwnerSalons.map(salon => salon.id),
                    status: 'canceled'
                }
            });
            const totalCustomers = await Appointment.count({
                distinct: true,
                col: 'UserId',  // Count distinct users (customers)
                where: {
                    SalonId: salonOwnerSalons.map(salon => salon.id),
                    status: { [Op.in]: ['checked_in', 'in_salon', 'completed', 'canceled'] }  // Including all statuses
                }
            });

            const totalBarbers = await Barber.count({
                where: {
                    SalonId: salonOwnerSalons.map(salon => salon.id)
                }
            });

            const totalAppointments = await Appointment.count({
                where: {
                    SalonId: salonOwnerSalons.map(salon => salon.id)
                }
            });

        
            data = {
                totalBarbers,
                totalCustomers,
                totalAppointments,
                activeAppointmentsCount,
                pendingAppointmentsCount,
                completedAppointmentsCount,
                completedWalkInCount,
                canceledAppointmentsCount,
                pendingFutureAppointmentsCount,
                revenue: {
                    online: paymentTotals.online,
                    offline: paymentTotals.offline,
                    total: paymentTotals.total
                }
            };

        } else if (userRole === role.SALON_MANAGER) {
             // Fetch the first salon associated with the salon manager
             const userSalon = await UserSalon.findOne({ where: { UserId: user.id } });
        
             if (!userSalon) {
                 return res.status(404).json({ success: false, message: 'No salons found for this manager' });
             }
         
             // Fetch the details of the salon
             const salonRole = await Salon.findOne({ where: { id: userSalon.SalonId } });
             if (!salonRole) {
                 return res.status(404).json({ success: false, message: 'Salon not found' });
             }
         
             const salonId = salonRole.id;
             const paymentTotals = await calculatePaymentTotals({ SalonId: salonId });
         
             // Fetch active appointments for the managed salon
             const activeAppointmentsCount = await Appointment.count({
                 where: {
                     SalonId: salonId,
                     status: 'in_salon', // Active appointments only with 'in_salon' status
                 },
             });
         
             // Fetch pending appointments for the managed salon
             const pendingAppointmentsCount = await Appointment.count({
                 where: {
                     SalonId: salonId,
                     status: 'checked_in', // Pending appointments
                 },
             });
         
             // Fetch completed appointments for the managed salon
             const completedAppointmentsCount = await Appointment.count({
                 where: {
                     SalonId: salonId,
                     status: 'completed',
                     appointment_date: {
                        [Op.ne]: null,
                    }, 
                 },
             });

          
            const completedWalkInCount = await Appointment.count({
                where: {
                    SalonId: salonId,
                    status: 'completed',
                    appointment_date: null
                }
            });
         
             // Fetch canceled appointments for the managed salon
             const canceledAppointmentsCount = await Appointment.count({
                 where: {
                     SalonId: salonId,
                     status: 'canceled',
                 },
             });
         
             // Count distinct customers for the managed salon
             const totalCustomers = await Appointment.count({
                 distinct: true,
                 col: 'UserId', // Count distinct users (customers)
                 where: {
                     SalonId: salonId,
                     status: { [Op.in]: ['checked_in', 'in_salon', 'completed', 'canceled'] },
                 },
             });
         
             // Count barbers for the managed salon
             const totalBarbers = await Barber.count({
                 where: {
                     SalonId: salonId,
                 },
             });
         
             // Count total appointments for the managed salon
             const totalAppointments = await Appointment.count({
                 where: {
                     SalonId: salonId,
                 },
             });
         
             // Prepare response data
             data = {
                 totalBarbers,
                 totalCustomers,
                 totalAppointments,
                 activeAppointmentsCount,
                 pendingAppointmentsCount,
                 completedAppointmentsCount,
                 completedWalkInCount,
                 canceledAppointmentsCount,
                 managedSalon: {
                     id: salonRole.id,
                     name: salonRole.name,
                     address: salonRole.address,
                     city: salonRole.city,
                },
                 revenue: {
                    online: paymentTotals.online,
                    offline: paymentTotals.offline,
                    total: paymentTotals.total
                },
             };
        } 
        else if (userRole === role.BARBER) {
            // Barber specific data
            const barber = await db.Barber.findOne({ where: { UserId: userId } });

            if (!barber) {
                return res.status(404).json({ success: false, message: 'Barber not found' });
            }

            const paymentTotals = await calculatePaymentTotals({ BarberId: barber.id });

            // Fetch active appointments for the barber (only 'in_salon' status)
            const activeAppointmentsCount = await Appointment.count({
                where: { BarberId: barber.id, status: 'in_salon' } // Active appointments only with 'in_salon' status
            });

            const pendingAppointmentsCount = await Appointment.count({
                where: { BarberId: barber.id, status: 'checked_in' } // Pending appointments for barber
            });

            const pendingFutureAppointmentsCount = await Appointment.count({
                where: { BarberId: barber.id, status: 'appointment' } // Pending appointments for barber
            });
            const completedAppointmentsCount = await Appointment.count({
                where: { BarberId: barber.id, status: 'completed',  appointment_date: {
                    [Op.ne]: null,
                },  }
            });
            const completedWalkInCount = await Appointment.count({
                where: { BarberId: barber.id, status: 'completed', appointment_date: null  }
            });
            const canceledAppointmentsCount = await Appointment.count({
                where: { BarberId: barber.id, status: 'canceled' }
            });

            const totalAppointments = await Appointment.count({
                where: {
                    BarberId: barber.id
                }
            });
            data = {
                totalAppointments,
                activeAppointmentsCount,
                pendingAppointmentsCount,
                completedAppointmentsCount,
                completedWalkInCount,
                canceledAppointmentsCount,
                pendingFutureAppointmentsCount,
                revenue: {
                    online: paymentTotals.online,
                    offline: paymentTotals.offline,
                    total: paymentTotals.total
                }
            };

        } else {
            return res.status(403).json({ success: false, message: 'Role not authorized' });
        }

        // Step 4: Send response with the collected data
        res.json({
            success: true,
            message: `${userRole} Dashboard Data`,
            data,
            code: 200
        });

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ success: false, message: 'Server Error', code: 500 });
    }
};

//Dashboard for Appointment
exports.getAppointmentDashboardData = async (req, res) => {
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

        // Step 3: Get today's date range (start of the day to end of the day)
        const startOfDay = moment().startOf('day').toDate(); // Beginning of today
        const endOfDay = moment().endOf('day').toDate(); // End of today

        // Step 4: Collect data based on role
        let data = {};

        if (userRole === role.ADMIN) {
            // Admin specific data for today
            data = {
                totalAppointments: await Appointment.count({
                    where: {
                        createdAt: { [Op.between]: [startOfDay, endOfDay] },
                        appointment_date : null
                    }
                }),
                pendingAppointmentsCount: await Appointment.count({
                    where: {
                        status: 'checked_in',
                        createdAt: { [Op.between]: [startOfDay, endOfDay] },
                        appointment_date : null
                    }
                }),
                completedAppointmentsCount: await Appointment.count({
                    where: {
                        status: 'completed',
                        createdAt: { [Op.between]: [startOfDay, endOfDay] },
                        appointment_date : null
                    }
                }),
                canceledAppointmentsCount: await Appointment.count({
                    where: {
                        status: 'canceled',
                        createdAt: { [Op.between]: [startOfDay, endOfDay] },
                        appointment_date : null
                    }
                }),
                activeAppointmentsCount: await Appointment.count({
                    where: {
                        status: 'in_salon',  // Count appointments with status 'in_salon'
                        createdAt: { [Op.between]: [startOfDay, endOfDay] },
                        appointment_date : null
                    }
                })
            };

        } else if (userRole === role.SALON_OWNER) {
            // Salon Owner specific data for today
            const salonOwnerSalons = await Salon.findAll({ where: { UserId: userId } });

            if (salonOwnerSalons.length === 0) {
                return res.status(404).json({ success: false, message: 'No salons found for this owner' });
            }

            // Collecting the number of appointments for today for owned salons
            data = {
                totalAppointments: await Appointment.count({
                    where: {
                        SalonId: salonOwnerSalons.map(salon => salon.id),
                        createdAt: { [Op.between]: [startOfDay, endOfDay] },
                        appointment_date : null
                    }
                }),
                pendingAppointmentsCount: await Appointment.count({
                    where: {
                        SalonId: salonOwnerSalons.map(salon => salon.id),
                        status: 'checked_in',
                        createdAt: { [Op.between]: [startOfDay, endOfDay] },
                        appointment_date : null
                    }
                }),
                completedAppointmentsCount: await Appointment.count({
                    where: {
                        SalonId: salonOwnerSalons.map(salon => salon.id),
                        status: 'completed',
                        createdAt: { [Op.between]: [startOfDay, endOfDay] },
                        appointment_date : null
                    }
                }),
                canceledAppointmentsCount: await Appointment.count({
                    where: {
                        SalonId: salonOwnerSalons.map(salon => salon.id),
                        status: 'canceled',
                        createdAt: { [Op.between]: [startOfDay, endOfDay] },
                        appointment_date : null
                    }
                }),
                activeAppointmentsCount: await Appointment.count({
                    where: {
                        SalonId: salonOwnerSalons.map(salon => salon.id),
                        status: 'in_salon',  // Count appointments with status 'in_salon'
                        createdAt: { [Op.between]: [startOfDay, endOfDay] },
                        appointment_date : null
                    }
                })
            };

        } else if(userRole=== role.SALON_MANAGER) {
            // Fetch the first salon associated with the salon manager
            const userSalon = await UserSalon.findOne({ where: { UserId: user.id } });
        
            if (!userSalon) {
                return res.status(404).json({ success: false, message: 'No salons found for this manager' });
            }
        
            // Fetch the details of the salon
            const salonRole = await Salon.findOne({ where: { id: userSalon.SalonId } });
            if (!salonRole) {
                return res.status(404).json({ success: false, message: 'Salon not found' });
            }
        
            const salonId = salonRole.id;
        
            // Fetch active appointments for the managed salon
            const activeAppointmentsCount = await Appointment.count({
                where: {
                    SalonId: salonId,
                    appointment_date : null,
                    status: 'in_salon', // Active appointments only with 'in_salon' status
                },
            });
        
            // Fetch pending appointments for the managed salon
            const pendingAppointmentsCount = await Appointment.count({
                where: {
                    SalonId: salonId,
                    appointment_date : null,
                    status: 'checked_in', // Pending appointments
                },
            });
        
            // Fetch completed appointments for the managed salon
            const completedAppointmentsCount = await Appointment.count({
                where: {
                    SalonId: salonId,
                    appointment_date : null,
                    status: 'completed',
                },
            });
        
            // Fetch canceled appointments for the managed salon
            const canceledAppointmentsCount = await Appointment.count({
                where: {
                    SalonId: salonId,
                    appointment_date : null,
                    status: 'canceled',
                },
            });
        
            // Count distinct customers for the managed salon
            const totalCustomers = await Appointment.count({
                distinct: true,
                col: 'UserId', // Count distinct users (customers)
                where: {
                    SalonId: salonId,
                    appointment_date : null,
                    status: { [Op.in]: ['checked_in', 'in_salon', 'completed', 'canceled'] },
                },
            });
        
            // Count barbers for the managed salon
            const totalBarbers = await Barber.count({
                where: {
                    SalonId: salonId,
                },
            });
        
            // Count total appointments for the managed salon
            const totalAppointments = await Appointment.count({
                where: {
                    SalonId: salonId,
                },
            });
        
            // Prepare response data
            data = {
                totalBarbers,
                totalCustomers,
                totalAppointments,
                activeAppointmentsCount,
                pendingAppointmentsCount,
                completedAppointmentsCount,
                canceledAppointmentsCount,
                managedSalon: {
                    id: salonRole.id,
                    name: salonRole.name,
                    address: salonRole.address,
                    city: salonRole.city,
                },
            };
        } else if (userRole === role.BARBER) {
            // Barber specific data for today
            const barber = await db.Barber.findOne({ where: { UserId: userId } });

            if (!barber) {
                return res.status(404).json({ success: false, message: 'Barber not found' });
            }

            // Fetching the total number of appointments for today for the barber
            data = {
                totalAppointments: await Appointment.count({
                    where: {
                        BarberId: barber.id,
                        createdAt: { [Op.between]: [startOfDay, endOfDay] },
                        appointment_date : null
                    }
                }),
                pendingAppointmentsCount: await Appointment.count({
                    where: {
                        BarberId: barber.id,
                        status: 'checked_in',
                        createdAt: { [Op.between]: [startOfDay, endOfDay] },
                        appointment_date : null
                    }
                }),
                completedAppointmentsCount: await Appointment.count({
                    where: {
                        BarberId: barber.id,
                        status: 'completed',
                        createdAt: { [Op.between]: [startOfDay, endOfDay] },
                        appointment_date : null
                    }
                }),
                canceledAppointmentsCount: await Appointment.count({
                    where: {
                        BarberId: barber.id,
                        status: 'canceled',
                        appointment_date : null,
                        createdAt: { [Op.between]: [startOfDay, endOfDay] }
                    }
                }),
                activeAppointmentsCount: await Appointment.count({
                    where: {
                        BarberId: barber.id,
                        status: 'in_salon',  // Count appointments with status 'in_salon'
                        createdAt: { [Op.between]: [startOfDay, endOfDay] },
                        appointment_date : null
                    }
                })
            };

        } else {
            return res.status(403).json({ success: false, message: 'Role not authorized' });
        }

        // Step 5: Send response with the collected data
        res.json({
            success: true,
            message: `${userRole} Appointment Dashboard Data for Today`,
            data,
            code: 200
        });

    } catch (error) {
        console.error('Error fetching appointment dashboard data:', error);
        res.status(500).json({ success: false, message: 'Server Error', code: 500 });
    }
};


const generatePDF = async (doc, filePath) => {
    return new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        writeStream.on('finish', () => resolve(filePath));
        writeStream.on('error', (error) => reject(error));
        doc.end();
    });
};

// Ensure the reports directory exists
const ensureDirectoryExists = (filePath) => {
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
};

// New function to generate PDF using html-pdf
const generatePDFWithHTML = async (htmlContent, filePath) => {
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

    return new Promise((resolve, reject) => {
        ensureDirectoryExists(filePath);
        pdf.create(htmlContent, pdfOptions).toFile(filePath, (err, result) => {
            if (err) return reject(err);
            resolve(result.filename);
        });
    });
};

// New function to generate styled HTML content
const generateHTMLReport = (userRole, data, barbersDataBySalon, startDate, endDate) => {
    const titlePrefix = userRole === role.ADMIN ? 'Admin' : 'Salon Owner';
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
                    text-align: left;
                    font-size: 12px;
                }
                th {
                    background-color: #be9342;
                    color: white;
                    font-weight: bold;
                }
                td:nth-child(n+2) {
                    text-align: right;
                }
                tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                tr:hover {
                    background-color: #f1f1f1;
                }
                .summary {
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
                <h1>Shear Brilliance ${titlePrefix} Dashboard</h1>
                <p class="subtitle">Report Date: ${moment().format('YYYY-MM-DD')}</p>
                <p class="subtitle">Date Range: ${startDate} to ${endDate}</p>

                <div class="summary">
                    <p>Total Salons: ${data.totalSalons}</p>
                    <p>Total Customers: ${data.totalCustomers}</p>
                    <p>Total Barbers: ${data.totalBarbers}</p>
                </div>

                <h2>Appointment Summary</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Total Appointments</td><td>${data.totalAppointments}</td></tr>
                        <tr><td>Pending Appointments</td><td>${data.pendingAppointmentsCount}</td></tr>
                        <tr><td>Completed Appointments</td><td>${data.completedAppointmentsCount}</td></tr>
                        <tr><td>Canceled Appointments</td><td>${data.canceledAppointmentsCount}</td></tr>
                        <tr><td>Active Appointments</td><td>${data.activeAppointmentsCount}</td></tr>
                    </tbody>
                </table>
    `;

    // Generate separate sections for each salon
    for (const [salonName, barbersData] of Object.entries(barbersDataBySalon)) {
        html += `
            <h2>${salonName} - Barber Details</h2>
            <table>
                <thead>
                    <tr>
                        <th>Barber Name</th>
                        <th>Pending</th>
                         <th>Active</th>
                        <th>Completed</th>
                        <th>Canceled</th>
                    </tr>
                </thead>
                <tbody>
        `;

        barbersData.forEach(barber => {
            html += `
                <tr>
                    <td>${barber.barberName}</td>
                    <td>${barber.pendingAppointmentsCount}</td>
                    <td>${barber.activeAppointmentsCount}</td>
                    <td>${barber.completedAppointmentsCount}</td>
                    <td>${barber.canceledAppointmentsCount}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
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
};

exports.generateAdminAppointmentReport = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No user ID found', code: 401 });
        }

        const user = await User.findByPk(userId, {
            include: {
                model: roles,
                as: 'role',
            }
        });

        if (!user || !user.role) {
            return res.status(403).json({ success: false, message: 'Unauthorized User' });
        }

        const userRole = user.role.role_name;
        const { startDate, endDate, salonId, barberId } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: "Start date and end date are required" });
        }

        if (isNaN(new Date(startDate).getTime()) || isNaN(new Date(endDate).getTime())) {
            return res.status(400).json({ success: false, message: "Invalid date format" });
        }

        let data = {};
        let barbersDataBySalon = {};

        if (userRole === role.ADMIN || userRole === role.SALON_OWNER) {
            let whereConditions = {
                createdAt: { [Op.between]: [new Date(startDate), new Date(endDate)] }
            };

            if (salonId) {
                whereConditions.SalonId = salonId;
            }
            if (barberId) {
                whereConditions.BarberId = barberId;
            }
            if (userRole === role.SALON_OWNER && !salonId) {
                whereConditions.SalonId = req.user.salonId;
            }

            // Calculate overall appointment stats
            data = {
                totalAppointments: await Appointment.count({ where: whereConditions }),
                pendingAppointmentsCount: await Appointment.count({
                    where: { ...whereConditions, status: 'checked_in' }
                }),
                completedAppointmentsCount: await Appointment.count({
                    where: { ...whereConditions, status: 'completed' }
                }),
                canceledAppointmentsCount: await Appointment.count({
                    where: { ...whereConditions, status: 'canceled' }
                }),
                activeAppointmentsCount: await Appointment.count({
                    where: { ...whereConditions, status: 'in_salon' }
                })
            };

            let salons;
            if (userRole === role.ADMIN && !salonId) {
                salons = await Salon.findAll();
            } else {
                const targetSalonId = salonId || (userRole === role.SALON_OWNER ? req.user.salonId : null);
                salons = targetSalonId ? [await Salon.findByPk(targetSalonId)] : [];
            }

            data.totalSalons = salons.length;
            data.totalCustomers = await Appointment.count({
                where: { 
                    UserId: { [Op.ne]: null },
                    ...(salonId ? { SalonId: salonId } : {})
                },
                distinct: true,
                col: 'UserId'
            });
            
            // Group barbers by salon
            for (const salon of salons) {
                const barberWhere = {
                    SalonId: salon.id
                };
                if (barberId) barberWhere.id = barberId;

                const barbers = await Barber.findAll({ 
                    where: barberWhere,
                    include: [{ model: Salon, as: 'salon', attributes: ['name'] }] 
                });

                const barbersData = await Promise.all(barbers.map(async (barber) => {
                    const whereClause = {
                        BarberId: barber.id,
                        createdAt: { [Op.between]: [new Date(startDate), new Date(endDate)] }
                    };

                    const [active, pending, completed, canceled] = await Promise.all([
                        Appointment.count({ where: { ...whereClause, status: 'in_salon' } }),
                        Appointment.count({ where: { ...whereClause, status: 'checked_in' } }),
                        Appointment.count({ where: { ...whereClause, status: 'completed' } }),
                        Appointment.count({ where: { ...whereClause, status: 'canceled' } })
                    ]);

                    return {
                        barberName: barber.name,
                        activeAppointmentsCount: active,
                        pendingAppointmentsCount: pending,
                        completedAppointmentsCount: completed,
                        canceledAppointmentsCount: canceled
                    };
                }));

                barbersDataBySalon[salon.name || 'Unknown Salon'] = barbersData;
                data.totalBarbers = (data.totalBarbers || 0) + barbers.length;
            }

            const fileName = `${userRole.toLowerCase()}_appointment_dashboard_${moment().format('YYYY-MM-DD')}.pdf`;
            const filePath = path.resolve(__dirname, '../public/reports', fileName);
            
            ensureDirectoryExists(filePath);
            const htmlContent = generateHTMLReport(userRole, data, barbersDataBySalon, startDate, endDate);
            await generatePDFWithHTML(htmlContent, filePath);
            const fileBuffer = fs.readFileSync(filePath);

            const uploadParams = {
                Bucket: process.env.DO_SPACES_BUCKET,
                Key: `reports/${fileName}`,
                Body: fileBuffer,
                ACL: 'public-read',
                ContentType: 'application/pdf',
            };

            const uploadResult = await s3.upload(uploadParams).promise();
            fs.unlinkSync(filePath);

            res.status(200).json({
                success: true,
                message: 'PDF report generated successfully',
                downloadLink: uploadResult.Location,
            });
        } else {
            return res.status(403).json({ success: false, message: 'Role not authorized' });
        }
    } catch (error) {
        console.error('Error generating admin appointment report:', error);
        res.status(500).json({ success: false, message: 'Server Error', code: 500 });
    }
};
// Helper function to calculate date ranges
const getDateRange = (filter) => {
    const today = new Date();
    let startDate;
  
    switch (filter) {
      case 'today':
        startDate = new Date(today.setHours(0, 0, 0, 0));
        return { startDate, endDate: new Date(today.setHours(23, 59, 59, 999)) };
      case 'last_7_days':
        startDate = new Date(today.setDate(today.getDate() - 7));
        return { startDate, endDate: new Date() };
      case 'last_30_days':
        startDate = new Date(today.setDate(today.getDate() - 30));
        return { startDate, endDate: new Date() };
      default:
        throw new Error('Invalid filter');
    }
  };

exports.appointmentStatus = async (req, res) => {
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
    if (!filter || !['today', 'last_7_days', 'last_30_days'].includes(filter)) {
        return res.status(400).json({ error: 'Invalid filter' });
      }
  
      // Get date range
      const { startDate, endDate } = getDateRange(filter);
  
      let appointmentCounts = [];
      if (userRole === role.ADMIN) {
         // Query database for aggregated data
         appointmentCounts = await Appointment.findAll({
            attributes: [
            'status',
            [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count'],
            ],
            where: {
                createdAt: {
                [Op.between]: [startDate, endDate],
            },
            },
            group: ['status'],
        });   
      }
      else if(userRole === role.SALON_OWNER){
        appointmentCounts = await Appointment.findAll({
            attributes: [
            'status',
            [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count'],
            ],
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate]
                },
                SalonId: req.user.salonId
            },
            group: ['status'],
        });   
      }
      else if(userRole === role.SALON_MANAGER){
        appointmentCounts = await Appointment.findAll({
            attributes: [
            'status',
            [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count'],
            ],
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate]
                },
                SalonId: req.user.salonId
            },
            group: ['status'],
        });   
      }
      else if(userRole === role.BARBER){
        console.log('BarberId:', req.user.barberId); // Debugging log
        appointmentCounts = await Appointment.findAll({
            attributes: [
            'status',
            [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count'],
            ],
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate]
                },
                BarberId: req.user.barberId
            },
            group: ['status'],
        });   
      }

      // Format the response
      const response = appointmentCounts.map((item) => ({
        status: item.status,
        count: item.dataValues.count,
      }));

        // Step 4: Send response with the collected data
        res.json({
            success: true,
            message: `Get appointment status succesfully !!!`,
            response,
            code: 200
        });

    } catch (error) {
        console.error('Error while Get appointment status !!!', error);
        res.status(500).json({ success: false, message: 'Server Error', code: 500 });
    }
};

exports.GetnewCustomers = async (req, res) => {
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
    if (!filter || !['today', 'last_7_days', 'last_30_days'].includes(filter)) {
        return res.status(400).json({ error: 'Invalid filter' });
      }
  
      // Get date range
      const { startDate, endDate } = getDateRange(filter);
  
      let newCustomerCount = 0;
      if (userRole === role.ADMIN) {
            // Query database for new customers
          newCustomerCount = await User.count({
            where: {
                createdAt: {
                [Op.between]: [startDate, endDate],
                },
            },
            });
       }
    
        // Step 4: Send response with the collected data
        res.json({
            success: true,
            message: `Get new customer succesfully !!!`,
            newCustomerCount,
            code: 200
        });

    } catch (error) {
        console.error('Error generating new customer data', error);
        res.status(500).json({ success: false, message: 'Server Error', code: 500 });
    }
};



exports.customerStatus = async (req, res) => {
    const { filter } = req.query;
    try {
        // Step 1: Extract userId from JWT token
        const userId = req.user ? req.user.id : null;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No user ID found', code: 401 });
        }

        // Step 2: Fetch the user and their role
        const user = await User.findByPk(userId, {
            include: {
                model: roles,  // Include the associated Role model
                as: 'role',
            },
        });

        if (!user || !user.role) {
            return res.status(403).json({ success: false, message: 'Unauthorized User', code: 403 });
        }

        const userRole = user.role.role_name;

        // Validate filter
        if (!filter || !['today', 'last_7_days', 'last_30_days'].includes(filter)) {
            return res.status(400).json({ success: false, message: 'Invalid filter', code: 400 });
        }

        // Get date range
        const { startDate, endDate } = getDateRange(filter);

        let whereCondition = {}; // Default condition

        // Apply role-based conditions
        if (userRole === role.SALON_MANAGER || userRole === role.SALON_OWNER) {
            whereCondition.SalonId = req.user.salonId;
        } else if (userRole === 'BARBER') {
            whereCondition.BarberId = req.user.barberId;
        }

        // **Repeated Customers** (Users with multiple appointments)
        const repeatedCustomers = await Appointment.findAll({
            attributes: ['UserId', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'appointmentCount']],
            where: {
                ...whereCondition,
                createdAt: { [Op.between]: [startDate, endDate] },
            },
            group: ['UserId'],
            having: db.sequelize.literal('COUNT(id) > 1'),
        });

        // **New Customers** (Users who had their first appointment within the date range)
        const newCustomers = await Appointment.findAll({
            attributes: ['UserId'],
            where: {
                ...whereCondition,
                createdAt: { [Op.between]: [startDate, endDate] },
            },
            group: ['UserId'],
        });

        // **Total Customers** (All customers)
        const totalCustomers = newCustomers.length + repeatedCustomers.length;

        // Step 4: Format response
        res.json({
            success: true,
            message: 'Customer statistics retrieved successfully!',
            data: {
                repeatedCustomers: repeatedCustomers.length,
                newCustomers: newCustomers.length,
                totalCustomers
            },
            code: 200
        });

    } catch (error) {
        console.error('Error fetching customer status:', error);
        res.status(500).json({ success: false, message: 'Server Error', code: 500 });
    }
};

exports.customerYearlyStatus = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No user ID found', code: 401 });
        }

        // Fetch user role
        const user = await User.findByPk(userId, { include: { model: roles, as: 'role' } });
        if (!user || !user.role) {
            return res.status(403).json({ success: false, message: 'Unauthorized User', code: 403 });
        }

        const userRole = user.role.role_name;
        const currentYear = new Date().getFullYear();

        // Apply role-based conditions
        let whereCondition = {};
        if (userRole === role.SALON_OWNER || userRole === role.SALON_MANAGER) {
            whereCondition.SalonId = req.user.salonId;
        } else if (userRole === role.BARBER) {
            whereCondition.BarberId = req.user.barberId;
        }
        
        // Fetch customer role ID once
        const customerRole = await roles.findOne({ where: { role_name: role.CUSTOMER } });
        if (!customerRole) {
            return res.status(500).json({ success: false, message: 'Customer role not found', code: 500 });
        }

        
        // Fetch customer statistics for each month
        const customerStats = {};
        const months = [
            "january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december"
        ];

        for (let i = 0; i < months.length; i++) {
            let monthStart = new Date(currentYear, i, 1);
            let monthEnd = new Date(currentYear, i + 1, 0, 23, 59, 59);

            // **Repeated Customers** (Users with multiple appointments)
            const repeatedCustomers = await Appointment.findAll({
                attributes: ['UserId', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'appointmentCount']],
                where: {
                    ...whereCondition,
                    createdAt: { [Op.between]: [monthStart, monthEnd] },
                },
                group: ['UserId'],
                having: db.sequelize.literal('COUNT(id) > 1'),
            });

            // **New Customers** (Customers created within the month)
           // **New Customers** (Users whose first appointment is within the month)
                const newCustomers = await Appointment.count({
                    where: {
                        ...whereCondition,
                        createdAt: { [Op.between]: [monthStart, monthEnd] },
                    },
                    distinct: true,
                    col: 'UserId' // Count unique UserIds
                });

            // **Total Customers** (All customers)
            const totalCustomers = newCustomers + repeatedCustomers.length;

            // Store data in the response object
            customerStats[months[i]] = {
                repeatedCustomers: repeatedCustomers.length || 0,
                newCustomers: newCustomers || 0,
                totalCustomers: totalCustomers || 0
            };
        }

        // Step: Send response
        res.json({
            success: true,
            message: "Customer statistics retrieved successfully!",
            data: customerStats,
            code: 200
        });

    } catch (error) {
        console.error('Error fetching yearly customer status:', error);
        res.status(500).json({ success: false, message: 'Server Error', code: 500 });
    }
};