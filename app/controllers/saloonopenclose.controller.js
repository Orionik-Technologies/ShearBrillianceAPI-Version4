// app/controllers/saloonopenclose.controller.js

const cron = require('node-cron');
const moment = require('moment');
const { Op } = require('sequelize'); // Import Sequelize operators for queries

class SaloonOpenCloseManager {
    constructor() {
        const db = require("../models");

        if (!db || !db.Barber || !db.BarberSession || !db.BarberLeave || !db.Slot) {
            throw new Error('Database models not properly initialized');
        }

        this.db = db;
        this.Salon = db.Salon;
        this.io = null;
    }

    setSocketIO(io) {
        this.io = io;
    }

    emitSocketEvent(eventName, data) {
        if (this.io) {
            this.io.emit(eventName, data);
        }
    }

    
    // Cron job to manage salon open/close status during specific hours
    startSalonStatusCron() {
        cron.schedule("*/15 * * * *", async () => { // Runs every 15 minutes
            const currentTime = moment();
            const currentHour = currentTime.hour();
            const formattedCurrentTime = currentTime.format('HH:mm:ss');

            // Check if the current time is within the allowed intervals
            if ((currentHour >= 6 && currentHour < 12) || (currentHour >= 17 && currentHour < 23)) {
                console.log("Running salon status cron during allowed hours...");

                try {
                    // Fetch all salons from the database
                    const salons = await this.Salon.findAll();

                    // Get current system time in HH:mm:ss format
                    //const currentTime = new Date(); // Ensure currentTime is a Date object
                   // const previousExecutionTime = new Date(currentTime.getTime() - 15 * 60 * 1000); // 15 minutes ago

                    for (const salon of salons) {
                        const openTime = moment(salon.open_time, 'HH:mm:ss').format('HH:mm:ss');
                        const closeTime = moment(salon.close_time, 'HH:mm:ss').format('HH:mm:ss');

                        // Check if current time matches the open_time
                        if (openTime === formattedCurrentTime && salon.status !== 'open') {
                            await salon.update({ status: 'open' });
                            console.log(`Salon ID ${salon.id} status updated to 'open'`);
                        }

                        // Check if current time matches the close_time
                        if (closeTime === formattedCurrentTime && salon.status !== 'close') {
                            await salon.update({ status: 'close' });
                            console.log(`Salon ID ${salon.id} status updated to 'close'`);
                        }
                    }
                    console.log("Salon status cron completed successfully.");
                
                } catch (error) {
                    console.error("Error in salon status cron:", error);
                }
            } else {
                console.log("Salon status cron skipped as it's outside allowed hours.");
            }
        }, {
            timezone: "America/Toronto"
        });
    }
}
    // Singleton instance
    const saloonOpenCloseManager = new SaloonOpenCloseManager();

// Export the initialization function
exports.saloonopenclosecron = (io) => {
        saloonOpenCloseManager.setSocketIO(io);
        saloonOpenCloseManager.startSalonStatusCron();
    };

// Export the manager instance for direct use
exports.saloonOpenCloseManager = saloonOpenCloseManager;