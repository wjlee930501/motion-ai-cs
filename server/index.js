const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const requestRoutes = require('./routes/requests');
const templateRoutes = require('./routes/templates');
const statsRoutes = require('./routes/stats');
const { connectDB } = require('./db/connection');
const logger = require('./utils/logger');
const { startRequestWorker } = require('./workers/requestWorkerV2');
const { startScheduler } = require('./jobs/scheduler');

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST', 'PATCH', 'DELETE']
    }
});

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

// API Routes
app.use('/api/v1/requests', requestRoutes);
app.use('/api/v1/templates', templateRoutes);
app.use('/api/v1/stats', statsRoutes);

// WebSocket connection handling
io.on('connection', (socket) => {
    logger.info('New WebSocket client connected', { socketId: socket.id });

    socket.on('subscribe:requests', (roomId) => {
        socket.join(`room:${roomId}`);
        logger.info(`Socket ${socket.id} subscribed to room ${roomId}`);
    });

    socket.on('disconnect', () => {
        logger.info('WebSocket client disconnected', { socketId: socket.id });
    });
});

// Make io available to routes
app.set('io', io);

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

// Start server
const PORT = process.env.PORT || 4000;

async function startServer() {
    try {
        // Connect to database
        await connectDB();
        logger.info('Database connected successfully');

        // Start background workers
        startRequestWorker(io);
        logger.info('Request worker started');

        // Start scheduler for reports
        startScheduler();
        logger.info('Scheduler started');

        // Start HTTP server
        httpServer.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
            console.log(`
========================================
ChatLogger Server v2.0.0
========================================
API Server: http://localhost:${PORT}
WebSocket: ws://localhost:${PORT}
Health Check: http://localhost:${PORT}/health
========================================
            `);
        });
    } catch (error) {
        logger.error('Failed to start server', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

// Start the server
startServer();