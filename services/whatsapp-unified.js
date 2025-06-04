// services/whatsapp-unified.js - Enhanced with Smart AI-Agent Bridge
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const Customer = require('../models/Customer');
const multimediaService = require('./multimedia');
const aiAgentBridge = require('./ai-agent-bridge'); // الجسر الذكي الجديد

class WhatsAppUnifiedService {
  constructor() {
    this.client = null;
    this.qrCode = null;
    this.isReady = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    
    // Configuration محسنة
    this.config = {
      enableAutoReply: true,
      enableSmartTransition: true, // تفعيل الانتقال الذكي
      enableAI: true,
      enableIntelligentAgent: true,
      enableClientInfoExtraction: true,
      enableGoogleSheets: true,
      delay: 2,
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 ساعة
      maxMessagesPerHour: 100,
      naturalConversationMode: true, // وضع المحادثة الطبيعية
      smartMemory: true // ذاكرة ذكية للمعلومات
    };

    // Message queue لتجنب الرسائل المتكررة
    this.messageQueue = new Map();
    this.rateLimitDelay = 2000; // ثانيتين بين الرسائل

    // إحصائيات محسنة مع إحصائيات الانتقال الذكي
    this.stats = {
      startTime: new Date(),
      totalMessages: 0,
      aiResponses: 0,
      agentResponses: 0,
      smartTransitions: 0, // جديد
      naturalOrdersStarted: 0, // جديد
      ordersCompleted: 0,
      sheetsUpdated: 0,
      fallbackResponses: 0,
      clientsHelped: 0,
      averageResponseTime: 0,
      averageStepsToOrder: 0, // جديد
      errors: 0,
      lastError: null
    };

    // معلومات الطلبات المعلقة مع ذاكرة ذكية
    this.pendingClientInfo = new Map();
    this.clientMemory = new Map(); // ذاكرة معلومات العملاء

    // رسالة الترحيب
    this.welcomeMessage = `🌟 أهلاً وسهلاً بك!

مرحباً بك في عالم المنتجات الطبيعية عالية الجودة ✨
🌿 منتجات طبيعية 100%
🚚 توصيل سريع وآمن
💎 جودة مضمونة

كيف يمكنني مساعدتك اليوم؟`;

    this.loadWelcomeMessage();
  }

  // تحميل رسالة الترحيب
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

  // تحديث رسالة الترحيب
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

  // تحديث الإعدادات
  updateSettings(newSettings) {
    this.config = { ...this.config, ...newSettings };
    console.log('🔧 Settings updated:', this.config);
  }

  // إنشاء العميل
  async initializeClient() {
    try {
      console.log('🚀 Initializing Enhanced WhatsApp Client with Smart AI Bridge...');
      
      this.client = new Client({
        authStrategy: new LocalAuth({ 
          dataPath: path.join(__dirname, '../.wwebjs_auth'),
          clientId: 'whatsapp-smart-agent'
        }),
        puppeteer: {
          headless: process.env.NODE_ENV === 'production',
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-dev-shm-usage',
            '--window-size=1280,800',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ],
          timeout: 120000
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      });

      this.setupEventHandlers();
      await this.client.initialize();
      
      return this.client;
    } catch (error) {
      console.error('❌ Error initializing WhatsApp client:', error);
      this.stats.errors++;
      this.stats.lastError = { message: error.message, timestamp: new Date() };
      throw error;
    }
  }

  // إعداد مستمعي الأحداث
  setupEventHandlers() {
    // QR Code
    this.client.on('qr', (qr) => {
      console.log('📱 QR Code generated:');
      qrcode.generate(qr, { small: true });
      this.qrCode = qr;
    });

    // جاهز
    this.client.on('ready', () => {
      console.log('✅ WhatsApp Smart Agent is ready!');
      this.isReady = true;
      this.qrCode = null;
      this.reconnectAttempts = 0;
      
      // اختبار الجسر الذكي
      this.testSmartBridge();
    });

    // مصادقة
    this.client.on('authenticated', () => {
      console.log('🔐 WhatsApp client authenticated successfully');
    });

    // فشل المصادقة
    this.client.on('auth_failure', (msg) => {
      console.error('❌ Authentication failure:', msg);
      this.qrCode = null;
      this.isReady = false;
    });

    // انقطاع الاتصال
    this.client.on('disconnected', async (reason) => {
      console.log('🔌 WhatsApp client disconnected:', reason);
      this.isReady = false;
      this.qrCode = null;
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        setTimeout(() => this.initializeClient(), 5000 * this.reconnectAttempts);
      }
    });

    // معالج الرسائل مع الجسر الذكي
    this.client.on('message', async (message) => {
      await this.handleIncomingMessageWithSmartBridge(message);
    });
  }

  // معالج الرسائل المحسن مع الجسر الذكي
  async handleIncomingMessageWithSmartBridge(message) {
    const startTime = Date.now();
    
    try {
      if (!this.shouldProcessMessage(message)) {
        return;
      }

      const phoneNumber = message.from.split('@')[0];
      this.stats.totalMessages++;

      // فحص Rate Limiting
      if (!this.checkMessageLimits(phoneNumber)) {
        console.log(`⚠️ Rate limited for ${phoneNumber}`);
        return;
      }

      console.log(`📨 Processing message from ${phoneNumber}: "${message.body}"`);

      // إظهار مؤشر الكتابة
      await this.showTypingIndicator(message);

      // إدارة العميل وتحديث الذاكرة
      const customer = await this.manageCustomerWithMemory(phoneNumber, message);

      // الحصول على معلومات العميل من الذاكرة
      const customerInfo = this.getCustomerMemory(phoneNumber);

      // استخدام الجسر الذكي لمعالجة الرسالة
      if (this.config.enableSmartTransition) {
        console.log(`🧠 Using Smart AI-Agent Bridge for ${phoneNumber}`);
        
        const bridgeResult = await aiAgentBridge.processMessage(
          phoneNumber, 
          message.body, 
          this.client, 
          customerInfo
        );
        
        if (bridgeResult) {
          // إرسال الرد
          await this.client.sendMessage(message.from, bridgeResult.response);
          
          // تحديث الإحصائيات
          if (bridgeResult.smartTransition) {
            this.stats.smartTransitions++;
          }
          
          if (bridgeResult.transitionType === 'product_interest') {
            this.stats.naturalOrdersStarted++;
          }
          
          if (bridgeResult.aiGenerated) {
            this.stats.aiResponses++;
          } else {
            this.stats.agentResponses++;
          }
          
          // حفظ المعلومات المستخرجة في الذاكرة
          if (bridgeResult.extractedInfo) {
            this.updateCustomerMemory(phoneNumber, bridgeResult.extractedInfo);
          }
          
          const responseTime = Date.now() - startTime;
          this.updateResponseTimeStats(responseTime);
          
          console.log(`✅ Smart bridge processed message for ${phoneNumber} in ${responseTime}ms`);
          console.log(`🎯 Transition type: ${bridgeResult.transitionType || 'none'}`);
          
          return;
        }
      }

      // Fallback إذا لم يعمل الجسر الذكي
      await this.handleMessageFallback(message, customer, phoneNumber);
      
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);
      
    } catch (error) {
      console.error('❌ Error handling message with smart bridge:', error);
      this.stats.errors++;
      this.stats.lastError = { message: error.message, timestamp: new Date() };
      
      await this.sendErrorMessage(message.from);
    }
  }

  // إدارة العميل مع الذاكرة الذكية
  async manageCustomerWithMemory(phoneNumber, message) {
    try {
      let customer = await Customer.findOne({ phoneNumber });

      if (!customer) {
        const notifyName = message._data?.notifyName || message.pushname || 'عميل جديد';
        
        customer = new Customer({
          phoneNumber,
          name: notifyName,
          firstContactDate: new Date(),
          receivedWelcomeMessage: false,
          messageCount: 1
        });

        await customer.save();
        this.stats.clientsHelped++;

        // إنشاء ذاكرة للعميل الجديد
        this.initializeCustomerMemory(phoneNumber, {
          name: notifyName,
          phoneNumber: phoneNumber,
          isNew: true,
          firstContact: new Date()
        });

        // إرسال رسالة الترحيب للعملاء الجدد
        await this.sendWelcomeMessage(message.from);
        customer.receivedWelcomeMessage = true;
        await customer.save();

        console.log(`🆕 New customer registered: ${phoneNumber} (${notifyName})`);

      } else {
        // تحديث العميل الموجود والذاكرة
        customer.lastContactDate = new Date();
        customer.messageCount += 1;
        await customer.save();

        // تحديث الذاكرة
        this.updateCustomerMemory(phoneNumber, {
          lastContact: new Date(),
          messageCount: customer.messageCount,
          isNew: false
        });
      }

      return customer;
    } catch (error) {
      console.error('Error managing customer with memory:', error);
      return null;
    }
  }

  // إدارة ذاكرة العميل
  initializeCustomerMemory(phoneNumber, initialData) {
    if (!this.clientMemory.has(phoneNumber)) {
      this.clientMemory.set(phoneNumber, {
        name: null,
        city: null,
        address: null,
        phoneNumber: phoneNumber,
        preferredLanguage: null,
        interests: [],
        conversationHistory: [],
        lastUpdate: new Date(),
        completionRate: 0,
        ...initialData
      });
    }
  }

  updateCustomerMemory(phoneNumber, newData) {
    if (!this.clientMemory.has(phoneNumber)) {
      this.initializeCustomerMemory(phoneNumber, {});
    }
    
    const currentMemory = this.clientMemory.get(phoneNumber);
    const updatedMemory = {
      ...currentMemory,
      ...newData,
      lastUpdate: new Date()
    };
    
    // حساب معدل اكتمال المعلومات
    const requiredFields = ['name', 'city', 'phoneNumber'];
    const completedFields = requiredFields.filter(field => 
      updatedMemory[field] && updatedMemory[field].toString().trim() !== ''
    );
    updatedMemory.completionRate = Math.round((completedFields.length / requiredFields.length) * 100);
    
    this.clientMemory.set(phoneNumber, updatedMemory);
    
    console.log(`💾 Memory updated for ${phoneNumber}: ${updatedMemory.completionRate}% complete`);
  }

  getCustomerMemory(phoneNumber) {
    return this.clientMemory.get(phoneNumber) || {
      name: null,
      city: null,
      address: null,
      phoneNumber: phoneNumber,
      isNew: true,
      completionRate: 0
    };
  }

  // معالج احتياطي للرسائل
  async handleMessageFallback(message, customer, phoneNumber) {
    try {
      console.log(`🔄 Using fallback handler for ${phoneNumber}`);
      
      // رد بسيط
      const fallbackResponse = this.getBasicResponse(message.body);
      await this.client.sendMessage(message.from, fallbackResponse);
      
      this.stats.fallbackResponses++;
      
      // تحديث العميل
      if (customer) {
        customer.lastContactDate = new Date();
        customer.messageCount += 1;
        await customer.save();
      }
      
    } catch (error) {
      console.error('Error in fallback handler:', error);
      await this.sendErrorMessage(message.from);
    }
  }

  // فحص ما إذا كانت الرسالة تحتاج معالجة
  shouldProcessMessage(message) {
    if (message.from.includes('@g.us') && !this.config.enableGroupMessages) {
      return false;
    }

    if (message.fromMe || !message.body || message.body.trim() === '') {
      return false;
    }

    if (!this.config.enableAutoReply) {
      return false;
    }

    return true;
  }

  // فحص حدود الرسائل
  checkMessageLimits(phoneNumber) {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // فحص Rate Limiting
    if (this.messageQueue.has(phoneNumber)) {
      const lastMessage = this.messageQueue.get(phoneNumber);
      if (now - lastMessage < this.rateLimitDelay) {
        return false;
      }
    }

    this.messageQueue.set(phoneNumber, now);

    // تنظيف الرسائل القديمة من Queue
    for (const [phone, timestamp] of this.messageQueue.entries()) {
      if (now - timestamp > oneHour) {
        this.messageQueue.delete(phone);
      }
    }

    return true;
  }

  // إظهار مؤشر الكتابة
  async showTypingIndicator(message) {
    try {
      const chat = await message.getChat();
      await chat.sendStateTyping();
      
      // تأخير ديناميكي حسب طول الرسالة
      const baseDelay = 1000;
      const lengthDelay = message.body.length * 25;
      const maxDelay = 5000;
      
      const delay = Math.min(baseDelay + lengthDelay, maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      console.error('Error showing typing indicator:', error);
    }
  }

  // رد أساسي محسن
  getBasicResponse(messageBody) {
    const lowerMessage = messageBody.toLowerCase();
    
    if (lowerMessage.includes('سلام') || lowerMessage.includes('مرحبا') || lowerMessage.includes('bonjour')) {
      return 'أهلاً وسهلاً! كيف يمكنني مساعدتك اليوم؟ 😊';
    }
    
    if (lowerMessage.includes('شكرا') || lowerMessage.includes('merci')) {
      return 'العفو! أنا هنا لخدمتك دائماً 😊';
    }

    if (lowerMessage.includes('وداع') || lowerMessage.includes('bye') || lowerMessage.includes('au revoir')) {
      return 'مع السلامة! أتطلع للحديث معك مرة أخرى 👋';
    }
    
    return 'شكراً لتواصلك معنا. سأقوم بمساعدتك في أقرب وقت ممكن! 🌟';
  }

  // إرسال رسالة الترحيب مع الوسائط
  async sendWelcomeMessage(to) {
    try {
      await this.client.sendMessage(to, this.welcomeMessage);
      
      // إرسال بعض الصور (حد أقصى 2 للترحيب)
      const images = await multimediaService.getMediaFiles('images');
      for (const image of images.slice(0, 2)) {
        try {
          const media = multimediaService.createMessageMedia('images', image);
          if (media) {
            await this.client.sendMessage(to, media);
            await new Promise(resolve => setTimeout(resolve, this.config.delay * 1000));
          }
        } catch (error) {
          console.error(`Error sending welcome image ${image}:`, error);
        }
      }

    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
  }

  // إرسال رسالة خطأ
  async sendErrorMessage(to) {
    try {
      const errorMessage = 'عذراً، حدث خطأ تقني مؤقت. سيتواصل معك فريق الخدمة قريباً. 🙏';
      await this.client.sendMessage(to, errorMessage);
    } catch (error) {
      console.error('Error sending error message:', error);
    }
  }

  // إرسال رسالة يدوية
  async sendManualMessage(phoneNumber, message, mediaPath = null) {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp client is not ready');
      }

      const whatsappNumber = phoneNumber.includes('@c.us') ? 
        phoneNumber : `${phoneNumber}@c.us`;

      if (mediaPath) {
        const media = MessageMedia.fromFilePath(mediaPath);
        await this.client.sendMessage(whatsappNumber, media, { caption: message });
      } else {
        await this.client.sendMessage(whatsappNumber, message);
      }

      this.stats.totalMessages++;
      return { success: true };
    } catch (error) {
      console.error('Error sending manual message:', error);
      return { success: false, error: error.message };
    }
  }

  // تحديث إحصائيات وقت الاستجابة
  updateResponseTimeStats(responseTime) {
    const totalResponses = this.stats.aiResponses + this.stats.agentResponses + this.stats.fallbackResponses;
    if (totalResponses > 0) {
      this.stats.averageResponseTime = (
        (this.stats.averageResponseTime * (totalResponses - 1) + responseTime) / totalResponses
      );
    }
  }

  // اختبار الجسر الذكي
  async testSmartBridge() {
    try {
      console.log('🧪 Testing Smart AI-Agent Bridge...');
      
      const bridgeStats = aiAgentBridge.getTransitionStats();
      console.log('📊 Bridge Statistics:', {
        totalTransitions: Object.values(bridgeStats.transitions).reduce((a, b) => a + b, 0),
        efficiency: bridgeStats.efficiency
      });
      
      console.log('✅ Smart Bridge is operational');
    } catch (error) {
      console.error('❌ Smart Bridge test failed:', error);
    }
  }

  // إعادة تعيين العميل
  async resetClient() {
    try {
      console.log('🔄 Resetting WhatsApp client...');
      
      if (this.client) {
        await this.client.destroy();
      }
      
      this.client = null;
      this.isReady = false;
      this.qrCode = null;
      this.reconnectAttempts = 0;
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      return await this.initializeClient();
    } catch (error) {
      console.error('Error resetting client:', error);
      throw error;
    }
  }

  // إعادة تعيين حالة تأكيد العميل
  resetClientConfirmationStatus(phoneNumber) {
    if (this.pendingClientInfo.has(phoneNumber)) {
      this.pendingClientInfo.delete(phoneNumber);
      console.log(`🔄 Client confirmation status reset for ${phoneNumber}`);
      return true;
    }
    return false;
  }

  // الحصول على معلومات المحادثة
  getConversationInfo(phoneNumber) {
    const memory = this.getCustomerMemory(phoneNumber);
    const bridgeStats = aiAgentBridge.getTransitionStats();
    
    return {
      ...memory,
      bridgeStats: bridgeStats,
      smartTransitions: this.stats.smartTransitions
    };
  }

  // الحصول على جميع المحادثات النشطة
  getAllActiveConversations() {
    const activeConversations = [];
    
    for (const [phoneNumber, memory] of this.clientMemory.entries()) {
      const timeSinceLastUpdate = Date.now() - new Date(memory.lastUpdate).getTime();
      
      if (timeSinceLastUpdate < 24 * 60 * 60 * 1000) { // آخر 24 ساعة
        activeConversations.push({
          phoneNumber,
          name: memory.name,
          completionRate: memory.completionRate,
          lastUpdate: memory.lastUpdate,
          isRecent: timeSinceLastUpdate < 5 * 60 * 1000 // آخر 5 دقائق
        });
      }
    }
    
    return activeConversations.sort((a, b) => 
      new Date(b.lastUpdate) - new Date(a.lastUpdate)
    );
  }

  // تنظيف البيانات القديمة
  cleanupOldData() {
    const oneDay = 24 * 60 * 60 * 1000;
    const oneHour = 60 * 60 * 1000;
    const now = Date.now();

    // تنظيف message queue
    for (const [phoneNumber, timestamp] of this.messageQueue.entries()) {
      if (now - timestamp > oneHour) {
        this.messageQueue.delete(phoneNumber);
      }
    }

    // تنظيف pending client info
    for (const [phoneNumber, info] of this.pendingClientInfo.entries()) {
      if (now - new Date(info.timestamp).getTime() > oneDay) {
        this.pendingClientInfo.delete(phoneNumber);
      }
    }

    // تنظيف ذاكرة العملاء القديمة
    for (const [phoneNumber, memory] of this.clientMemory.entries()) {
      if (now - new Date(memory.lastUpdate).getTime() > 7 * oneDay) { // أسبوع
        this.clientMemory.delete(phoneNumber);
      }
    }

    console.log('🧹 Old data cleaned up');
  }

  // إحصائيات شاملة مع معلومات الجسر الذكي
  getStats() {
    const uptime = Date.now() - this.stats.startTime.getTime();
    const bridgeStats = aiAgentBridge.getTransitionStats();
    
    return {
      ...this.stats,
      uptime: {
        milliseconds: uptime,
        formatted: this.formatUptime(uptime)
      },
      isConnected: this.isReady,
      qrCodeAvailable: !!this.qrCode,
      config: this.config,
      
      // إحصائيات الجسر الذكي
      smartBridge: {
        enabled: this.config.enableSmartTransition,
        stats: bridgeStats,
        memorySize: this.clientMemory.size,
        averageCompletionRate: this.calculateAverageCompletionRate()
      },
      
      // معلومات العملاء المعلقة
      pendingClients: {
        count: this.pendingClientInfo.size,
        list: Array.from(this.pendingClientInfo.keys())
      },
      
      // معدلات الأداء المحسنة
      performance: {
        smartTransitionRate: this.stats.totalMessages > 0 ? 
          (this.stats.smartTransitions / this.stats.totalMessages * 100).toFixed(2) + '%' : '0%',
        naturalOrderRate: this.stats.clientsHelped > 0 ?
          (this.stats.naturalOrdersStarted / this.stats.clientsHelped * 100).toFixed(2) + '%' : '0%',
        averageStepsToOrder: bridgeStats.efficiency?.averageStepsToOrder || 0,
        naturalTransitionRate: bridgeStats.efficiency?.naturalTransitionRate || 0
      }
    };
  }

  calculateAverageCompletionRate() {
    if (this.clientMemory.size === 0) return 0;
    
    let totalCompletion = 0;
    for (const memory of this.clientMemory.values()) {
      totalCompletion += memory.completionRate || 0;
    }
    
    return Math.round(totalCompletion / this.clientMemory.size);
  }

  // تنسيق وقت التشغيل
  formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} يوم`;
    if (hours > 0) return `${hours} ساعة`;
    if (minutes > 0) return `${minutes} دقيقة`;
    return `${seconds} ثانية`;
  }

  // إرسال رسالة تجريبية لاختبار النظام الذكي
  async testSmartSystem(phoneNumber, testMessage) {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp client is not ready');
      }

      console.log(`🧪 Testing Smart System with: "${testMessage}"`);
      
      // معالجة الرسالة باستخدام النظام الذكي
      const customerInfo = this.getCustomerMemory(phoneNumber);
      const result = await aiAgentBridge.processMessage(
        phoneNumber, 
        testMessage, 
        this.client, 
        customerInfo
      );
      
      if (result) {
        console.log('✅ Smart System test successful');
        console.log('🎯 Result:', {
          smartTransition: result.smartTransition,
          transitionType: result.transitionType,
          aiGenerated: result.aiGenerated
        });
        return { success: true, result };
      } else {
        console.log('⚠️ Smart System test failed, using fallback');
        return { success: true, fallback: true };
      }
    } catch (error) {
      console.error('❌ Error testing Smart System:', error);
      return { success: false, error: error.message };
    }
  }

  // Getters للوصول للخصائص
  get whatsappClient() {
    return this.client;
  }

  get qrCodeData() {
    return this.qrCode;
  }

  get isClientReady() {
    return this.isReady;
  }

  // دالة لحفظ تقرير مفصل عن الأداء مع إضافات النظام الذكي
  async generatePerformanceReport() {
    const stats = this.getStats();
    const bridgeStats = aiAgentBridge.getTransitionStats();
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalMessages: stats.totalMessages,
        smartTransitions: stats.smartTransitions,
        naturalOrdersStarted: stats.naturalOrdersStarted,
        clientsHelped: stats.clientsHelped,
        uptime: stats.uptime.formatted,
        averageCompletionRate: stats.smartBridge.averageCompletionRate
      },
      performance: {
        averageResponseTime: Math.round(stats.averageResponseTime) + 'ms',
        smartTransitionRate: stats.performance.smartTransitionRate,
        naturalOrderRate: stats.performance.naturalOrderRate,
        averageStepsToOrder: stats.performance.averageStepsToOrder,
        naturalTransitionRate: stats.performance.naturalTransitionRate,
        memoryUsage: this.getMemoryUsage()
      },
      smartBridge: {
        enabled: stats.smartBridge.enabled,
        transitions: bridgeStats.transitions,
        efficiency: bridgeStats.efficiency,
        memorySize: stats.smartBridge.memorySize
      },
      clientMemory: {
        activeClients: this.clientMemory.size,
        averageCompletionRate: this.calculateAverageCompletionRate(),
        topCompletedClients: this.getTopCompletedClients(5)
      },
      recommendations: this.generateSmartRecommendations(stats, bridgeStats)
    };
    
    // حفظ التقرير في ملف
    const reportPath = path.join(__dirname, `../reports/smart-performance-${Date.now()}.json`);
    const reportsDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Smart Performance report saved to: ${reportPath}`);
    
    return report;
  }

  getTopCompletedClients(limit = 5) {
    const clients = Array.from(this.clientMemory.entries())
      .map(([phoneNumber, memory]) => ({
        phoneNumber,
        name: memory.name,
        completionRate: memory.completionRate,
        lastUpdate: memory.lastUpdate
      }))
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, limit);
    
    return clients;
  }

  generateSmartRecommendations(stats, bridgeStats) {
    const recommendations = [];
    
    // تحليل معدل الانتقال الذكي
    const smartTransitionRate = parseFloat(stats.performance.smartTransitionRate);
    if (smartTransitionRate < 50) {
      recommendations.push({
        type: 'smart_transition',
        priority: 'high',
        message: 'معدل الانتقال الذكي منخفض - راجع محفزات الانتقال',
        action: 'تحسين كلمات المحفزات في transitionTriggers'
      });
    }
    
    // تحليل معدل الطلبات الطبيعية
    const naturalOrderRate = parseFloat(stats.performance.naturalOrderRate);
    if (naturalOrderRate < 30) {
      recommendations.push({
        type: 'natural_orders',
        priority: 'medium',
        message: 'معدل الطلبات الطبيعية منخفض - حسن رسائل الترحيب',
        action: 'تحديث قوالب الرسائل لتكون أكثر جاذبية'
      });
    }
    
    // تحليل متوسط خطوات الطلب
    const avgSteps = stats.performance.averageStepsToOrder;
    if (avgSteps > 8) {
      recommendations.push({
        type: 'order_efficiency',
        priority: 'high',
        message: 'متوسط خطوات الطلب مرتفع - بسط العملية',
        action: 'تحسين استخراج المعلومات من رسالة واحدة'
      });
    }
    
    // تحليل حجم الذاكرة
    if (this.clientMemory.size > 1000) {
      recommendations.push({
        type: 'memory_management',
        priority: 'medium',
        message: 'حجم ذاكرة العملاء كبير - فعل التنظيف التلقائي',
        action: 'تقليل فترة الاحتفاظ بالذاكرة من 7 أيام إلى 3 أيام'
      });
    }
    
    // تحليل معدل اكتمال المعلومات
    const avgCompletion = this.calculateAverageCompletionRate();
    if (avgCompletion < 60) {
      recommendations.push({
        type: 'info_completion',
        priority: 'high',
        message: 'معدل اكتمال المعلومات منخفض - حسن طرق الاستخراج',
        action: 'تطوير أنماط استخراج أفضل في ai-client-extraction'
      });
    }
    
    return recommendations;
  }

  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
      external: Math.round(usage.external / 1024 / 1024) + 'MB'
    };
  }

  // إضافة دالة للحصول على إحصائيات الذاكرة المفصلة
  getDetailedMemoryStats() {
    const memoryStats = {
      totalClients: this.clientMemory.size,
      completionRates: {
        completed: 0,        // 100%
        nearComplete: 0,     // 75-99%
        partial: 0,          // 25-74%
        minimal: 0           // 1-24%
      },
      languageDistribution: {
        arabic: 0,
        darija: 0,
        french: 0,
        unknown: 0
      },
      activityLevels: {
        active: 0,      // آخر ساعة
        recent: 0,      // آخر يوم
        dormant: 0      // أكثر من يوم
      }
    };

    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * 60 * 60 * 1000;

    for (const memory of this.clientMemory.values()) {
      // تحليل معدل الاكتمال
      const completion = memory.completionRate || 0;
      if (completion === 100) {
        memoryStats.completionRates.completed++;
      } else if (completion >= 75) {
        memoryStats.completionRates.nearComplete++;
      } else if (completion >= 25) {
        memoryStats.completionRates.partial++;
      } else if (completion > 0) {
        memoryStats.completionRates.minimal++;
      }

      // تحليل اللغة المفضلة
      const lang = memory.preferredLanguage || 'unknown';
      if (memoryStats.languageDistribution[lang] !== undefined) {
        memoryStats.languageDistribution[lang]++;
      } else {
        memoryStats.languageDistribution.unknown++;
      }

      // تحليل مستوى النشاط
      const timeSinceUpdate = now - new Date(memory.lastUpdate).getTime();
      if (timeSinceUpdate < oneHour) {
        memoryStats.activityLevels.active++;
      } else if (timeSinceUpdate < oneDay) {
        memoryStats.activityLevels.recent++;
      } else {
        memoryStats.activityLevels.dormant++;
      }
    }

    return memoryStats;
  }

  // دالة لتصدير بيانات العملاء للتحليل
  async exportClientData(format = 'json') {
    const clientData = Array.from(this.clientMemory.entries()).map(([phoneNumber, memory]) => ({
      phoneNumber,
      name: memory.name,
      city: memory.city,
      completionRate: memory.completionRate,
      preferredLanguage: memory.preferredLanguage,
      lastUpdate: memory.lastUpdate,
      messageCount: memory.messageCount || 0
    }));

    const exportData = {
      timestamp: new Date().toISOString(),
      totalClients: clientData.length,
      data: clientData
    };

    const filename = `client-export-${Date.now()}.${format}`;
    const exportPath = path.join(__dirname, `../exports/${filename}`);
    const exportDir = path.dirname(exportPath);

    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    if (format === 'json') {
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    } else if (format === 'csv') {
      const csv = this.convertToCSV(clientData);
      fs.writeFileSync(exportPath, csv);
    }

    console.log(`📤 Client data exported to: ${exportPath}`);
    return { success: true, path: exportPath, count: clientData.length };
  }

  convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(item => 
      Object.values(item).map(value => 
        typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      ).join(',')
    );
    
    return [headers, ...rows].join('\n');
  }

  // دالة للبحث في ذاكرة العملاء
  searchClientMemory(query, field = 'all') {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [phoneNumber, memory] of this.clientMemory.entries()) {
      let match = false;

      if (field === 'all' || field === 'name') {
        if (memory.name && memory.name.toLowerCase().includes(queryLower)) {
          match = true;
        }
      }

      if (field === 'all' || field === 'city') {
        if (memory.city && memory.city.toLowerCase().includes(queryLower)) {
          match = true;
        }
      }

      if (field === 'all' || field === 'phone') {
        if (phoneNumber.includes(query)) {
          match = true;
        }
      }

      if (match) {
        results.push({
          phoneNumber,
          ...memory,
          relevanceScore: this.calculateRelevanceScore(memory, query, field)
        });
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  calculateRelevanceScore(memory, query, field) {
    let score = 0;
    const queryLower = query.toLowerCase();

    // نقاط إضافية للمطابقة الدقيقة
    if (memory.name && memory.name.toLowerCase() === queryLower) score += 100;
    if (memory.city && memory.city.toLowerCase() === queryLower) score += 80;

    // نقاط للمطابقة الجزئية
    if (memory.name && memory.name.toLowerCase().includes(queryLower)) score += 50;
    if (memory.city && memory.city.toLowerCase().includes(queryLower)) score += 40;

    // نقاط إضافية للعملاء الأكثر اكتمالاً
    score += memory.completionRate || 0;

    // نقاط للنشاط الحديث
    const timeSinceUpdate = Date.now() - new Date(memory.lastUpdate).getTime();
    if (timeSinceUpdate < 24 * 60 * 60 * 1000) score += 20; // آخر يوم
    if (timeSinceUpdate < 60 * 60 * 1000) score += 10; // آخر ساعة

    return score;
  }
}

// تشغيل تنظيف البيانات كل ساعة
const whatsappService = new WhatsAppUnifiedService();

// تنظيف دوري
setInterval(() => {
  whatsappService.cleanupOldData();
}, 60 * 60 * 1000); // كل ساعة

// تقرير أداء يومي
setInterval(() => {
  whatsappService.generatePerformanceReport();
}, 24 * 60 * 60 * 1000); // كل 24 ساعة

// حفظ بيانات العملاء كل 6 ساعات كنسخة احتياطية
setInterval(() => {
  whatsappService.exportClientData('json');
}, 6 * 60 * 60 * 1000); // كل 6 ساعات

module.exports = whatsappService;