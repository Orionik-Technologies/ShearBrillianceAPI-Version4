module.exports = (sequelize, Sequelize) => {
    const Payment = sequelize.define("Payment", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
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
        UserId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: "Users",
                key: "id"
            }
        },
        amount: {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false
        },
        tip: {
            type: Sequelize.DECIMAL(10, 2),
            defaultValue: 0.0
        },
        tax: {
            type: Sequelize.DECIMAL(10, 2),
            defaultValue: 0.0
        },
        discount: {
            type: Sequelize.DECIMAL(10, 2),
            defaultValue: 0.0
        },
        totalAmount: {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false
        },
        currency: {
            type: Sequelize.STRING(3),
            defaultValue: 'USD'
        },
        paymentStatus: {
            type: Sequelize.ENUM(
                "Pending",
                "Processing",
                "Success",
                "Failed",
                "Refunded",
                "Partially_Refunded",
                "Disputed",
                "Canceled"
            ),
            defaultValue: "Pending"
        },
        paymentIntentId: {
            type: Sequelize.STRING,
            allowNull: true
        },
        chargeId: {
            type: Sequelize.STRING,
            allowNull: true
        },
        refundId: {
            type: Sequelize.STRING,
            allowNull: true
        },
        // Metadata fields
        deviceId: {
            type: Sequelize.STRING,
            allowNull: true
        },
        deviceType: {
            type: Sequelize.ENUM("iOS", "Android", "Web", "Other"),
            allowNull: true
        },
        deviceModel: {
            type: Sequelize.STRING,
            allowNull: true
        },
        osVersion: {
            type: Sequelize.STRING,
            allowNull: true
        },
        ipAddress: {
            type: Sequelize.STRING,
            allowNull: true
        },
        userAgent: {
            type: Sequelize.TEXT,
            allowNull: true
        },
        location: {
            type: Sequelize.JSON,
            allowNull: true,
            comment: "Stores latitude, longitude, and location details"
        },
        // Additional transaction details
        description: {
            type: Sequelize.TEXT,
            allowNull: true
        },
        notes: {
            type: Sequelize.TEXT,
            allowNull: true
        },
        metadata: {
            type: Sequelize.JSON,
            allowNull: true,
            comment: "For storing additional custom metadata"
        },
        failureReason: {
            type: Sequelize.STRING,
            allowNull: true
        },
        refundReason: {
            type: Sequelize.STRING,
            allowNull: true
        },
        // Timestamps
        paymentInitiatedAt: {
            type: Sequelize.DATE,
            allowNull: true
        },
        paymentCompletedAt: {
            type: Sequelize.DATE,
            allowNull: true
        },
        refundedAt: {
            type: Sequelize.DATE,
            allowNull: true
        },
        // Auto timestamps
        createdAt: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW
        },
        updatedAt: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW
        },
        deletedAt: {
            type: Sequelize.DATE,
            allowNull: true
        }
    }, {
        paranoid: true, // Enables soft deletes
        indexes: [
            {
                fields: ['appointmentId']
            },
            {
                fields: ['userId']
            },
            {
                fields: ['paymentIntentId']
            },
            {
                fields: ['status']
            },
            {
                fields: ['createdAt']
            }
        ]
    });

    Payment.associate = (models) => {
        Payment.belongsTo(models.Appointment, { foreignKey: "appointmentId" });
        Payment.belongsTo(models.User, { foreignKey: "userId" });
    };

    return Payment;
};