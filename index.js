const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const db = require('./app/models');
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Update with your frontend Vercel URL
    methods: ["GET", "POST", "PUT", "DELETE"], // Include all methods your API supports
    credentials: true,
  },
});



// Import Controllers
const socketController = require('./app/controllers/socket.controller');
const cronController = require('./app/controllers/cron.controller').cronController;
const salonController = require('./app/controllers/salon.controller');
const statusUpdateCronJob = require('./app/controllers/statusUpdate.controller').statusUpdateCronJob;
const barbersessioncron = require('./app/controllers/barbersessioncron.controller').barbersessioncron;

// Use middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Sync database
const syncDatabase = async () => {
  try {
    await db.sequelize.sync({  });
    console.log('Database synced successfully!');
  } catch (error) {
    console.error('Error syncing database:', error);
  }
};

syncDatabase();

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/v4/api-docs', express.static(path.join(__dirname, 'public/swagger')));

// Basic route
app.get('/', (req, res) => {
  res.status(200).send('Shear Brilliance App is running!');
});


// Define port
const PORT = process.env.PORT || 8012;

// Swagger setup
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Shear Brilliance API',
      version: '1.0.0',
      description: 'API documentation for Shear Brilliance',
      contact: {
        name: 'API Support',
        email: 'support@shearbrilliance.com',
      },
      servers: [{ url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}` }],
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./app/routes/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api/v4/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));



// Import and register routes
require('./app/routes/user.routes')(app);
require('./app/routes/role.routes')(app);
require('./app/routes/auth.routes')(app);
require('./app/routes/barber.routes')(app);
require('./app/routes/salon.routes')(app);
require('./app/routes/appointments.routes')(app);
require('./app/routes/blog.routes')(app);
require('./app/routes/favsalon.routes')(app);
require('./app/routes/haircutdetails.routes')(app);
require('./app/routes/contactUs.routes')(app);
require('./app/routes/dashboard.routes')(app);
require('./app/routes/notification.routes')(app);
require('./app/routes/service.routes')(app);
require('./app/routes/barbersession.routes')(app);
require('./app/routes/barberleave.routes')(app);
require('./app/routes/sales.routes')(app);
require('./app/routes/slot.routes')(app);
require('./app/routes/transferAppointmentsOnLeave.routes')(app);

// // Initialize Socket.io and Controllers
socketController.initialize(io); // Initialize the Socket.IO instance
socketController.socketController(io); // Start socket controller
cronController(); // Initialize cron jobs
salonController.initialize(io); // Salon-specific logic
statusUpdateCronJob(); // Status update logic 
barbersessioncron(); // Barber session cron job

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
