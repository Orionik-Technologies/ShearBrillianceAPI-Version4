'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Payments', 'paymentMethod');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Payments', 'paymentMethod', {
      type: Sequelize.ENUM(
        'Credit_Card', 'Debit_Card', 'Bank_Transfer', 'Digital_Wallet', 'Cash', 'Other'
      ),
      allowNull: false
    });
  }
};
