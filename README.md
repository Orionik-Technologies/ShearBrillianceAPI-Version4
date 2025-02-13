# Shear_Brilliance_api Payment

Here’s a basic README.md template for your Salon Appointment Booking System. You can customize it based on the specifics of your project and stack.

Salon Appointment Booking System
Overview
The Salon Appointment Booking System is a web-based application that allows customers to book appointments at a salon with ease. This system is designed to simplify the appointment scheduling process for both customers and salon staff, providing a user-friendly interface for clients to choose services, book time slots, and make payments.

Features
User Registration and Authentication
Customers can sign up, log in, and manage their profiles.

Appointment Booking
Customers can browse available services, view stylist availability, and schedule appointments.

Salon Dashboard
Admin and salon staff can manage appointments, view schedules, and update service offerings.

Notifications
Email and SMS notifications for appointment confirmations and reminders.

Payment Integration
Secure online payments for services using popular payment gateways.
 
For Migration 
npx sequelize-cli migration:generate --name add-fullname-to-users

Change in migration file

npx sequelize-cli db:migrate
