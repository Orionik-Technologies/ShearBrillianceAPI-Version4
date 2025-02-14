'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Payments', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      appointmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Appointments',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
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
      status: {
        type: Sequelize.ENUM('Pending', 'Processing', 'Success', 'Failed', 'Refunded', 'Partially_Refunded', 'Disputed', 'Canceled'),
        defaultValue: 'Pending'
      },
      paymentMethod: {
        type: Sequelize.ENUM('Credit_Card', 'Debit_Card', 'Bank_Transfer', 'Digital_Wallet', 'Cash', 'Other'),
        allowNull: false
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
      deviceId: {
        type: Sequelize.STRING,
        allowNull: true
      },
      deviceType: {
        type: Sequelize.ENUM('iOS', 'Android', 'Web', 'Other'),
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
        allowNull: true
      },
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
        allowNull: true
      },
      failureReason: {
        type: Sequelize.STRING,
        allowNull: true
      },
      refundReason: {
        type: Sequelize.STRING,
        allowNull: true
      },
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
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Add indexes
    await queryInterface.addIndex('Payments', ['appointmentId']);
    await queryInterface.addIndex('Payments', ['userId']);
    await queryInterface.addIndex('Payments', ['paymentIntentId']);
    await queryInterface.addIndex('Payments', ['status']);
    await queryInterface.addIndex('Payments', ['createdAt']);
  },

  down: async (queryInterface, Sequelize) => {
    // Drop indexes first
    await queryInterface.removeIndex('Payments', ['appointmentId']);
    await queryInterface.removeIndex('Payments', ['userId']);
    await queryInterface.removeIndex('Payments', ['paymentIntentId']);
    await queryInterface.removeIndex('Payments', ['status']);
    await queryInterface.removeIndex('Payments', ['createdAt']);

    // Drop the table
    await queryInterface.dropTable('Payments');
  }
};