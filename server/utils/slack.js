const axios = require('axios');
const logger = require('./logger');

async function sendSlackNotification(message) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
        logger.warn('Slack webhook URL not configured');
        return false;
    }

    try {
        await axios.post(webhookUrl, {
            text: message,
            username: 'ChatLogger Bot',
            icon_emoji: ':robot_face:'
        });

        logger.info('Slack notification sent successfully');
        return true;
    } catch (error) {
        logger.error('Failed to send Slack notification', error);
        return false;
    }
}

module.exports = { sendSlackNotification };