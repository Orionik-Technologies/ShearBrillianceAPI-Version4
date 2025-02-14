module.exports = (sequelize, Sequelize) => {
    const Payment = sequelize.define("Payment", {
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
        }
    });

    Payment.associate = (models) => {
        Payment.belongsTo(models.Appointment, { foreignKey: "appointmentId" });
    };

    return Payment;
};
