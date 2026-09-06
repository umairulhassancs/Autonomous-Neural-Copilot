import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import twilio from 'twilio';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Twilio Configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

let twilioClient = null;

// Initialize Twilio only if credentials are provided
if (accountSid && authToken && accountSid !== 'your_twilio_account_sid_here') {
    try {
        twilioClient = twilio(accountSid, authToken);
        console.log('✅ Twilio WhatsApp initialized successfully');
    } catch (error) {
        console.warn('⚠️  Twilio initialization failed:', error.message);
    }
} else {
    console.log('ℹ️  Twilio credentials not configured - WhatsApp notifications disabled');
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        whatsappEnabled: twilioClient !== null,
        timestamp: new Date().toISOString()
    });
});

// Send WhatsApp reminder notification
app.post('/api/send-whatsapp', async (req, res) => {
    try {
        const { to, message } = req.body;

        // Validate request
        if (!to || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: to, message'
            });
        }

        // Check if Twilio is configured
        if (!twilioClient) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp service not configured. Please add Twilio credentials to .env file.'
            });
        }

        // Format phone number for WhatsApp
        const formattedNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

        // Send WhatsApp message
        const twilioMessage = await twilioClient.messages.create({
            body: message,
            from: twilioWhatsAppNumber,
            to: formattedNumber
        });

        console.log(`✅ WhatsApp sent to ${formattedNumber}: ${twilioMessage.sid}`);

        res.json({
            success: true,
            messageSid: twilioMessage.sid,
            to: formattedNumber
        });

    } catch (error) {
        console.error('❌ WhatsApp send error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Send reminder notification (with WhatsApp if number provided)
app.post('/api/send-reminder', async (req, res) => {
    try {
        const { userId, reminderText, whatsappNumber } = req.body;

        if (!userId || !reminderText) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, reminderText'
            });
        }

        const response = {
            success: true,
            userId,
            reminderText,
            whatsappSent: false
        };

        // Send WhatsApp if number is provided and Twilio is configured
        if (whatsappNumber && twilioClient) {
            try {
                const formattedNumber = whatsappNumber.startsWith('whatsapp:')
                    ? whatsappNumber
                    : `whatsapp:${whatsappNumber}`;

                const message = `🔔 Reminder from Jon:\n\n${reminderText}`;

                const twilioMessage = await twilioClient.messages.create({
                    body: message,
                    from: twilioWhatsAppNumber,
                    to: formattedNumber
                });

                response.whatsappSent = true;
                response.messageSid = twilioMessage.sid;

                console.log(`✅ Reminder sent via WhatsApp: ${twilioMessage.sid}`);
            } catch (whatsappError) {
                console.error('⚠️  WhatsApp send failed:', whatsappError.message);
                response.whatsappError = whatsappError.message;
            }
        }

        res.json(response);

    } catch (error) {
        console.error('❌ Reminder error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test WhatsApp endpoint
app.post('/api/test-whatsapp', async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        if (!twilioClient) {
            return res.status(503).json({
                success: false,
                error: 'Twilio not configured. Add credentials to .env file.'
            });
        }

        const formattedNumber = phoneNumber.startsWith('whatsapp:')
            ? phoneNumber
            : `whatsapp:${phoneNumber}`;

        const message = await twilioClient.messages.create({
            body: '✅ Test message from Personal AI Dashboard - Jon is ready!',
            from: twilioWhatsAppNumber,
            to: formattedNumber
        });

        res.json({
            success: true,
            messageSid: message.sid,
            message: 'Test WhatsApp sent successfully!'
        });

    } catch (error) {
        console.error('❌ Test WhatsApp error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║   Personal AI Dashboard - Backend Server  ║
╚════════════════════════════════════════════╝

🚀 Server running on: http://localhost:${PORT}
🔥 Health check: http://localhost:${PORT}/health
📱 WhatsApp: ${twilioClient ? 'Enabled ✅' : 'Disabled ⚠️'}

${!twilioClient ? '⚠️  To enable WhatsApp:\n   1. Add Twilio credentials to .env\n   2. Restart server\n' : ''}
  `);
});

export default app;
