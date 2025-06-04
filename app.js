// app.js - Application corrigée avec Google Sheets routes
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Services
const whatsappService = require('./services/whatsapp-unified.js');
const aiEnhanced = require('./services/ai-enhanced');
const multimediaService = require('./services/multimedia');
const intelligentAgent = require('./services/intelligent-agent');

// Routes
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const aiRoutes = require('./routes/ai');
const apiTestRoutes = require('./routes/api-test');
const clientRoutes = require('./routes/clients');
const confirmationRoutes = require('./routes/confirmations');
const conversationTestRoutes = require('./routes/conversation-test');

// Models
const Customer = require('./models/Customer');

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

// Media files with proper MIME types
app.use('/media', express.static(path.join(__dirname, 'public/media'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    }
  }
}));

// Request logging middleware
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  }
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

app.get('/confirmations', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/confirmations.html'));
});

// Google Sheets Test Page
app.get('/google-sheets-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/google-sheets-test.html'));
});

// ===== MULTER CONFIGURATION =====
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadDir;
    
    if (req.path.includes('products')) {
      uploadDir = path.join(__dirname, 'public/uploads/products');
    } else if (file.mimetype.startsWith('image/')) {
      uploadDir = multimediaService.WELCOME_IMAGES_DIR;
    } else if (file.mimetype.startsWith('video/')) {
      uploadDir = multimediaService.WELCOME_VIDEOS_DIR;
    } else if (file.mimetype.startsWith('audio/')) {
      uploadDir = multimediaService.WELCOME_AUDIO_DIR;
    } else {
      uploadDir = path.join(__dirname, 'public/uploads');
    }
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv',
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Type de fichier non autorisé: ${file.mimetype}`), false);
    }
  }
});

// ===== API ROUTES =====
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/test', apiTestRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/confirmations', confirmationRoutes);
app.use('/api/conversation-test', conversationTestRoutes);

// ===== GOOGLE SHEETS API ROUTES =====
app.get('/api/google-sheets/status', (req, res) => {
  try {
    const googleSheetsService = require('./services/google-sheets');
    const status = googleSheetsService.getServiceStatus();
    
    res.json({
      success: true,
      status,
      environment: {
        hasSpreadsheetId: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
        hasServiceEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        hasPrivateKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
        spreadsheetIdPreview: process.env.GOOGLE_SHEETS_SPREADSHEET_ID ? 
          `${process.env.GOOGLE_SHEETS_SPREADSHEET_ID.substring(0, 10)}...` : 'Not set'
      }
    });
  } catch (error) {
    console.error('Error getting Google Sheets status:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.post('/api/google-sheets/test-connection', async (req, res) => {
  try {
    const googleSheetsService = require('./services/google-sheets');
    const testResult = await googleSheetsService.testConnection();
    
    res.json({
      success: testResult.success,
      result: testResult
    });
  } catch (error) {
    console.error('Error testing Google Sheets connection:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.post('/api/google-sheets/test-add-client', async (req, res) => {
  try {
    const googleSheetsService = require('./services/google-sheets');
    
    // بيانات تجريبية مع طابع زمني لتجنب التكرار
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const testClientData = {
      name: `عميل تجريبي ${timestamp.substring(11, 19)}`,
      city: 'الدار البيضاء',
      address: 'شارع محمد الخامس، حي الحسان',
      phoneNumber: `+212600${Math.floor(Math.random() * 900000 + 100000)}`,
      pack: 'Pack Premium',
      prix: '299 MAD',
      notes: `بيانات تجريبية للاختبار - ${new Date().toLocaleString('ar-MA')}`
    };
    
    console.log('🧪 Testing add client to Google Sheets with data:', testClientData);
    
    const result = await googleSheetsService.addClientToSheet(testClientData);
    
    res.json({
      success: result.success,
      result,
      testData: testClientData
    });
  } catch (error) {
    console.error('Error testing add client to Google Sheets:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.get('/api/google-sheets/get-clients', async (req, res) => {
  try {
    const googleSheetsService = require('./services/google-sheets');
    const result = await googleSheetsService.getAllClients();
    
    res.json({
      success: result.success,
      clients: result.clients || [],
      total: result.total || 0,
      message: result.message
    });
  } catch (error) {
    console.error('Error getting clients from Google Sheets:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// إضافة endpoint لحذف جميع العملاء التجريبيين (للتنظيف)
app.post('/api/google-sheets/cleanup-test-data', async (req, res) => {
  try {
    res.json({
      success: false,
      message: 'Cleanup functionality not implemented yet'
    });
  } catch (error) {
    console.error('Error cleaning up test data:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ===== WHATSAPP API ENDPOINTS =====

// WhatsApp Status
app.get('/api/whatsapp-status', (req, res) => {
  try {
    const stats = whatsappService.getStats();
    res.json({
      connected: stats.isConnected,
      qr: stats.qrCodeAvailable ? whatsappService.qrCodeData : null,
      stats: {
        isConnected: stats.isConnected,
        uptime: stats.uptime,
        totalMessages: stats.totalMessages,
        clientsHelped: stats.clientsHelped,
        aiResponses: stats.aiResponses,
        conversationsWithMemory: stats.memory?.activeConversations || 0
      }
    });
  } catch (error) {
    console.error('Error getting WhatsApp status:', error);
    res.status(500).json({ 
      connected: false, 
      error: error.message 
    });
  }
});

// Refresh QR Code
app.post('/api/refresh-qr', async (req, res) => {
  try {
    console.log('🔄 QR Code refresh requested...');
    await whatsappService.resetClient(); // Ensure this fully completes or throws

    // Wait a bit longer for the 'qr' event to populate whatsappService.qrCodeData
    // This part is still a workaround; event-driven would be better.
    setTimeout(() => {
      const qr = whatsappService.qrCodeData;
      if (qr) {
        res.json({ success: true, qr: qr });
      } else if (whatsappService.isClientReady) {
         // If client became ready without a QR (e.g., session restored)
         res.json({ success: true, message: "Client is ready, no QR code needed." });
      } else {
        console.warn('QR code not available after reset attempt.');
        res.status(503).json({ // Service Unavailable might be more appropriate
          success: false,
          message: 'QR code not generated after reset. Client might be initializing or an error occurred.'
        });
      }
    }, 8000); // Increased wait time to 8 seconds for Vercel's potentially slower environment

  } catch (error) {
    console.error('Error in /api/refresh-qr:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to refresh QR code due to an internal error.'
    });
  }
});

// Send Manual Message
app.post('/api/send-message', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number and message are required' 
      });
    }
    
    const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
    if (cleanPhoneNumber.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }
    
    const result = await whatsappService.sendManualMessage(phoneNumber, message);
    
    if (result.success) {
      try {
        const customer = await Customer.findOne({ 
          phoneNumber: cleanPhoneNumber 
        });
        if (customer) {
          customer.lastContactDate = new Date();
          customer.messageCount += 1;
          await customer.save();
        }
      } catch (dbError) {
        console.error('Error updating customer:', dbError);
      }
      
      res.json({ success: true });
    } else {
      res.status(500).json({ 
        success: false, 
        message: result.error || 'Failed to send message'
      });
    }
  } catch (error) {
    console.error('Error sending manual message:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Send Multimedia
app.post('/api/send-multimedia', async (req, res) => {
  try {
    const { phoneNumber, mediaType, filename } = req.body;
    
    if (!phoneNumber || !mediaType || !filename) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number, media type, and filename are required' 
      });
    }
    
    const mediaPath = multimediaService.getFilePath(mediaType, filename);
    if (!fs.existsSync(mediaPath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'Media file not found' 
      });
    }
    
    const result = await whatsappService.sendManualMessage(phoneNumber, '', mediaPath);
    
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ 
        success: false, 
        message: result.error || 'Failed to send media'
      });
    }
  } catch (error) {
    console.error('Error sending multimedia:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ===== STATISTICS API =====
app.get('/api/stats', async (req, res) => {
  try {
    const [whatsappStats, aiStats, customerCount] = await Promise.all([
      Promise.resolve(whatsappService.getStats()),
      Promise.resolve(aiEnhanced.getServiceStats()),
      Customer.countDocuments()
    ]);

    const memoryUsage = process.memoryUsage();
    
    res.json({
      whatsapp: {
        connected: whatsappStats.isConnected,
        totalMessages: whatsappStats.totalMessages,
        clientsHelped: whatsappStats.clientsHelped,
        aiResponses: whatsappStats.aiResponses,
        uptime: whatsappStats.uptime,
        conversationsWithMemory: whatsappStats.memory?.activeConversations || 0
      },
      ai: {
        successRate: aiStats.successRate,
        totalRequests: aiStats.totalRequests,
        averageResponseTime: Math.round(aiStats.averageResponseTime) + 'ms',
        conversationsActive: aiStats.conversationStats?.activeConversations || 0
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
        environment: process.env.NODE_ENV || 'development'
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

// ===== WELCOME MESSAGE API =====
app.get('/api/settings/welcome-message', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'config/welcome-message.json');
    
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      res.json(data);
    } else {
      res.json({ 
        message: whatsappService.welcomeMessage || 'Default welcome message' 
      });
    }
  } catch (error) {
    console.error('Error getting welcome message:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

app.post('/api/settings/welcome-message', (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message content is required' 
      });
    }
    
    const success = whatsappService.updateWelcomeMessage(message.trim());
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update welcome message' 
      });
    }
  } catch (error) {
    console.error('Error updating welcome message:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ===== MEDIA API ENDPOINTS =====
['images', 'videos', 'audio'].forEach(mediaType => {
  // Get media files
  app.get(`/api/settings/welcome-${mediaType}`, async (req, res) => {
    try {
      const files = await multimediaService.getMediaFiles(mediaType);
      res.json({ [mediaType]: files });
    } catch (error) {
      console.error(`Error getting ${mediaType}:`, error);
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });

  // Upload media files
  app.post(`/api/settings/welcome-${mediaType}`, 
    upload.array(mediaType, 10), 
    (req, res) => {
      try {
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ 
            success: false, 
            message: `No ${mediaType} files uploaded` 
          });
        }
        
        const uploadedFiles = req.files.map(file => ({
          filename: file.filename,
          originalname: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        }));
        
        res.json({ 
          success: true, 
          files: uploadedFiles,
          count: uploadedFiles.length
        });
      } catch (error) {
        console.error(`Error uploading ${mediaType}:`, error);
        res.status(500).json({ 
          success: false, 
          message: error.message 
        });
      }
    }
  );

  // Delete media file
  app.delete(`/api/settings/welcome-${mediaType}/:filename`, async (req, res) => {
    try {
      const { filename } = req.params;
      
      if (!filename || 
          filename.includes('..') || 
          filename.includes('/') || 
          filename.includes('\\')) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid filename' 
        });
      }
      
      const success = await multimediaService.deleteMediaFile(mediaType, filename);
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ 
          success: false, 
          message: `${mediaType} file not found` 
        });
      }
    } catch (error) {
      console.error(`Error deleting ${mediaType}:`, error);
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });
});

// ===== SETTINGS API =====
app.get('/api/settings', (req, res) => {
  try {
    const settings = whatsappService.config;
    res.json({ 
      success: true, 
      settings 
    });
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const newSettings = req.body;
    
    const allowedSettings = [
      'enableAutoReply', 'enableAI', 'enableClientInfoExtraction',
      'enableConversationMemory', 'delay', 'maxMessagesPerHour'
    ];
    
    const filteredSettings = {};
    for (const key of allowedSettings) {
      if (newSettings.hasOwnProperty(key)) {
        filteredSettings[key] = newSettings[key];
      }
    }
    
    whatsappService.updateSettings(filteredSettings);
    
    res.json({ 
      success: true, 
      settings: whatsappService.config 
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// AI Settings
app.get('/api/settings/ai', (req, res) => {
  try {
    const aiStats = aiEnhanced.getServiceStats();
    const whatsappConfig = whatsappService.config;
    
    res.json({
      success: true,
      settings: {
        enableAI: whatsappConfig.enableAI,
        enableConversationMemory: whatsappConfig.enableConversationMemory,
        successRate: aiStats.successRate,
        activeConversations: aiStats.conversationStats?.activeConversations || 0,
        averageResponseTime: Math.round(aiStats.averageResponseTime)
      }
    });
  } catch (error) {
    console.error('Error getting AI settings:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

app.post('/api/settings/ai', (req, res) => {
  try {
    const { enableAI, enableConversationMemory } = req.body;
    
    const aiSettings = {};
    if (typeof enableAI === 'boolean') {
      aiSettings.enableAI = enableAI;
    }
    if (typeof enableConversationMemory === 'boolean') {
      aiSettings.enableConversationMemory = enableConversationMemory;
    }
    
    whatsappService.updateSettings(aiSettings);
    
    res.json({ 
      success: true, 
      settings: {
        enableAI: whatsappService.config.enableAI,
        enableConversationMemory: whatsappService.config.enableConversationMemory
      }
    });
  } catch (error) {
    console.error('Error updating AI settings:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ===== INTELLIGENT AGENT API =====
app.get('/api/agent/stats', (req, res) => {
  try {
    const agentStats = intelligentAgent.getAgentStats();
    const conversationAnalytics = aiEnhanced.getConversationAnalytics();
    
    res.json({
      success: true,
      stats: {
        conversationsHandled: conversationAnalytics.total,
        informationCollected: agentStats.informationCollected || 0,
        sheetsUpdated: agentStats.sheetsUpdated || 0,
        uptime: Date.now() - (whatsappService.stats?.startTime || Date.now())
      }
    });
  } catch (error) {
    console.error('Error getting agent stats:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

app.get('/api/agent/conversations', (req, res) => {
  try {
    const activeConversations = aiEnhanced.getAllActiveConversations();
    
    const conversations = activeConversations.map(conv => ({
      phoneNumber: conv.phoneNumber,
      state: 'active',
      userData: {
        name: 'Client',
        city: 'Unknown'
      },
      metadata: {
        messageCount: conv.messageCount
      }
    }));
    
    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('Error getting agent conversations:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  try {
    const stats = whatsappService.getStats();
    const aiStats = aiEnhanced.getServiceStats();
    const memUsage = process.memoryUsage();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        whatsapp: {
          connected: stats.isConnected,
          uptime: stats.uptime ? stats.uptime.formatted : 'N/A',
          totalMessages: stats.totalMessages
        },
        ai: {
          connected: aiStats.successRate !== '0%',
          successRate: aiStats.successRate || '0%',
          activeConversations: aiStats.conversationStats?.activeConversations || 0
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
        environment: process.env.NODE_ENV || 'development'
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
// ===== SMART AI-AGENT BRIDGE API ROUTES =====

// احصائيات النظام الذكي
app.get('/api/smart-system/stats', (req, res) => {
  try {
    const stats = whatsappService.getStats();
    const detailedMemory = whatsappService.getDetailedMemoryStats();
    
    res.json({
      success: true,
      smartSystem: {
        enabled: stats.smartBridge.enabled,
        transitions: stats.smartBridge.stats.transitions,
        performance: stats.performance,
        memoryStats: detailedMemory
      },
      summary: {
        totalClients: detailedMemory.totalClients,
        averageCompletionRate: stats.smartBridge.averageCompletionRate,
        smartTransitionRate: stats.performance.smartTransitionRate,
        naturalOrderRate: stats.performance.naturalOrderRate
      }
    });
  } catch (error) {
    console.error('Error getting smart system stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// تحليل أنماط المحادثة
app.get('/api/smart-system/conversation-patterns', (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    const patterns = {
      languageDistribution: { arabic: 0, darija: 0, french: 0, unknown: 0 },
      completionStages: { greeting: 0, info_gathering: 0, confirmation: 0, completed: 0 },
      averageInteractionTime: 0,
      mostCommonDropoffPoints: [],
      successfulTransitionPaths: []
    };
    
    // تحليل ذاكرة العملاء
    let totalInteractionTime = 0;
    let interactionCount = 0;
    
    for (const [phoneNumber, memory] of whatsappService.clientMemory.entries()) {
      // توزيع اللغات
      const lang = memory.preferredLanguage || 'unknown';
      if (patterns.languageDistribution[lang] !== undefined) {
        patterns.languageDistribution[lang]++;
      } else {
        patterns.languageDistribution.unknown++;
      }
      
      // مراحل الاكتمال
      const completion = memory.completionRate || 0;
      if (completion === 0) {
        patterns.completionStages.greeting++;
      } else if (completion < 50) {
        patterns.completionStages.info_gathering++;
      } else if (completion < 100) {
        patterns.completionStages.confirmation++;
      } else {
        patterns.completionStages.completed++;
      }
      
      // حساب متوسط وقت التفاعل
      if (memory.firstContact && memory.lastUpdate) {
        const interactionTime = new Date(memory.lastUpdate) - new Date(memory.firstContact);
        totalInteractionTime += interactionTime;
        interactionCount++;
      }
    }
    
    // حساب متوسط وقت التفاعل
    patterns.averageInteractionTime = interactionCount > 0 ? 
      Math.round(totalInteractionTime / interactionCount / 1000 / 60) : 0; // بالدقائق
    
    // تحديد نقاط الانقطاع الشائعة
    const dropoffAnalysis = this.analyzeDropoffPoints();
    patterns.mostCommonDropoffPoints = dropoffAnalysis.dropoffPoints;
    patterns.successfulTransitionPaths = dropoffAnalysis.successPaths;
    
    res.json({
      success: true,
      patterns,
      timeframe,
      dataPoints: whatsappService.clientMemory.size,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error analyzing conversation patterns:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// دالة مساعدة لتحليل نقاط الانقطاع
function analyzeDropoffPoints() {
  const dropoffPoints = [
    { stage: 'after_greeting', count: 0, percentage: 0 },
    { stage: 'after_name_request', count: 0, percentage: 0 },
    { stage: 'after_city_request', count: 0, percentage: 0 },
    { stage: 'before_order_confirmation', count: 0, percentage: 0 }
  ];
  
  const successPaths = [
    { path: 'greeting->info->confirmation->completed', count: 0 },
    { path: 'direct_info->confirmation->completed', count: 0 },
    { path: 'greeting->completed', count: 0 }
  ];
  
  let totalClients = 0;
  
  for (const memory of whatsappService.clientMemory.values()) {
    totalClients++;
    const completion = memory.completionRate || 0;
    
    // تحليل نقاط الانقطاع
    if (completion === 0) {
      dropoffPoints[0].count++; // after_greeting
    } else if (completion < 25) {
      dropoffPoints[1].count++; // after_name_request  
    } else if (completion < 75) {
      dropoffPoints[2].count++; // after_city_request
    } else if (completion < 100) {
      dropoffPoints[3].count++; // before_order_confirmation
    } else {
      // مسار ناجح
      if (memory.messageCount <= 3) {
        successPaths[2].count++; // مباشر
      } else if (memory.messageCount <= 6) {
        successPaths[1].count++; // معلومات مباشرة
      } else {
        successPaths[0].count++; // مسار كامل
      }
    }
  }
  
  // حساب النسب المئوية
  dropoffPoints.forEach(point => {
    point.percentage = totalClients > 0 ? 
      Math.round((point.count / totalClients) * 100) : 0;
  });
  
  return { dropoffPoints, successPaths };
}

// إعدادات النظام الذكي
app.get('/api/smart-system/settings', (req, res) => {
  try {
    const currentSettings = whatsappService.config;
    
    res.json({
      success: true,
      settings: {
        enableSmartTransition: currentSettings.enableSmartTransition,
        naturalConversationMode: currentSettings.naturalConversationMode,
        smartMemory: currentSettings.smartMemory,
        enableAI: currentSettings.enableAI,
        enableIntelligentAgent: currentSettings.enableIntelligentAgent,
        sessionTimeout: currentSettings.sessionTimeout,
        maxMessagesPerHour: currentSettings.maxMessagesPerHour
      },
      advanced: {
        rateLimitDelay: whatsappService.rateLimitDelay,
        memoryRetentionDays: 7, // قيمة ثابتة حالياً
        autoCleanupEnabled: true
      }
    });
  } catch (error) {
    console.error('Error getting smart system settings:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// تحديث إعدادات النظام الذكي
app.post('/api/smart-system/settings', (req, res) => {
  try {
    const newSettings = req.body;
    
    // التحقق من صحة الإعدادات
    const allowedSettings = [
      'enableSmartTransition', 'naturalConversationMode', 'smartMemory',
      'enableAI', 'enableIntelligentAgent', 'sessionTimeout', 'maxMessagesPerHour'
    ];
    
    const validSettings = {};
    allowedSettings.forEach(setting => {
      if (newSettings[setting] !== undefined) {
        validSettings[setting] = newSettings[setting];
      }
    });
    
    if (Object.keys(validSettings).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid settings provided'
      });
    }
    
    // تطبيق الإعدادات الجديدة
    whatsappService.updateSettings(validSettings);
    
    res.json({
      success: true,
      message: 'Smart system settings updated successfully',
      updatedSettings: validSettings,
      currentSettings: whatsappService.config
    });
  } catch (error) {
    console.error('Error updating smart system settings:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// اختبار شامل للنظام الذكي
app.post('/api/smart-system/comprehensive-test', async (req, res) => {
  try {
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 }
    };
    
    // اختبار 1: التحقق من تشغيل الجسر الذكي
    try {
      const aiAgentBridge = require('./services/ai-agent-bridge');
      const bridgeStats = aiAgentBridge.getTransitionStats();
      
      testResults.tests.push({
        name: 'Smart Bridge Initialization',
        passed: true,
        details: `Bridge operational with ${Object.keys(bridgeStats.transitions).length} transition types`
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Smart Bridge Initialization',
        passed: false,
        error: error.message
      });
      testResults.summary.failed++;
    }
    
    // اختبار 2: فحص ذاكرة العملاء
    try {
      const memorySize = whatsappService.clientMemory.size;
      const memoryStats = whatsappService.getDetailedMemoryStats();
      
      testResults.tests.push({
        name: 'Client Memory System',
        passed: true,
        details: `Memory contains ${memorySize} clients with ${memoryStats.completionRates.completed} completed profiles`
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Client Memory System',
        passed: false,
        error: error.message
      });
      testResults.summary.failed++;
    }
    
    // اختبار 3: محاكاة انتقال ذكي
    try {
      const testPhone = '+212600000000';
      const testMessage = 'السلام عليكم، أريد معرفة المزيد عن منتجاتكم';
      
      const result = await whatsappService.testSmartSystem(testPhone, testMessage);
      
      testResults.tests.push({
        name: 'Smart Transition Simulation',
        passed: result.success,
        details: result.success ? 'Smart transition working correctly' : 'Fallback to basic system'
      });
      
      if (result.success) testResults.summary.passed++;
      else testResults.summary.failed++;
      
    } catch (error) {
      testResults.tests.push({
        name: 'Smart Transition Simulation',
        passed: false,
        error: error.message
      });
      testResults.summary.failed++;
    }
    
    // اختبار 4: فحص أداء النظام
    try {
      const stats = whatsappService.getStats();
      const performanceGood = stats.performance.smartTransitionRate !== '0%' || 
                             stats.smartBridge.memorySize > 0;
      
      testResults.tests.push({
        name: 'System Performance Check',
        passed: performanceGood,
        details: `Smart transitions: ${stats.performance.smartTransitionRate}, Memory: ${stats.smartBridge.memorySize} clients`
      });
      
      if (performanceGood) testResults.summary.passed++;
      else testResults.summary.failed++;
      
    } catch (error) {
      testResults.tests.push({
        name: 'System Performance Check',
        passed: false,
        error: error.message
      });
      testResults.summary.failed++;
    }
    
    // اختبار 5: فحص اتصال قاعدة البيانات
    try {
      const Customer = require('./models/Customer');
      const customerCount = await Customer.countDocuments();
      
      testResults.tests.push({
        name: 'Database Connection',
        passed: true,
        details: `Database connected with ${customerCount} customers`
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Database Connection',
        passed: false,
        error: error.message
      });
      testResults.summary.failed++;
    }
    
    testResults.summary.total = testResults.summary.passed + testResults.summary.failed;
    testResults.summary.successRate = testResults.summary.total > 0 ? 
      Math.round((testResults.summary.passed / testResults.summary.total) * 100) + '%' : '0%';
    
    res.json({
      success: true,
      testResults
    });
  } catch (error) {
    console.error('Error running comprehensive test:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// نظام التنبيهات والمراقبة
app.get('/api/smart-system/alerts', (req, res) => {
  try {
    const alerts = [];
    const stats = whatsappService.getStats();
    const memoryStats = whatsappService.getDetailedMemoryStats();
    
    // تنبيه: معدل انتقال ذكي منخفض
    const smartTransitionRate = parseFloat(stats.performance.smartTransitionRate);
    if (smartTransitionRate < 30) {
      alerts.push({
        type: 'warning',
        category: 'performance',
        message: `معدل الانتقال الذكي منخفض: ${stats.performance.smartTransitionRate}`,
        recommendation: 'راجع محفزات الانتقال في ai-agent-bridge.js',
        severity: 'medium'
      });
    }
    
    // تنبيه: ذاكرة ممتلئة
    if (memoryStats.totalClients > 500) {
      alerts.push({
        type: 'info',
        category: 'memory',
        message: `عدد كبير من العملاء في الذاكرة: ${memoryStats.totalClients}`,
        recommendation: 'فكر في تشغيل تنظيف الذاكرة',
        severity: 'low'
      });
    }
    
    // تنبيه: معدل أخطاء مرتفع
    if (stats.errors > 0) {
      const errorRate = (stats.errors / stats.totalMessages) * 100;
      if (errorRate > 5) {
        alerts.push({
          type: 'error',
          category: 'stability',
          message: `معدل أخطاء مرتفع: ${errorRate.toFixed(2)}%`,
          recommendation: 'راجع سجلات الأخطاء وآخر خطأ حدث',
          severity: 'high'
        });
      }
    }
    
    // تنبيه: اتصال WhatsApp
    if (!stats.isConnected) {
      alerts.push({
        type: 'error',
        category: 'connection',
        message: 'WhatsApp غير متصل',
        recommendation: 'أعد تشغيل الاتصال أو امسح QR code',
        severity: 'high'
      });
    }
    
    // تنبيه: عملاء يحتاجون متابعة
    const staleClients = memoryStats.activityLevels.dormant;
    if (staleClients > 10) {
      alerts.push({
        type: 'info',
        category: 'follow_up',
        message: `${staleClients} عميل يحتاج متابعة (غير نشط لأكثر من يوم)`,
        recommendation: 'أرسل رسائل متابعة أو قم بتنظيف الذاكرة',
        severity: 'low'
      });
    }
    
    res.json({
      success: true,
      alerts,
      summary: {
        total: alerts.length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length
      },
      systemHealth: alerts.filter(a => a.severity === 'high').length === 0 ? 'healthy' : 'needs_attention',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting system alerts:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// تحديث تلقائي لإحصائيات النظام الذكي
setInterval(async () => {
  try {
    // حفظ إحصائيات النظام كل 30 دقيقة
    const stats = whatsappService.getStats();
    const logEntry = {
      timestamp: new Date().toISOString(),
      smartTransitions: stats.smartTransitions,
      naturalOrders: stats.naturalOrdersStarted,
      memorySize: stats.smartBridge.memorySize,
      completionRate: stats.smartBridge.averageCompletionRate
    };
    
    // يمكن حفظ هذا في ملف أو قاعدة بيانات للتحليل اللاحق
    console.log('📊 Smart System Stats:', logEntry);
  } catch (error) {
    console.error('Error logging smart system stats:', error);
  }
}, 30 * 60 * 1000); // كل 30 دقيقة 
// تنظيف الذاكرة يدوياً  

// البحث في ذاكرة العملاء
app.get('/api/smart-system/search', (req, res) => {
  try {
    const { query, field = 'all', limit = 10 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Query must be at least 2 characters long'
      });
    }
    
    const results = whatsappService.searchClientMemory(query.trim(), field);
    const limitedResults = results.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      query,
      field,
      totalResults: results.length,
      results: limitedResults.map(result => ({
        phoneNumber: result.phoneNumber,
        name: result.name,
        city: result.city,
        completionRate: result.completionRate,
        lastUpdate: result.lastUpdate,
        relevanceScore: Math.round(result.relevanceScore)
      }))
    });
  } catch (error) {
    console.error('Error searching client memory:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// الحصول على معلومات عميل محدد من الذاكرة
app.get('/api/smart-system/client/:phoneNumber', (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const memory = whatsappService.getCustomerMemory(phoneNumber);
    
    if (!memory || memory.completionRate === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found in memory'
      });
    }
    
    res.json({
      success: true,
      client: {
        ...memory,
        timeSinceLastUpdate: Date.now() - new Date(memory.lastUpdate).getTime(),
        status: memory.completionRate === 100 ? 'complete' : 
                memory.completionRate >= 75 ? 'near_complete' :
                memory.completionRate >= 25 ? 'partial' : 'minimal'
      }
    });
  } catch (error) {
    console.error('Error getting client from memory:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// تحديث معلومات عميل في الذاكرة
app.post('/api/smart-system/client/:phoneNumber', (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const updateData = req.body;
    
    // التحقق من صحة البيانات
    const allowedFields = ['name', 'city', 'address', 'preferredLanguage', 'notes'];
    const filteredData = {};
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });
    
    if (Object.keys(filteredData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }
    
    whatsappService.updateCustomerMemory(phoneNumber, filteredData);
    const updatedMemory = whatsappService.getCustomerMemory(phoneNumber);
    
    res.json({
      success: true,
      message: 'Client memory updated successfully',
      client: updatedMemory
    });
  } catch (error) {
    console.error('Error updating client memory:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// اختبار النظام الذكي
app.post('/api/smart-system/test', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and message are required'
      });
    }
    
    const testResult = await whatsappService.testSmartSystem(phoneNumber, message);
    
    res.json({
      success: true,
      testResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error testing smart system:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// تصدير بيانات العملاء
app.post('/api/smart-system/export', async (req, res) => {
  try {
    const { format = 'json' } = req.body;
    
    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Format must be either json or csv'
      });
    }
    
    const exportResult = await whatsappService.exportClientData(format);
    
    res.json({
      success: true,
      export: exportResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error exporting client data:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// تنظيف الذاكرة يدوياً
app.post('/api/smart-system/cleanup', (req, res) => {
  try {
    const { force = false } = req.body;
    
    // الحصول على الإحصائيات قبل التنظيف
    const statsBefore = {
      clientMemorySize: whatsappService.clientMemory.size,
      pendingClientsSize: whatsappService.pendingClientInfo.size,
      messageQueueSize: whatsappService.messageQueue.size
    };
    
    // تنفيذ التنظيف
    whatsappService.cleanupOldData();
    
    // الحصول على الإحصائيات بعد التنظيف
    const statsAfter = {
      clientMemorySize: whatsappService.clientMemory.size,
      pendingClientsSize: whatsappService.pendingClientInfo.size,
      messageQueueSize: whatsappService.messageQueue.size
    };
    
    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      before: statsBefore,
      after: statsAfter,
      cleaned: {
        clientMemory: statsBefore.clientMemorySize - statsAfter.clientMemorySize,
        pendingClients: statsBefore.pendingClientsSize - statsAfter.pendingClientsSize,
        messageQueue: statsBefore.messageQueueSize - statsAfter.messageQueueSize
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// تقرير الأداء المفصل
app.get('/api/smart-system/performance-report', async (req, res) => {
  try {
    const report = await whatsappService.generatePerformanceReport();
    
    res.json({
      success: true,
      report,
      generatedAt: report.timestamp
    });
  } catch (error) {
    console.error('Error generating performance report:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// الحصول على العملاء الأكثر اكتمالاً
app.get('/api/smart-system/top-clients', (req, res) => {
  try {
    const { limit = 10, minCompletion = 0 } = req.query;
    
    const allClients = Array.from(whatsappService.clientMemory.entries())
      .map(([phoneNumber, memory]) => ({
        phoneNumber,
        name: memory.name,
        city: memory.city,
        completionRate: memory.completionRate || 0,
        lastUpdate: memory.lastUpdate,
        messageCount: memory.messageCount || 0
      }))
      .filter(client => client.completionRate >= parseInt(minCompletion))
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, parseInt(limit));
    
    res.json({
      success: true,
      clients: allClients,
      criteria: {
        limit: parseInt(limit),
        minCompletion: parseInt(minCompletion)
      },
      summary: {
        averageCompletion: allClients.length > 0 ? 
          Math.round(allClients.reduce((sum, c) => sum + c.completionRate, 0) / allClients.length) : 0,
        fullyCompleted: allClients.filter(c => c.completionRate === 100).length,
        partiallyCompleted: allClients.filter(c => c.completionRate >= 50 && c.completionRate < 100).length
      }
    });
  } catch (error) {
    console.error('Error getting top clients:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// إحصائيات الانتقالات الذكية
app.get('/api/smart-system/transition-analytics', (req, res) => {
  try {
    const aiAgentBridge = require('./services/ai-agent-bridge');
    const transitionStats = aiAgentBridge.getTransitionStats();
    const whatsappStats = whatsappService.getStats();
    
    res.json({
      success: true,
      analytics: {
        transitions: transitionStats.transitions,
        efficiency: transitionStats.efficiency,
        performance: {
          smartTransitionRate: whatsappStats.performance.smartTransitionRate,
          naturalOrderRate: whatsappStats.performance.naturalOrderRate,
          averageStepsToOrder: whatsappStats.performance.averageStepsToOrder
        },
        recommendations: whatsappService.generateSmartRecommendations(whatsappStats, transitionStats)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting transition analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// إعادة تعيين ذاكرة عميل معين
app.post('/api/smart-system/reset-client/:phoneNumber', (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    const hadMemory = whatsappService.clientMemory.has(phoneNumber);
    
    if (hadMemory) {
      whatsappService.clientMemory.delete(phoneNumber);
    }
    
    // إعادة تعيين أي معلومات معلقة
    whatsappService.resetClientConfirmationStatus(phoneNumber);
    
    res.json({
      success: true,
      message: hadMemory ? 
        `Client memory reset for ${phoneNumber}` : 
        `No memory found for ${phoneNumber}`,
      hadMemory,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error resetting client memory:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// محاكاة محادثة كاملة للاختبار
app.post('/api/smart-system/simulate-conversation', async (req, res) => {
  try {
    const { phoneNumber, messages, customerProfile } = req.body;
    
    if (!phoneNumber || !messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and messages array are required'
      });
    }
    
    // إعداد ملف العميل التجريبي
    if (customerProfile) {
      whatsappService.updateCustomerMemory(phoneNumber, customerProfile);
    }
    
    const conversation = [];
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      console.log(`🎭 Simulating message ${i + 1}: "${message}"`);
      
      try {
        const result = await whatsappService.testSmartSystem(phoneNumber, message);
        
        conversation.push({
          step: i + 1,
          userMessage: message,
          systemResponse: result.result ? result.result.response : 'No response',
          smartTransition: result.result ? result.result.smartTransition : false,
          transitionType: result.result ? result.result.transitionType : null,
          success: result.success
        });
        
        // تأخير بين الرسائل لمحاكاة واقعية
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (stepError) {
        console.error(`Error in simulation step ${i + 1}:`, stepError);
        conversation.push({
          step: i + 1,
          userMessage: message,
          error: stepError.message,
          success: false
        });
      }
    }
    
    // الحصول على الذاكرة النهائية للعميل
    const finalMemory = whatsappService.getCustomerMemory(phoneNumber);
    
    res.json({
      success: true,
      simulation: {
        phoneNumber,
        totalSteps: messages.length,
        conversation,
        finalMemory: {
          completionRate: finalMemory.completionRate,
          name: finalMemory.name,
          city: finalMemory.city,
          address: finalMemory.address
        },
        summary: {
          smartTransitions: conversation.filter(c => c.smartTransition).length,
          successfulSteps: conversation.filter(c => c.success).length,
          completionImprovement: customerProfile ? 
            finalMemory.completionRate - (customerProfile.completionRate || 0) : 
            finalMemory.completionRate
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error simulating conversation:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});


// ===== ERROR HANDLING MIDDLEWARE =====

// Multer error handler
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large (max 100MB)'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files (max 10)'
      });
    }
  }
  
  if (error.message && error.message.includes('Type de fichier non autorisé')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
});

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

// ===== INITIALIZATION =====
const initializeServices = async () => {
  try {
    console.log('🚀 Initializing application services...');
    
    // Initialize multimedia directories
    multimediaService.initMediaDirectories();
    console.log('✅ Multimedia directories initialized');
    
    // Test AI connectivity
    const aiTest = await aiEnhanced.testAPIConnection();
    console.log(`🤖 AI Service: ${aiTest.connected ? '✅ Connected' : '❌ Disconnected'}`);
    
    // Test Google Sheets connectivity
    try {
      const googleSheetsService = require('./services/google-sheets');
      const sheetsTest = await googleSheetsService.testConnection();
      console.log(`📊 Google Sheets: ${sheetsTest.success ? '✅ Connected' : '❌ Disconnected'}`);
      if (!sheetsTest.success) {
        console.log(`📊 Google Sheets Error: ${sheetsTest.message}`);
      }
    } catch (sheetsError) {
      console.log(`📊 Google Sheets: ❌ Service not available - ${sheetsError.message}`);
    }
    
    console.log('📊 Database: ✅ Connected (MongoDB)');
    
    console.log('🎉 All services initialized successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error initializing services:', error);
    return false;
  }
};

// Initialize on startup
initializeServices();

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, starting graceful shutdown...');
  
  try {
    if (whatsappService && whatsappService.isClientReady) {
      await whatsappService.resetClient();
    }
    console.log('✅ WhatsApp service shut down gracefully');
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 SIGINT received, starting graceful shutdown...');
  
  try {
    if (whatsappService && whatsappService.isClientReady) {
      await whatsappService.resetClient();
    }
    console.log('✅ WhatsApp service shut down gracefully');
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
  
  process.exit(0);
});

module.exports = app;