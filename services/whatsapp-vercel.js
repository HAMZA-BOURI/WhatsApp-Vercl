// services/whatsapp-vercel.js - Optimized for Vercel serverless deployment
const fs = require('fs');
const path = require('path');
const Customer = require('../models/Customer');
const aiService = require('./ai-enhanced');

/**
 * Version of WhatsApp service optimized for Vercel serverless environment
 * This version does not attempt to connect to WhatsApp directly as
 * serverless functions cannot maintain long-running connections
 */
class WhatsAppVercelService {
  constructor() {
    this.isReady = false;
    this.config = {
      enableAutoReply: true,
      enableSmartTransition: true,
      enableAI: true,
      enableIntelligentAgent: true,
      enableClientInfoExtraction: true,
      enableGoogleSheets: true,
      naturalConversationMode: true,
      smartMemory: true
    };

    // Statistics for API responses
    this.stats = {
      startTime: new Date(),
      totalMessages: 0,
      aiResponses: 0,
      clientsHelped: 0,
      errors: 0,
      lastError: null
    };

    // Welcome message
    this.welcomeMessage = `🌟 أهلاً وسهلاً بك!

مرحباً بك في عالم المنتجات الطبيعية عالية الجودة ✨
🌿 منتجات طبيعية 100%
🚚 توصيل سريع وآمن
💎 جودة مضمونة

كيف يمكنني مساعدتك اليوم؟`;

    this.loadWelcomeMessage();
  }

  // Load welcome message
  loadWelcomeMessage() {
    try {
      const configPath = path.join(__dirname, '../config/welcome-message.json');
      if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (data.message) {
          this.welcomeMessage = data.message;
        }
      }
    } catch (error) {
      console.error('Error loading welcome message:', error);
    }
  }

  // Update welcome message
  updateWelcomeMessage(message) {
    if (!message) return false;
    
    try {
      this.welcomeMessage = message;
      const configPath = path.join(__dirname, '../config');
      if (!fs.existsSync(configPath)) {
        fs.mkdirSync(configPath, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(configPath, 'welcome-message.json'),
        JSON.stringify({ message }, null, 2)
      );
      return true;
    } catch (error) {
      console.error('Error updating welcome message:', error);
      return false;
    }
  }

  // Update settings
  updateSettings(newSettings) {
    this.config = { ...this.config, ...newSettings };
    console.log('🔧 Settings updated:', this.config);
  }

  // For API compatibility - not actually connecting to WhatsApp in serverless mode
  async initializeClient() {
    console.log('⚠️ WhatsApp client initialization skipped in Vercel serverless environment');
    return null;
  }

  // Process message with AI
  async processMessageWithAI(message, phoneNumber) {
    try {
      this.stats.totalMessages++;
      
      // Get or create customer
      let customer = await Customer.findOne({ phoneNumber });
      if (!customer) {
        customer = new Customer({
          phoneNumber,
          name: 'New Customer',
          firstContactDate: new Date(),
          messageCount: 1
        });
        await customer.save();
        this.stats.clientsHelped++;
      } else {
        customer.lastContactDate = new Date();
        customer.messageCount += 1;
        await customer.save();
      }

      // Use AI service to generate response
      const customerInfo = {
        name: customer.name,
        phoneNumber: customer.phoneNumber,
        messageCount: customer.messageCount,
        isNew: customer.messageCount <= 1
      };

      const aiResponse = await aiService.analyzeMessageWithAI(message, customerInfo);
      this.stats.aiResponses++;
      
      return {
        success: true,
        message: aiResponse.response,
        analysis: aiResponse.analysis
      };
    } catch (error) {
      console.error('Error processing message with AI:', error);
      this.stats.errors++;
      this.stats.lastError = { message: error.message, timestamp: new Date() };
      
      return {
        success: false,
        message: 'Sorry, there was an error processing your message.',
        error: error.message
      };
    }
  }

  // Get stats
  getStats() {
    const uptime = Date.now() - this.stats.startTime.getTime();
    
    return {
      ...this.stats,
      uptime: {
        milliseconds: uptime,
        formatted: this.formatUptime(uptime)
      },
      isConnected: false, // Always false in serverless
      qrCodeAvailable: false,
      config: this.config,
      environment: 'vercel-serverless'
    };
  }

  // Format uptime
  formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} days`;
    if (hours > 0) return `${hours} hours`;
    if (minutes > 0) return `${minutes} minutes`;
    return `${seconds} seconds`;
  }

  // For API compatibility
  get isClientReady() {
    return false; // Always false in serverless
  }

  get qrCodeData() {
    return null; // Always null in serverless
  }
}

module.exports = new WhatsAppVercelService();