"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        // Add new ENUM values one by one
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_Appointments_paymentStatus" ADD VALUE IF NOT EXISTS 'Processing';
        `);
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_Appointments_paymentStatus" ADD VALUE IF NOT EXISTS 'Refunded';
        `);
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_Appointments_paymentStatus" ADD VALUE IF NOT EXISTS 'Partially_Refunded';
        `);
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_Appointments_paymentStatus" ADD VALUE IF NOT EXISTS 'Disputed';
        `);
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_Appointments_paymentStatus" ADD VALUE IF NOT EXISTS 'Canceled';
        `);
    },

    async down(queryInterface, Sequelize) {
        // You CANNOT remove ENUM values in PostgreSQL directly.
        // Instead, rollback would require creating a new ENUM without these values.
        console.log("Down migration is not supported for ENUM value removal in PostgreSQL.");
    }
};
