const cron = require("node-cron");
const db = require("../models");
const Appointment = db.Appointment;
const Barber = db.Barber;
const { Op } = require('sequelize'); // Import Sequelize operators
const { sendMessageToUser } = require('./socket.controller');

// Function to update status
const cancelUnfinishedAppointments = async () => {
  try {
    // Get today's date
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Find all appointments that are 'checked_in' or 'in_salon' and belong to today
    const appointmentsToCancel = await Appointment.findAll({
      where: {
        status: ["checked_in", "in_salon"], // Adjust according to your field names
      },
      include: [
        {
          model: Barber,
          as: 'Barber', // Include associated Barber
        },
      ],
    });

    // Update their status to 'canceled'
    for (let appointment of appointmentsToCancel) {
      appointment.status = "canceled";
      await appointment.save();

      // Send updates to individual users
      sendMessageToUser(
        appointment.UserId,
        'waitTimeUpdate',
        appointment
      );
    }

    console.log(`${appointmentsToCancel.length} appointments canceled.`);
  } catch (error) {
    console.error("Error canceling unfinished appointments:", error);
  }
};

// Schedule the task to run at 11:59 PM every day
exports.statusUpdateCronJob = () => {
   // First cron job at 11:00 PM
   cron.schedule("0 23 * * *", () => {
    console.log("Running cancelUnfinishedAppointments cron job at 11:00 PM...");
    cancelUnfinishedAppointments();
  }, {
    timezone: "America/Toronto" // Replace with your desired timezone
  });

  cron.schedule("30 23 * * *", () => {
    console.log("Running cancelUnfinishedAppointments cron job...");
    cancelUnfinishedAppointments();
  }, {
    timezone: "America/Toronto" // Replace with your desired timezone
  });
}