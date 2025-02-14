"use strict";

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable("Payments", {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            appointmentId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: "Appointments",
                    key: "id"
                },
                onDelete: "CASCADE"
            },
            amount: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false
            },
            tip: {
                type: Sequelize.DECIMAL(10, 2),
                defaultValue: 0.0
            },
            totalAmount: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false
            },
            status: {
                type: Sequelize.ENUM("Pending", "Success", "Failed", "Refunded"),
                defaultValue: "Pending"
            },
            paymentIntentId: {
                type: Sequelize.STRING,
                allowNull: true
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
            }
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable("Payments");
    }
};
