module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Appointments", "paymentStatus", {
      type: Sequelize.ENUM("Pending", "Success", "Failed"),
      defaultValue: "Pending",
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("Appointments", "paymentStatus");
  },
};
