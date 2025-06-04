// services/ai.js - Fixed compatibility layer for backward compatibility
const aiEnhanced = require('./ai-enhanced');
const AIContext = require('../models/AIContext');

// Safe binding function that checks if method exists
const safeBind = (obj, methodName) => {
  if (obj && typeof obj[methodName] === 'function') {
    return obj[methodName].bind(obj);
  }
  // Return a placeholder function if method doesn't exist
  return async (...args) => {
    console.warn(`Method ${methodName} not found in ai-enhanced service`);
    return null;
  };
};

// Load AI Context function (since it's missing from ai-enhanced)
const loadAIContext = async (forceRefresh = false) => {
  try {
    const context = await AIContext.findOne({ active: true }).sort({ updatedAt: -1 });
    return context ? context.content : null;
  } catch (error) {
    console.error('Error loading AI context:', error);
    return null;
  }
};

// Update AI Context function
const updateAIContext = async (contextData) => {
  try {
    if (typeof contextData === 'string') {
      // If it's just content string
      let context = await AIContext.findOne({ active: true });
      if (context) {
        context.content = contextData;
        await context.save();
      } else {
        context = new AIContext({
          content: contextData,
          name: 'Product Information'
        });
        await context.save();
      }
      return context;
    } else if (typeof contextData === 'object') {
      // If it's an object with content and name
      let context = await AIContext.findOne({ active: true });
      if (context) {
        context.content = contextData.content || context.content;
        context.name = contextData.name || context.name;
        await context.save();
      } else {
        context = new AIContext({
          content: contextData.content || '',
          name: contextData.name || 'Product Information'
        });
        await context.save();
      }
      return context;
    }
    return null;
  } catch (error) {
    console.error('Error updating AI context:', error);
    return null;
  }
};

// Re-export all functions from ai-enhanced for backward compatibility
module.exports = {
  // Main AI function
  analyzeMessageWithAI: safeBind(aiEnhanced, 'analyzeMessageWithAI'),
  
  // Product information functions
  loadProductsInfo: safeBind(aiEnhanced, 'loadProductsInfo'),
  updateProductsInfo: async (newInfo) => {
    try {
      // Force refresh the cache
      return await aiEnhanced.loadProductsInfo(true);
    } catch (error) {
      console.error('Error updating products info:', error);
      return null;
    }
  },
  
  // Context management - using our custom functions
  getAIContext: loadAIContext,
  loadAIContext: loadAIContext,
  updateAIContext: updateAIContext,
  
  // Statistics and utilities
  getServiceStats: safeBind(aiEnhanced, 'getServiceStats'),
  clearCache: safeBind(aiEnhanced, 'clearCache'),
  testAPIConnection: safeBind(aiEnhanced, 'testAPIConnection'),
  
  // Language detection (if needed separately)
  detectLanguage: safeBind(aiEnhanced, 'detectLanguage'),
  
  // Conversation management (new methods from ai-enhanced)
  getConversationHistory: safeBind(aiEnhanced, 'getConversationHistory'),
  getConversationInfo: safeBind(aiEnhanced, 'getConversationInfo'),
  getAllActiveConversations: safeBind(aiEnhanced, 'getAllActiveConversations'),
  resetConversation: safeBind(aiEnhanced, 'resetConversation'),
  getConversationAnalytics: safeBind(aiEnhanced, 'getConversationAnalytics'),
  cleanupOldConversations: safeBind(aiEnhanced, 'cleanupOldConversations'),
  isNewConversation: safeBind(aiEnhanced, 'isNewConversation'),
  
  // Evaluation function (placeholder)
  evaluateResponse: async (messageId, customerFeedback) => {
    try {
      console.log(`Response evaluation for ${messageId}: ${customerFeedback}`);
      return true;
    } catch (error) {
      console.error('Error evaluating response:', error);
      return false;
    }
  },
  
  // Message preprocessing (enhanced implementation)
  preprocessMessage: (message) => {
    try {
      const language = aiEnhanced.detectLanguage ? 
        aiEnhanced.detectLanguage(message) : 'darija';
      
      return {
        language,
        original: message,
        intent: {}, // Basic implementation
        length: message.length,
        wordCount: message.split(/\s+/).length,
        hasArabic: /[\u0600-\u06FF]/.test(message),
        hasFrench: /[éèêëàâäôöùûüÿçîï]/i.test(message)
      };
    } catch (error) {
      console.error('Error preprocessing message:', error);
      return {
        language: 'darija',
        original: message,
        intent: {}
      };
    }
  },

  // Additional utility functions
  formatResponse: (response, customerInfo) => {
    try {
      if (!response) return '';
      
      // Add customer name if available
      const customerName = customerInfo?.name;
      if (customerName && !response.includes(customerName)) {
        // Simple name injection for personalization
        if (response.includes('!')) {
          response = response.replace('!', ` ${customerName}!`);
        }
      }
      
      return response.trim();
    } catch (error) {
      console.error('Error formatting response:', error);
      return response || '';
    }
  },

  // Health check for AI service
  healthCheck: async () => {
    try {
      const stats = await aiEnhanced.getServiceStats();
      const testConnection = await aiEnhanced.testAPIConnection();
      
      return {
        status: testConnection.connected ? 'healthy' : 'unhealthy',
        stats,
        lastTest: testConnection.timestamp,
        error: testConnection.error || null
      };
    } catch (error) {
      console.error('AI service health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  },

  // Batch process messages (for testing)
  batchProcessMessages: async (messages, customerInfo) => {
    try {
      const results = [];
      
      for (const message of messages) {
        const result = await aiEnhanced.analyzeMessageWithAI(message, customerInfo);
        results.push({
          input: message,
          output: result.response,
          aiGenerated: result.aiGenerated,
          language: result.analysis?.language,
          processingTime: result.processingTime
        });
        
        // Small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return {
        success: true,
        results,
        summary: {
          total: results.length,
          aiGenerated: results.filter(r => r.aiGenerated).length,
          averageProcessingTime: results.reduce((acc, r) => acc + (r.processingTime || 0), 0) / results.length
        }
      };
    } catch (error) {
      console.error('Error in batch processing:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// Initialize and verify the service on startup
(async () => {
  try {
    console.log('🤖 Initializing AI service compatibility layer...');
    
    // Test if ai-enhanced service is working
    if (aiEnhanced && typeof aiEnhanced.getServiceStats === 'function') {
      const stats = aiEnhanced.getServiceStats();
      console.log('✅ AI Enhanced service loaded successfully');
      console.log(`📊 AI Stats: ${stats.successRate || '0%'} success rate, ${stats.totalRequests || 0} total requests`);
    } else {
      console.warn('⚠️  AI Enhanced service not fully available');
    }
    
    // Test AI context loading
    const context = await loadAIContext();
    if (context) {
      console.log('✅ AI Context loaded successfully');
    } else {
      console.log('ℹ️  No AI context found (this is normal for first run)');
    }
    
    console.log('🎉 AI service compatibility layer initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing AI service compatibility layer:', error);
  }
})();