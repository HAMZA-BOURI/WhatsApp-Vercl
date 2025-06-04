// routes/conversation-test.js - API لاختبار المحادثات مع الذاكرة
const express = require('express');
const router = express.Router();
const aiEnhanced = require('../services/ai-enhanced');

// اختبار محادثة جديدة
router.post('/test-conversation', async (req, res) => {
  try {
    const { phoneNumber, message, customerInfo } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and message are required'
      });
    }

    // معلومات العميل الافتراضية
    const defaultCustomerInfo = {
      name: 'عميل تجريبي',
      phoneNumber: phoneNumber,
      messageCount: 1,
      isNew: true,
      ...customerInfo
    };

    // تحليل الرسالة مع الذكاء الاصطناعي
    const result = await aiEnhanced.analyzeMessageWithAI(
      message,
      defaultCustomerInfo
    );

    // الحصول على معلومات المحادثة بعد الإضافة
    const conversationInfo = aiEnhanced.getConversationInfo(phoneNumber);

    res.json({
      success: true,
      result: {
        response: result.response,
        aiGenerated: result.aiGenerated,
        language: result.analysis?.language || 'unknown',
        intents: result.analysis?.intent || {},
        conversationLength: result.conversationLength || 1,
        contextual: result.conversationLength > 1,
        productUsed: result.productUsed?.title || 'Default'
      },
      conversationInfo: conversationInfo ? {
        messageCount: conversationInfo.messageCount,
        duration: conversationInfo.duration,
        isActive: conversationInfo.isActive
      } : null
    });

  } catch (error) {
    console.error('Error in conversation test:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// اختبار محادثة متعددة الرسائل
router.post('/test-multi-message', async (req, res) => {
  try {
    const { phoneNumber, messages, customerInfo } = req.body;
    
    if (!phoneNumber || !messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and messages array are required'
      });
    }

    const results = [];
    const defaultCustomerInfo = {
      name: 'عميل تجريبي متعدد',
      phoneNumber: phoneNumber,
      messageCount: 1,
      isNew: true,
      ...customerInfo
    };

    // معالجة كل رسالة بالتتابع
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      // تحديث معلومات العميل
      const currentCustomerInfo = {
        ...defaultCustomerInfo,
        messageCount: i + 1,
        isNew: i === 0
      };

      const result = await aiEnhanced.analyzeMessageWithAI(
        message,
        currentCustomerInfo
      );

      results.push({
        messageIndex: i + 1,
        userMessage: message,
        aiResponse: result.response,
        aiGenerated: result.aiGenerated,
        conversationLength: result.conversationLength || 1,
        contextual: result.conversationLength > 1,
        language: result.analysis?.language || 'unknown',
        productUsed: result.productUsed?.title || 'Default'
      });

      // تأخير قصير بين الرسائل لمحاكاة محادثة حقيقية
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // الحصول على معلومات المحادثة النهائية
    const finalConversationInfo = aiEnhanced.getConversationInfo(phoneNumber);

    res.json({
      success: true,
      phoneNumber,
      totalMessages: messages.length,
      results,
      conversationSummary: finalConversationInfo ? {
        totalMessages: finalConversationInfo.messageCount,
        duration: finalConversationInfo.duration,
        startTime: finalConversationInfo.startTime,
        lastUpdate: finalConversationInfo.lastUpdate,
        isActive: finalConversationInfo.isActive
      } : null
    });

  } catch (error) {
    console.error('Error in multi-message test:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// الحصول على معلومات محادثة
router.get('/conversation/:phoneNumber', (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const conversationInfo = aiEnhanced.getConversationInfo(phoneNumber);
    
    if (!conversationInfo) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      conversation: conversationInfo
    });

  } catch (error) {
    console.error('Error getting conversation info:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// الحصول على جميع المحادثات النشطة
router.get('/active-conversations', (req, res) => {
  try {
    const activeConversations = aiEnhanced.getAllActiveConversations();
    const analytics = aiEnhanced.getConversationAnalytics();

    res.json({
      success: true,
      activeConversations,
      analytics,
      summary: {
        total: activeConversations.length,
        recent: activeConversations.filter(conv => conv.isRecent).length,
        averageMessageCount: analytics.averageLength
      }
    });

  } catch (error) {
    console.error('Error getting active conversations:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// إعادة تعيين محادثة
router.post('/reset-conversation/:phoneNumber', (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const result = aiEnhanced.resetConversation(phoneNumber);
    
    res.json({
      success: true,
      reset: result,
      message: result ? 'Conversation reset successfully' : 'Conversation not found or already inactive'
    });

  } catch (error) {
    console.error('Error resetting conversation:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// تنظيف المحادثات القديمة
router.post('/cleanup-conversations', (req, res) => {
  try {
    const { olderThanHours = 2 } = req.body; // افتراضي: أقدم من ساعتين
    
    // إجراء التنظيف
    aiEnhanced.cleanupOldConversations();
    
    // الحصول على الإحصائيات بعد التنظيف
    const analytics = aiEnhanced.getConversationAnalytics();
    
    res.json({
      success: true,
      message: 'Cleanup completed',
      remaining: {
        total: analytics.total,
        active: analytics.active,
        idle: analytics.idle
      }
    });

  } catch (error) {
    console.error('Error cleaning up conversations:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// إحصائيات المحادثات
router.get('/analytics', (req, res) => {
  try {
    const analytics = aiEnhanced.getConversationAnalytics();
    const serviceStats = aiEnhanced.getServiceStats();

    res.json({
      success: true,
      conversationAnalytics: analytics,
      serviceStats: {
        totalRequests: serviceStats.totalRequests,
        successRate: serviceStats.successRate,
        averageResponseTime: serviceStats.averageResponseTime,
        cacheStatus: serviceStats.cacheStatus
      },
      insights: {
        mostActiveHour: analytics.byHour.indexOf(Math.max(...analytics.byHour)),
        engagementRate: analytics.total > 0 ? 
          ((analytics.longConversations / analytics.total) * 100).toFixed(2) + '%' : '0%',
        averageSessionDuration: 'N/A' // يمكن حسابها من بيانات الجلسات
      }
    });

  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// اختبار سيناريو محادثة كاملة
router.post('/test-scenario', async (req, res) => {
  try {
    const { scenario, phoneNumber } = req.body;
    
    if (!scenario || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Scenario and phone number are required'
      });
    }

    // سيناريوهات محددة مسبقاً
    const scenarios = {
      'customer_inquiry': [
        'السلام عليكم',
        'بغيت نعرف على المنتجات ديالكم',
        'شحال الثمن؟',
        'واش كاين توصيل؟',
        'بغيت نشري واحد'
      ],
      'price_negotiation': [
        'أهلا',
        'عندكم منتجات للبشرة؟',
        'الثمن غالي شويا',
        'واش ممكن تخفيض؟',
        'طيب غادي نشري'
      ],
      'support_request': [
        'مرحبا',
        'عندي مشكل مع المنتج',
        'ما خدمش معايا',
        'كيفاش نرجعو؟',
        'شكرا على المساعدة'
      ]
    };

    const selectedScenario = scenarios[scenario];
    if (!selectedScenario) {
      return res.status(400).json({
        success: false,
        message: 'Unknown scenario. Available: ' + Object.keys(scenarios).join(', ')
      });
    }

    // تشغيل السيناريو
    const results = [];
    const customerInfo = {
      name: `عميل تجريبي - ${scenario}`,
      phoneNumber: phoneNumber,
      messageCount: 1,
      isNew: true
    };

    for (let i = 0; i < selectedScenario.length; i++) {
      const message = selectedScenario[i];
      
      const result = await aiEnhanced.analyzeMessageWithAI(message, {
        ...customerInfo,
        messageCount: i + 1,
        isNew: i === 0
      });

      results.push({
        step: i + 1,
        userMessage: message,
        aiResponse: result.response,
        aiGenerated: result.aiGenerated,
        contextual: result.conversationLength > 1,
        conversationLength: result.conversationLength
      });

      // تأخير بين الرسائل
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    res.json({
      success: true,
      scenario,
      phoneNumber,
      results,
      summary: {
        totalSteps: selectedScenario.length,
        aiResponses: results.filter(r => r.aiGenerated).length,
        contextualResponses: results.filter(r => r.contextual).length
      }
    });

  } catch (error) {
    console.error('Error running scenario test:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;