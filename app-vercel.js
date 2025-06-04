// app-vercel.js - Modified version of app.js for Vercel deployment
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Services - Use Vercel-adapted versions where needed
const whatsappService = require('./services/whatsapp-vercel.js');
const aiService = require('./services/ai-vercel');
const gatewayService = require('./services/gateway-service');

// Routes
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const aiRoutes = require('./routes/ai');
const apiTestRoutes = require('./routes/api-test');
const clientRoutes = require('./routes/clients-vercel');
const clientDetectionRoutes = require('./routes/client-detection');
const gatewayRoutes = require('./routes/gateway');

// Models
const Customer = require('./models/Customer');

// Suppress initialization logs in Vercel environment
console.log = function() {
  // Only log in development environment
  if (process.env.NODE_ENV !== 'production') {
    console.info.apply(console, arguments);
  }
};

console.error = function() {
  // Always log errors
  console.info.apply(console, arguments);
};

const app = express();

// ===== MIDDLEWARE CONFIGURATION =====
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 
    (process.env.ALLOWED_ORIGINS?.split(',') || '*') : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Body parsing middleware with increased limits
app.use(express.json({ 
  limit: '50mb',
  extended: true
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb',
  parameterLimit: 50000
}));

// Static files
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: false
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ===== MAIN ROUTES =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Dashboard routes
app.get('/agent-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/agent-dashboard.html'));
});

app.get('/clients-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/clients-dashboard.html'));
});

app.get('/ai-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/ai-test.html'));
});

// ===== API ROUTES =====
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/test', apiTestRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/client-detection', clientDetectionRoutes);
app.use('/api/gateway', gatewayRoutes);

// ===== VERCEL-SPECIFIC API ROUTES =====

// Process a message using AI (simplified for serverless)
app.post('/api/process-message', async (req, res) => {
  try {
    const { message, phoneNumber } = req.body;
    
    if (!message || !phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number and message are required' 
      });
    }
    
    const result = await whatsappService.processMessageWithAI(message, phoneNumber);
    res.json(result);
    
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Get WhatsApp Status (simplified for serverless)
app.get('/api/whatsapp-status', (req, res) => {
  try {
    const stats = whatsappService.getStats();
    res.json({
      connected: false, // Always false in serverless
      stats: {
        isConnected: false,
        uptime: stats.uptime,
        totalMessages: stats.totalMessages,
        clientsHelped: stats.clientsHelped,
        aiResponses: stats.aiResponses
      },
      environment: 'vercel-serverless'
    });
  } catch (error) {
    console.error('Error getting WhatsApp status:', error);
    res.status(500).json({ 
      connected: false, 
      error: error.message 
    });
  }
});

// ===== STATISTICS API =====
app.get('/api/stats', async (req, res) => {
  try {
    const [whatsappStats, aiStats, customerCount] = await Promise.all([
      Promise.resolve(whatsappService.getStats()),
      Promise.resolve(aiService.getServiceStats()),
      Customer.countDocuments()
    ]);

    const memoryUsage = process.memoryUsage();
    
    res.json({
      whatsapp: {
        connected: false, // Always false in serverless
        totalMessages: whatsappStats.totalMessages,
        clientsHelped: whatsappStats.clientsHelped,
        aiResponses: whatsappStats.aiResponses,
        uptime: whatsappStats.uptime
      },
      ai: {
        successRate: aiStats.successRate,
        totalRequests: aiStats.totalRequests,
        averageResponseTime: Math.round(aiStats.averageResponseTime) + 'ms'
      },
      customers: {
        total: customerCount,
        helped: whatsappStats.clientsHelped
      },
      system: {
        uptime: whatsappStats.uptime?.formatted || 'N/A',
        memory: {
          used: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
          heap: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB'
        },
        nodeVersion: process.version,
        environment: 'vercel-serverless'
      }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ===== CUSTOMER API =====
app.get('/api/customers', async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    
    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } },
          { city: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    const customers = await Customer.find(query)
      .sort({ lastContactDate: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
      
    const total = await Customer.countDocuments(query);
    
    res.json({
      customers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting customers:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  try {
    const aiStats = aiService.getServiceStats();
    const memUsage = process.memoryUsage();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        whatsapp: {
          connected: false, // Always false in serverless
          uptime: 'N/A',
          mode: 'serverless'
        },
        ai: {
          connected: aiStats.successRate !== '0%',
          successRate: aiStats.successRate || '0%'
        },
        database: {
          connected: true
        }
      },
      system: {
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
          external: Math.round(memUsage.external / 1024 / 1024) + 'MB'
        },
        nodeVersion: process.version,
        environment: 'vercel-serverless'
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== ERROR HANDLING MIDDLEWARE =====

// General error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 
      'Internal server error' : err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`,
    timestamp: new Date().toISOString()
  });
});

module.exports = app;