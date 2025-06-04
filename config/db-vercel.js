// config/db-vercel.js - MongoDB connection optimized for Vercel
const mongoose = require('mongoose');

// Cache the database connection
let cachedConnection = null;

const connectDB = async () => {
  // If we have a cached connection, use it
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('Using cached database connection');
    return cachedConnection;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/whatsapp-bot', {
      // These options may no longer be needed in newer Mongoose versions,
      // but keeping them for compatibility
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });

    cachedConnection = conn;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    throw error; // Rethrow to handle in the calling function
  }
};

module.exports = connectDB;