const dbConfig = require("../config/db.config.js");

const Sequelize = require("sequelize");
const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  port: 5432, // Port should be in the options object
  dialect: dbConfig.dialect,
  operatorsAliases: false,
  timezone: '+05:30', // Adjust to your timezone offset (e.g., for IST)
  dialectOptions: {
    timezone: '+05:30',
    ssl: {
      connectTimeout: 60000 ,
      require: true,
      rejectUnauthorized: false  // This prevents SSL certificate rejection
    }
  },
  pool: dbConfig.pool,  // You have a pool config defined, include it here
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Add Role model
db.roles = require("./role.model.js")(sequelize, Sequelize);

// Add User model
db.USER = require("./user.model.js")(sequelize, Sequelize);

// Add Salon model
db.Salon = require("./salon.model.js")(sequelize, Sequelize);

// Add Appointments model
db.Appointment = require("./appointments.model.js")(sequelize, Sequelize);

// Add AppointmentService model
db.AppointmentService = require("./appointmentService.model.js")(sequelize, Sequelize);

// Add Blog model
db.Blog = require("./blog.model.js")(sequelize, Sequelize);

// Add Favorite Salon model
db.FavoriteSalon = require("./favsalon.model.js")(sequelize, Sequelize); // Added Favorite Salon model

// Add HaircutDetails model
db.HaircutDetails = require("./haircutdetails.model.js")(sequelize, Sequelize);

// Add Service model
db.Service = require("./service.model.js")(sequelize, Sequelize);

// Add Barber model
db.Barber = require("./barber.model.js")(sequelize, Sequelize);

// Add BarberSession model
db.BarberSession = require("./barbersession.model.js")(sequelize, Sequelize);

// Add Leave model
db.BarberLeave = require("./barberleave.model.js")(sequelize, Sequelize);

// Add BarberService model
db.BarberService = require("./BarberService.model.js")(sequelize, Sequelize);

// Add UserSalon model
db.UserSalon= require("./usersalon.model.js")(sequelize, Sequelize);

//Add FcmToken model
db.fcmTokens = require("./fcmTokens.model.js")(sequelize, Sequelize);

//Add Slot model
db.Slot= require("./slot.model.js")(sequelize, Sequelize);

//Add Career model
db.Career = require("./Career.model.js")(sequelize, Sequelize);

db.Payment = require("./payment.model.js")(sequelize, Sequelize);


module.exports = db;