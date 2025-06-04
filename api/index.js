// api/index.js - Version serverless pour Vercel
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('../config/db');

// Create a new Express app for serverless
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection state
let isConnecting = false;
let dbConnection = null;

// Connect to database without blocking
const getDbConnection = async () => {
  if (!dbConnection && !isConnecting) {
    isConnecting = true;
    try {
      await connectDB();
      dbConnection = true;
    } catch (error) {
      console.error('Database connection failed:', error);
    } finally {
      isConnecting = false;
    }
  }
  return dbConnection;
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Database middleware - attempt connection for database routes
app.use('/api/customers', async (req, res, next) => {
  try {
    await getDbConnection();
    next();
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed', details: error.message });
  }
});

// Import routes from main app
const mainApp = require('../app');

// Use main app as middleware, but with error handling
app.use((req, res, next) => {
  try {
    mainApp(req, res, next);
  } catch (error) {
    console.error('Error in main app:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// Export the Express API
module.exports = app;
