// controllers/configController.js
const db = require('../models');
const sendResponse = require('../helpers/responseHelper');

exports.getPaymentConfig = async (req, res) => {
    try {
        const config = await db.Configuration.findOne({ where: { key: 'enable_online_payment' } });
        const enableOnlinePayment = config ? config.value : true;
        return sendResponse(res, true, 'Payment configuration retrieved', { enableOnlinePayment }, 200);
    } catch (error) {
        console.error('Error retrieving payment configuration:', error);
        return sendResponse(res, false, 'Failed to retrieve payment configuration', null, 500);
    }
};

exports.updatePaymentConfig = async (req, res) => {
    const { enableOnlinePayment } = req.body;

    if (typeof enableOnlinePayment !== 'boolean') {
        return sendResponse(res, false, 'enableOnlinePayment must be a boolean', null, 400);
    }

    try {
        await db.Configuration.upsert({
            key: 'enable_online_payment',
            value: enableOnlinePayment,
        });
        return sendResponse(res, true, 'Payment configuration updated', { enableOnlinePayment }, 200);
    } catch (error) {
        console.error('Error updating payment configuration:', error);
        return sendResponse(res, false, 'Failed to update payment configuration', null, 500);
    }
};