module.exports = (sequelize, Sequelize) => {
    const Configuration = sequelize.define("Configuration", {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        key: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
        },
        value: {
            type: Sequelize.BOOLEAN,
            allowNull: false
        }
    });

    return Configuration;
}