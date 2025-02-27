// helpers/configHelper.js
const db = require('../models');

const isOnlinePaymentEnabled = async () => {
    try {
        const config = await db.Configuration.findOne({ where: { key: 'enable_online_payment' } });
        return config ? config.value : true; // Default to true if not found
    } catch (error) {
        console.error('Error fetching configuration:', error);
        return true; // Fallback to true to avoid breaking functionality
    }
};

module.exports = { isOnlinePaymentEnabled };