'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add paymentMode column
    await queryInterface.addColumn('Appointments', 'paymentMode', {
      type: Sequelize.ENUM('Pay_In_Person', 'Pay_Online'),
      allowNull: false,
      defaultValue: 'Pay_In_Person'
    });

    // Add stripePaymentIntentId column
    await queryInterface.addColumn('Appointments', 'stripePaymentIntentId', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove columns
    await queryInterface.removeColumn('Appointments', 'stripePaymentIntentId');
    await queryInterface.removeColumn('Appointments', 'paymentMode');
  }
};