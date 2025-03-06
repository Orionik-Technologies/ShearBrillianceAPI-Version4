// app/controllers/barbersessioncron.controller.js

const moment = require('moment');
const { Op } = require('sequelize');
const cron = require('node-cron');

class BarberSlotManager {
    constructor() {
        const db = require("../models");
        
        if (!db || !db.Barber || !db.BarberSession || !db.BarberLeave || !db.Slot) {
            throw new Error('Database models not properly initialized');
        }

        this.db = db;
        this.Barber = db.Barber;
        this.BarberSession = db.BarberSession;
        this.BarberLeave = db.BarberLeave;
        this.Slot = db.Slot;
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

    getSlotDuration(category) {
       return 15;
    }

    isNonWorkingDay(barber, date) {
        if (!barber.non_working_days || !Array.isArray(barber.non_working_days)) {
            return false;
        }
        
        // moment.day() returns 0-6 (Sunday-Saturday)
        // We need to convert it to 1-7 (Monday-Sunday) format
        let dayNumber = moment(date).day();
        // Convert Sunday from 0 to 7
        dayNumber = dayNumber === 0 ? 7 : dayNumber;
        
        return barber.non_working_days.includes(dayNumber);
    }

    async isBarberOnLeave(barberId, date) {
        return await this.BarberLeave.findOne({
            where: {
                BarberId: barberId,
                start_date: { [Op.lte]: date },
                end_date: { [Op.gte]: date },
                status: 'approved'
            }
        }) !== null;
    }

    async shouldGenerateSession(barber, date) {
        // Check both leave and non-working day
        const isOnLeave = await this.isBarberOnLeave(barber.id, date.toDate());
        const isNonWorking = this.isNonWorkingDay(barber, date);

        // Get weekly schedule for current day
        const dayOfWeek = date.day();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayKey = days[dayOfWeek];

        // Add safety checks for weekly_schedule
        if (!barber.weekly_schedule || !barber.weekly_schedule[dayKey]) {
            console.log(`No weekly schedule found for barber ${barber.id} on ${dayKey}`);
            return false;
        }

        const daySchedule = barber.weekly_schedule[dayKey];
        const hasValidHours = daySchedule.start_time && daySchedule.end_time;
        
        return !isOnLeave && !isNonWorking && hasValidHours;
    }



    async generateSlots(sessionData, barber) {
        // Only create slots if the barber/session category is 1
        if (sessionData.category !== 1) {
            console.log(`Skipping slot generation for session ${sessionData.id} - category ${sessionData.category} is not eligible`);
            return [];
        }
    
        const slots = [];
        const startTime = moment(sessionData.session_date)
            .set('hour', moment(sessionData.start_time, 'HH:mm:ss').hour())
            .set('minute', moment(sessionData.start_time, 'HH:mm:ss').minute());
        const endTime = moment(sessionData.session_date)
            .set('hour', moment(sessionData.end_time, 'HH:mm:ss').hour())
            .set('minute', moment(sessionData.end_time, 'HH:mm:ss').minute());
    
        const slotDuration = this.getSlotDuration(barber.category);
        let currentTime = moment(startTime);
    
        while (currentTime.isBefore(endTime)) {
            slots.push({
                BarberSessionId: sessionData.id,
                SalonId: barber.SalonId,
                slot_date: moment(sessionData.session_date).format('YYYY-MM-DD'),
                start_time: currentTime.format('HH:mm:ss'),
                end_time: moment(currentTime).add(slotDuration, 'minutes').format('HH:mm:ss'),
                is_booked: false,
                createdAt: new Date(),
                updatedAt: new Date()
            });
    
            currentTime.add(slotDuration, 'minutes');
        }
    
        console.log(`Generated ${slots.length} slots for category 1 session ${sessionData.id}`);
        return slots;
    }

    calculateRemainingTime(startTime, endTime) {
        const start = moment(startTime, 'HH:mm:ss');
        const end = moment(endTime, 'HH:mm:ss');
        return end.diff(start, 'minutes');
    }

    async getUnavailabilityReason(barber, date) {
        const isOnLeave = await this.isBarberOnLeave(barber.id, date.toDate());
        const isNonWorking = this.isNonWorkingDay(barber, date);

        // Check weekly schedule
        const dayOfWeek = date.day();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayKey = days[dayOfWeek];

        const daySchedule = barber.weekly_schedule ? barber.weekly_schedule[dayKey] : null;
        const hasValidHours = daySchedule && daySchedule.start_time && daySchedule.end_time;
        
        if (isOnLeave && isNonWorking) return 'leave-and-non-working';
        if (isOnLeave) return 'leave';
        if (isNonWorking) return 'non-working-day';
        if (!hasValidHours) return 'no-working-hours';
        return 'unavailable';
    }

    async generateSessionsForDateRange(barber, startDate, endDate, transaction) {
        let currentDate = moment(startDate);
        const sessions = [];
        
        while (currentDate.isSameOrBefore(endDate)) {
            const dateStr = currentDate.format('YYYY-MM-DD');
            console.log(`Processing date ${dateStr} for barber ${barber.id}`);

            // Calculate dayKey for the current date
            const dayOfWeek = currentDate.day();
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayKey = days[dayOfWeek];

            try {
                const shouldGenerate = await this.shouldGenerateSession(barber, currentDate);
                console.log(`Should generate session for ${dateStr}:`, shouldGenerate);

                if (shouldGenerate) {
                    // Get day's schedule from weekly_schedule
                    const dayOfWeek = currentDate.day();
                    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    const daySchedule = barber.weekly_schedule[dayKey];

                      // Additional check (redundant but safe)
                    if (!daySchedule || !daySchedule.start_time || !daySchedule.end_time) {
                        console.log(`Invalid schedule for ${dayKey}`);
                        continue;
                    }

                    const sessionData = {
                        BarberId: barber.id,
                        SalonId: barber.SalonId,
                        start_time: daySchedule.start_time,
                        end_time: daySchedule.end_time,
                        session_date: dateStr,
                        remaining_time: this.calculateRemainingTime(
                            daySchedule.start_time,
                            daySchedule.end_time
                        ),
                        category: barber.category,
                        position: barber.position
                    };
    
                    console.log('Creating session with data:', sessionData);
    
                    const session = await this.BarberSession.create(sessionData, { transaction });
                    console.log('Session created:', session.id);
    
                    const slots = await this.generateSlots(session, barber);
                    console.log(`Generated ${slots.length} slots for session ${session.id}`);
    
                    await this.Slot.bulkCreate(slots, { transaction });
                    console.log('Slots saved to database');
    
                    sessions.push(session);
    
                    this.emitSocketEvent('sessionCreated', {
                        barberId: barber.id,
                        salonId: barber.SalonId,
                        sessionId: session.id,
                        date: dateStr,
                        hasSlots: slots.length > 0,
                        startTime: daySchedule.start_time,
                        endTime: daySchedule.end_time
                    });
                } else {
                    console.log(`Skipping session generation for barber ${barber.id} on ${dateStr} - unavailable`);
                    // ... rest of the unavailability emission code ...
                    const isOnLeave = await this.isBarberOnLeave(barber.id, currentDate.toDate());
                    const isNonWorking = this.isNonWorkingDay(barber, currentDate);

                    const reason = await this.getUnavailabilityReason(barber, currentDate);
                    
                    this.emitSocketEvent('sessionUnavailable', {
                        barberId: barber.id,
                        salonId: barber.SalonId,
                        date: dateStr,
                        reason: reason,
                        isNonWorking: isNonWorking,
                        isOnLeave: isOnLeave,
                        unavailabilityDetails: {
                            nonWorkingDays: barber.non_working_days || [],
                            weeklySchedule: barber.weekly_schedule || {}
                        }
                    });
                }
            }catch (error) {
                console.error(`Error processing date ${dateStr}:`, {
                    error: error.message,
                    stack: error.stack
                });
                // Continue with next date instead of failing completely
            }
            currentDate.add(1, 'day');
        }
        return sessions;
    }



    async maintainBarberSessions(barber, today, fourWeeksLater, transaction) {
        try {
            const barberWithSchedule = await this.Barber.findByPk(barber.id, {
                attributes: ['id', 'SalonId', 'category', 'position', 'weekly_schedule', 'non_working_days'],
                transaction
            });

            if (!barberWithSchedule) {
                console.error(`Barber ${barber.id} not found`);
                return;
            }

            // 5. Verify schedule data exists
            if (!barberWithSchedule.weekly_schedule) {
                console.error(`No weekly schedule found for barber ${barber.id}`);
                return;
            }

            const latestSession = await this.BarberSession.findOne({
                where: { BarberId: barber.id },
                order: [['session_date', 'DESC']],
                transaction
            });

            let startDate;
            if (!latestSession) {
                startDate = today;
                console.log(`No previous sessions for barber ${barber.id}, starting from today`);
            } else {
                startDate = moment(latestSession.session_date).add(1, 'day').startOf('day');
                console.log(`Latest session for barber ${barber.id} was ${latestSession.session_date}, starting from ${startDate.format('YYYY-MM-DD')}`);
            }

            const endDate = moment(fourWeeksLater).endOf('day');

            if (startDate.isBefore(endDate)) {
                console.log(`Generating sessions for barber ${barber.id} from ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);
                await this.generateSessionsForDateRange(barberWithSchedule, startDate, endDate, transaction);
            } else {
                console.log(`No new sessions needed for barber ${barber.id} - already up to date`);
            }

        } catch (error) {
            console.error(`Error maintaining sessions for barber ${barber.id}:`, error);
            throw error;
        }
    }

    async maintainFourWeekSessions() {
        const transaction = await this.db.sequelize.transaction();

        try {
            const today = moment().startOf('day');
            const fourWeeksLater = moment(today).add(4, 'weeks').endOf('day');

            console.log('Maintenance period:', {
                today: today.format('YYYY-MM-DD'),
                fourWeeksLater: fourWeeksLater.format('YYYY-MM-DD')
            });

            const barbers = await this.Barber.findAll({
                where: { availability_status: 'available' },
                attributes: {
                    include: ['weekly_schedule'] // Explicitly include the JSON field
                },
            });

            console.log(`Found ${barbers.length} available barbers`);
            
            for (const barber of barbers) {
                console.log(`Processing barber ID: ${barber.id}`, {
                    nonWorkingDays: barber.non_working_days,
                    weeklySchedule: barber.weekly_schedule
                });

                await this.maintainBarberSessions(barber, today, fourWeeksLater, transaction);
            }

            await this.cleanupOldData(today.toDate(), transaction);
            await transaction.commit();
            console.log('Session maintenance completed successfully');

        } catch (error) {
            await transaction.rollback();
            console.error('Error in maintainFourWeekSessions:', error);
            throw error;
        }
    }

    async cleanupOldData(date, transaction) {
        try {
            await Promise.all([
                this.Slot.destroy({
                    where: {
                        slot_date: { [Op.lt]: moment(date).format('YYYY-MM-DD') }
                    },
                    transaction
                }),
                this.BarberSession.destroy({
                    where: {
                        session_date: { [Op.lt]: date }
                    },
                    transaction
                })
            ]);

            this.emitSocketEvent('sessionsCleanup', {
                cleanupDate: moment(date).format('YYYY-MM-DD')
            });
        } catch (error) {
            console.error('Error in cleanupOldData:', error);
            throw error;
        }
    }


    // function to update the barber sessions for non-working days if it is update from Barber profile...
    async updateBarberSessionsForNonWorkingDays(barberId, oldNonWorkingDays, newNonWorkingDays) {
        const transaction = await this.db.sequelize.transaction();
        
        try {
            // Get the barber details
            const barber = await this.Barber.findByPk(barberId);
            if (!barber) {
                throw new Error('Barber not found');
            }

            const today = moment().startOf('day');
            const fourWeeksLater = moment(today).add(4, 'weeks').endOf('day');

            // Get all existing sessions in the date range
            const existingSessions = await this.BarberSession.findAll({
                where: {
                    BarberId: barberId,
                    session_date: {
                        [Op.between]: [today.format('YYYY-MM-DD'), fourWeeksLater.format('YYYY-MM-DD')]
                    }
                },
                transaction
            });

            // Process each date in the range
            let currentDate = moment(today);
            while (currentDate.isSameOrBefore(fourWeeksLater)) {
                const dateStr = currentDate.format('YYYY-MM-DD');
                const dayNumber = currentDate.day() === 0 ? 7 : currentDate.day();

                // Check if the day's working status has changed
                const wasNonWorking = oldNonWorkingDays?.includes(dayNumber);
                const isNowNonWorking = newNonWorkingDays?.includes(dayNumber);

                if (wasNonWorking !== isNowNonWorking) {
                    const existingSession = existingSessions.find(
                        session => moment(session.session_date).format('YYYY-MM-DD') === dateStr
                    );

                    if (wasNonWorking && !isNowNonWorking) {
                        // Day changed from non-working to working - create new session
                        if (!existingSession) {
                            const isOnLeave = await this.isBarberOnLeave(barberId, currentDate.toDate());
                            if (!isOnLeave) {
                                // Get day's schedule
                                const dayOfWeek = currentDate.day();
                                const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                                const dayKey = days[dayOfWeek];
                                const daySchedule = barber.weekly_schedule[dayKey];

                                if (daySchedule.start_time && daySchedule.end_time) {
                                    const sessionData = {
                                        BarberId: barberId,
                                        SalonId: barber.SalonId,
                                        start_time: daySchedule.start_time,
                                        end_time: daySchedule.end_time,
                                        session_date: dateStr,
                                        remaining_time: this.calculateRemainingTime(
                                            daySchedule.start_time,
                                            daySchedule.end_time
                                        ),
                                        category: barber.category,
                                        position: barber.position
                                    };
                      

                                    const newSession = await this.BarberSession.create(sessionData, { transaction });
                                    const slots = await this.generateSlots(newSession, barber);
                                    await this.Slot.bulkCreate(slots, { transaction });

                                    this.emitSocketEvent('sessionCreated', {
                                        barberId: barber.id,
                                        salonId: barber.SalonId,
                                        sessionId: newSession.id,
                                        date: dateStr,
                                        hasSlots: slots.length > 0,
                                        startTime: daySchedule.start_time,
                                        endTime: daySchedule.end_time
                                    });
                                }
                            }
                        }
                    } else if (!wasNonWorking && isNowNonWorking) {
                        // Day changed from working to non-working - remove existing session
                        if (existingSession) {
                            // Delete associated slots first
                            await this.Slot.destroy({
                                where: { BarberSessionId: existingSession.id },
                                transaction
                            });

                            // Delete the session
                            await existingSession.destroy({ transaction });

                            this.emitSocketEvent('sessionUnavailable', {
                                barberId: barber.id,
                                salonId: barber.SalonId,
                                date: dateStr,
                                reason: 'non-working-day',
                                isNonWorking: true,
                                isOnLeave: false,
                                unavailabilityDetails: {
                                    nonWorkingDays: newNonWorkingDays,
                                    weeklySchedule: barber.weekly_schedule
                                }
                            });
                        }
                    }
                }

                currentDate.add(1, 'day');
            }

            await transaction.commit();
            return true;

        } catch (error) {
            await transaction.rollback();
            console.error('Error updating barber sessions for non-working days:', error);
            throw error;
        }
    }


    // Inside BarberSlotManager class
    async updateBarberSessionsForScheduleChange(barberId, categoryChanged,  options = {}) {
        const transaction = options.transaction || await this.db.sequelize.transaction();
        try {
            const barber = await this.Barber.findByPk(barberId, { transaction });
            if (!barber) {
                throw new Error('Barber not found');
            }

            // Determine date range
            const today = moment();
            let startDate;
            let endDate;
            
            if (categoryChanged) {
                // For category changes: today + 4 weeks
                startDate = today.clone().startOf('day');
                endDate = today.clone().add(4, 'weeks').endOf('day');
            } else {
                // For schedule changes: next Monday + 3 weeks
                startDate = today.clone().startOf('isoWeek').add(1, 'week');
                endDate = startDate.clone().add(3, 'weeks').endOf('isoWeek');
            }

            // Fetch existing sessions in range
            const existingSessions = await this.BarberSession.findAll({
                where: {
                    BarberId: barberId,
                    session_date: { 
                        [Op.between]: [
                            startDate.format('YYYY-MM-DD'), 
                            endDate.format('YYYY-MM-DD')
                        ]
                    }
                },
                transaction
            });

            // Create session map
            const sessionsByDate = {};
            existingSessions.forEach(session => {
                sessionsByDate[moment(session.session_date).format('YYYY-MM-DD')] = session;
            });

            // Process each date in range
            let currentDate = startDate.clone();
            while (currentDate.isSameOrBefore(endDate)) {
                const dateStr = currentDate.format('YYYY-MM-DD');
                const dayOfWeek = currentDate.day();
                const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const dayKey = days[dayOfWeek];
                const daySchedule = barber.weekly_schedule[dayKey];
                
                const existingSession = sessionsByDate[dateStr];
                const shouldHaveSession = daySchedule && 
                                        daySchedule.start_time && 
                                        daySchedule.end_time && 
                                        !(barber.non_working_days || []).includes(dayOfWeek);

                if (existingSession) {
                    const scheduleChanged = existingSession.start_time !==  daySchedule?.start_time || 
                                        existingSession.end_time !== daySchedule?.end_time;
                    const needsUpdate = scheduleChanged || categoryChanged;

                    if (!shouldHaveSession) {
                        // Remove invalid session
                        await this.Slot.destroy({
                            where: { BarberSessionId: existingSession.id },
                            transaction
                        });
                        await existingSession.destroy({ transaction });

                        this.emitSocketEvent('sessionUnavailable', {
                            barberId: barber.id,
                            salonId: barber.SalonId,
                            date: dateStr,
                            reason: 'no-working-hours',
                            isNonWorking: true,
                            isOnLeave: false
                        });
                    } else if (needsUpdate) {
                        // Update existing session
                        await existingSession.update({
                            start_time: daySchedule.start_time,
                            end_time: daySchedule.end_time,
                            remaining_time: this.calculateRemainingTime(
                                daySchedule.start_time,
                                daySchedule.end_time
                            ),
                            category: barber.category
                        }, { transaction });

                        // Regenerate slots
                        await this.Slot.destroy({
                            where: { BarberSessionId: existingSession.id },
                            transaction
                        });

                        const slots = await this.generateSlots(existingSession, barber);
                        await this.Slot.bulkCreate(slots, { transaction });

                        this.emitSocketEvent('sessionUpdated', {
                            barberId: barber.id,
                            salonId: barber.SalonId,
                            sessionId: existingSession.id,
                            date: dateStr,
                            hasSlots: slots.length > 0
                        });
                    }
                } else if (shouldHaveSession) {
                    // Create new session
                    const sessionData = {
                        BarberId: barberId,
                        SalonId: barber.SalonId,
                        start_time: daySchedule.start_time,
                        end_time: daySchedule.end_time,
                        session_date: dateStr,
                        remaining_time: this.calculateRemainingTime(
                            daySchedule.start_time,
                            daySchedule.end_time
                        ),
                        category: barber.category,
                        position: barber.position
                    };

                    const newSession = await this.BarberSession.create(sessionData, { transaction });
                    const slots = await this.generateSlots(newSession, barber);
                    await this.Slot.bulkCreate(slots, { transaction });

                    this.emitSocketEvent('sessionCreated', {
                        barberId: barber.id,
                        salonId: barber.SalonId,
                        sessionId: newSession.id,
                        date: dateStr,
                        hasSlots: slots.length > 0
                    });
                }

                currentDate.add(1, 'day');
            }

            // Commit only if the transaction was created here
            if (!options.transaction) {
                await transaction.commit();
            }
            return true;
        } catch (error) {
            await transaction.rollback();
            console.error('Error updating sessions:', error);
            throw error;
        }
    }

}

// Create singleton instance
const barberSlotManager = new BarberSlotManager();

// Export the initialization function
exports.barbersessioncron = (io) => {
    if (io) {
        barberSlotManager.setSocketIO(io);
    }

    cron.schedule("02 02 * * *", async () => {
        console.log("Running barber session maintenance...");
        try {
            await barberSlotManager.maintainFourWeekSessions();
            console.log("Barber session maintenance completed successfully");
        } catch (error) {
            console.error("Error in cron job:", error);
        }
    }, {
        timezone: "America/Toronto"
    });
};

// Export the manager instance for direct use
exports.barberSlotManager = barberSlotManager;