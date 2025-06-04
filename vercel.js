// vercel.js - Vercel deployment entry point
const app = require('./app-vercel');
const connectDB = require('./config/db-vercel');

// For Vercel, we'll connect to MongoDB on each request if needed
// instead of at startup, since serverless functions restart frequently

// Export a handler that connects to MongoDB before processing the request
module.exports = async (req, res) => {
  try {
    // Connect to MongoDB (uses cached connection if available)
    await connectDB();
    
    // Forward the request to our Express app
    return app(req, res);
  } catch (error) {
    console.error('Error in Vercel handler:', error);
    
    // If we haven't sent a response yet, send a 500 error
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
};