'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('Payments', 'userId', 'UserId');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('Payments', 'UserId', 'userId');
  }
};
