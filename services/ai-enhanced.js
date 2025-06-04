// services/ai-enhanced.js - Service IA محسن مع ذاكرة المحادثة
const axios = require('axios');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const AIContext = require('../models/AIContext');

class AIEnhancedService {
  constructor() {
    this.geminiConfig = {
      apiKey: process.env.GEMINI_API_KEY || 'AIzaSyBqGyqagvCy9TVQVrLzuma70YexC5BDsK8',
      apiUrl: process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    };

    // Cache للمنتجات والسياق
    this.cache = {
      products: null,
      context: null,
      lastUpdate: null,
      ttl: 15 * 60 * 1000 // 15 دقيقة
    };

    // ذاكرة المحادثات - هذا هو الجديد!
    this.conversationMemory = new Map();
    this.maxMessagesPerConversation = 10; // أقصى عدد رسائل محفوظة لكل محادثة
    this.conversationTimeout = 2 * 60 * 60 * 1000; // مهلة زمنية للمحادثة (ساعتين)

    // إحصائيات
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastError: null,
      conversationsActive: 0,
      totalConversations: 0
    };

    // Patterns لتحديد اللغة
    this.languagePatterns = {
      darija: [
        /\b(wach|wash|labas|bghit|khoya|sahbi|mrhba|fin|feen|chno|nta|nti|dyal|mashi|kifash|wakha|m3a|3nd|l9it|mzyan|hadshi|bzaf|flous|atay|ch7al|shhal|ghadi|ndir|dyali|dyalna)\b/i,
        /\b(salam|salamo|مرحبا|لباس|بغيت|خويا|صاحبي|فين|شنو|ديال|ماشي|كيفاش|واخا|معا|عند|لقيت|مزيان|هادشي|بزاف|فلوس|أتاي|شحال|غادي|نديرو|ديالي|ديالنا)\b/i
      ],
      arabic: [
        /[\u0600-\u06FF]/,
        /\b(مرحبا|أهلا|كيف|الحال|شكرا|من فضلك|أريد|محتاج|السعر|الثمن|كم|أين|متى|لماذا|كيف|هل)\b/i
      ],
      french: [
        /\b(bonjour|salut|comment|allez|vous|merci|s'il vous plaît|je veux|j'ai besoin|prix|combien|où|quand|pourquoi|comment|est-ce que)\b/i,
        /[éèêëàâäôöùûüÿçîï]/i
      ]
    };

    // بدء تنظيف دوري للمحادثات القديمة
    this.startConversationCleanup();
  }

  // إدارة ذاكرة المحادثة - الوظائف الجديدة
  getConversationHistory(phoneNumber) {
    const conversation = this.conversationMemory.get(phoneNumber);
    if (!conversation) {
      return [];
    }

    // فحص المهلة الزمنية
    const now = Date.now();
    if (now - conversation.lastUpdate > this.conversationTimeout) {
      this.conversationMemory.delete(phoneNumber);
      return [];
    }

    return conversation.messages || [];
  }

  addMessageToHistory(phoneNumber, role, content, metadata = {}) {
    const now = Date.now();
    
    if (!this.conversationMemory.has(phoneNumber)) {
      this.conversationMemory.set(phoneNumber, {
        messages: [],
        startTime: now,
        lastUpdate: now,
        messageCount: 0
      });
      this.stats.totalConversations++;
    }

    const conversation = this.conversationMemory.get(phoneNumber);
    
    // إضافة الرسالة
    conversation.messages.push({
      role: role, // 'user' أو 'assistant'
      content: content,
      timestamp: now,
      ...metadata
    });

    // الحفاظ على الحد الأقصى للرسائل
    if (conversation.messages.length > this.maxMessagesPerConversation) {
      conversation.messages = conversation.messages.slice(-this.maxMessagesPerConversation);
    }

    conversation.lastUpdate = now;
    conversation.messageCount++;
    
    this.conversationMemory.set(phoneNumber, conversation);
    this.updateActiveConversationsCount();
  }

  updateActiveConversationsCount() {
    const now = Date.now();
    let activeCount = 0;
    
    for (const [phoneNumber, conversation] of this.conversationMemory.entries()) {
      if (now - conversation.lastUpdate <= this.conversationTimeout) {
        activeCount++;
      }
    }
    
    this.stats.conversationsActive = activeCount;
  }

  // تنظيف المحادثات القديمة
  cleanupOldConversations() {
    const now = Date.now();
    const deletedConversations = [];
    
    for (const [phoneNumber, conversation] of this.conversationMemory.entries()) {
      if (now - conversation.lastUpdate > this.conversationTimeout) {
        this.conversationMemory.delete(phoneNumber);
        deletedConversations.push(phoneNumber);
      }
    }
    
    if (deletedConversations.length > 0) {
      console.log(`🧹 Cleaned up ${deletedConversations.length} old conversations`);
    }
    
    this.updateActiveConversationsCount();
  }

  startConversationCleanup() {
    // تنظيف كل 30 دقيقة
    setInterval(() => {
      this.cleanupOldConversations();
    }, 30 * 60 * 1000);
  }

  // تحسين دالة تحديد اللغة
  detectLanguage(text) {
    if (!text || typeof text !== 'string') return 'darija';

    const textLower = text.toLowerCase();

    for (const pattern of this.languagePatterns.darija) {
      if (pattern.test(textLower)) return 'darija';
    }

    for (const pattern of this.languagePatterns.arabic) {
      if (pattern.test(text)) return 'arabic';
    }

    for (const pattern of this.languagePatterns.french) {
      if (pattern.test(textLower)) return 'french';
    }

    return 'darija';
  }

  // تحليل النوايا
  async analyzeIntent(message, language) {
    const intentPatterns = {
      greeting: {
        darija: /\b(salam|mrhba|labas|ahlan|hay)\b/i,
        arabic: /\b(مرحبا|أهلا|السلام عليكم|صباح الخير|مساء الخير)\b/i,
        french: /\b(bonjour|salut|bonsoir|hello|hi)\b/i
      },
      priceInquiry: {
        darija: /\b(ch7al|shhal|bshhal|taman|flouss|thaman)\b/i,
        arabic: /\b(كم|بكم|الثمن|السعر|التكلفة)\b/i,
        french: /\b(combien|prix|coût|tarif)\b/i
      },
      productInquiry: {
        darija: /\b(ash kayn|ashno|muntagat|bila|3ndkum)\b/i,
        arabic: /\b(ما عندكم|المنتجات|ماذا|هل لديكم|متوفر)\b/i,
        french: /\b(qu'est-ce que|produits|avez-vous|disponible)\b/i
      },
      orderIntent: {
        darija: /\b(bghit|3awz|taleb|commande)\b/i,
        arabic: /\b(أريد|أطلب|طلب|أرغب)\b/i,
        french: /\b(je veux|commande|commander|acheter)\b/i
      },
      followUp: {
        darija: /\b(wa|walakin|bach|hit|3lach)\b/i,
        arabic: /\b(لكن|ولكن|لأن|بسبب|لماذا)\b/i,
        french: /\b(mais|parce que|pourquoi|car|donc)\b/i
      }
    };

    const detectedIntents = {};
    
    Object.keys(intentPatterns).forEach(intent => {
      const patterns = intentPatterns[intent];
      detectedIntents[intent] = patterns[language] ? patterns[language].test(message) : false;
    });

    return detectedIntents;
  }

  // تحميل معلومات المنتجات
  async loadProductsInfo(forceRefresh = false) {
    const now = Date.now();
    
    if (!forceRefresh && this.cache.products && this.cache.lastUpdate && 
        (now - this.cache.lastUpdate) < this.cache.ttl) {
      return this.cache.products;
    }

    try {
      const productsInfo = await Product.getProductsInfoForAI();
      this.cache.products = productsInfo;
      this.cache.lastUpdate = now;
      return productsInfo;
    } catch (error) {
      console.error('Error loading products info:', error);
      return this.cache.products || { categories: [], shipping: {}, returns: '', support: '' };
    }
  }

  // العثور على المنتج المناسب
  async getMatchedProduct(message, productsInfo, conversationHistory = []) {
    if (!productsInfo || !productsInfo.categories || productsInfo.categories.length === 0) {
      return this.getDefaultProduct();
    }

    // استخراج الكلمات المفتاحية من الرسالة الحالية وتاريخ المحادثة
    const allMessages = [
      ...conversationHistory.filter(msg => msg.role === 'user').map(msg => msg.content),
      message
    ].join(' ');

    const keywords = this.extractKeywords(allMessages);
    let bestMatch = null;
    let bestScore = 0;

    for (const category of productsInfo.categories) {
      if (category.products && category.products.length > 0) {
        for (const product of category.products) {
          let score = 0;
          const productName = product.name ? product.name.toLowerCase() : '';
          const productDesc = product.description ? product.description.toLowerCase() : '';
          
          for (const keyword of keywords) {
            if (productName.includes(keyword.toLowerCase())) score += 3;
            if (productDesc.includes(keyword.toLowerCase())) score += 2;
            if (product.id && product.id.toLowerCase() === keyword.toLowerCase()) score += 5;
          }
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = product;
          }
        }
      }
    }

    if (!bestMatch || bestScore < 2) {
      return this.getFirstAvailableProduct(productsInfo);
    }

    return bestMatch;
  }

  extractKeywords(message) {
    const stopWords = ['في', 'من', 'إلى', 'على', 'عن', 'مع', 'هذا', 'هذه', 'التي', 'الذي', 'كيف', 'ماذا', 'أين', 'متى'];
    
    const words = message.split(/[\s,.!?;:()]+/)
      .filter(word => word.length >= 2)
      .filter(word => !stopWords.includes(word.toLowerCase()));
      
    return words;
  }

  getFirstAvailableProduct(productsInfo) {
    if (productsInfo && productsInfo.categories && productsInfo.categories.length > 0) {
      const firstCategory = productsInfo.categories[0];
      if (firstCategory.products && firstCategory.products.length > 0) {
        return firstCategory.products[0];
      }
    }
    return this.getDefaultProduct();
  }

  getDefaultProduct() {
    return {
      title: "منتج ÉCLORA الطبيعي",
      description: "منتج طبيعي عالي الجودة مصنوع من مكونات طبيعية 100% يناسب جميع الأعمار ومفيد للصحة العامة",
      benefits: [
        "مكونات طبيعية 100%",
        "آمن للاستخدام اليومي", 
        "نتائج سريعة ومضمونة",
        "مناسب لجميع الأعمار"
      ],
      price: "299 درهم مغربي"
    };
  }

  // بناء البرومبت المحسن مع تاريخ المحادثة - هذا هو التحسين الرئيسي!
  buildEnhancedPromptWithHistory(message, customerInfo, productInfo, conversationHistory = []) {
    const benefitsText = Array.isArray(productInfo.benefits) 
      ? productInfo.benefits.map(benefit => `   • ${benefit}`).join('\n')
      : '   • منتج عالي الجودة\n   • نتائج مضمونة\n   • آمن للاستخدام';

    const customerContext = customerInfo ? `
**معلومات الزبون:**
* **الاسم:** ${customerInfo.name || 'زبون كريم'}
* **عدد الرسائل:** ${customerInfo.messageCount || 1}
* **حالة العميل:** ${customerInfo.isNew ? 'زبون جديد' : 'زبون عائد'}
` : '';

    // بناء تاريخ المحادثة - هذا هو الجديد!
    let conversationContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = '\n**تاريخ المحادثة:**\n';
      
      // أخذ آخر 6 رسائل لتجنب طول البرومبت الزائد
      const recentMessages = conversationHistory.slice(-6);
      
      recentMessages.forEach((msg, index) => {
        const role = msg.role === 'user' ? 'الزبون' : 'أنت';
        const time = new Date(msg.timestamp).toLocaleTimeString('ar-EG', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        conversationContext += `${index + 1}. ${role} (${time}): ${msg.content}\n`;
      });
      
      conversationContext += '\n**ملاحظة:** استعمل تاريخ المحادثة لفهم السياق وتقديم رد متماسك ومترابط.\n';
    }

    return `**المهمة:** أجب على سؤال الزبون بطريقة محترفة ومقنعة، مع الأخذ بعين الاعتبار تاريخ المحادثة السابقة.

**المعطيات المستعملة للإقناع:**
* **العنوان:** ${productInfo.title}
* **الوصف:** ${productInfo.description}
* **المزايا:**
${benefitsText}
* **الثمن:** ${productInfo.price}

${customerContext}${conversationContext}

**السؤال الحالي من الزبون:** ${message}

**قواعد إنشاء الجواب:**
* ضروري الجواب يكون بالدارجة المغربية
* يكون مقنع ومهني ومترابط مع المحادثة السابقة
* يكون لبق وجذاب
* مختصر ومفيد (10 كلمة حسب الحاجة)
* استعمل الاسم ديال الزبون في الجواب إذا كان متاح
* ركز على المزايا اللي تهم الزبون
* إذا سبق وسأل نفس السؤال، أجب بطريقة مختلفة
* إذا غير الموضوع، تابع معه بطريقة طبيعية
* لا تكرر نفس المعلومات إذا سبق وذكرتها

أجب بطريقة طبيعية ومقنعة ومترابطة:`;
  }

  // استدعاء Gemini API
  async callGeminiAPI(prompt, retries = 3) {
    const startTime = Date.now();
    this.stats.totalRequests++;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const requestConfig = {
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 500, // زيادة للسماح بردود أطول مع السياق
            topP: 0.9,
            topK: 40,
            candidateCount: 1
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        };

        const response = await axios.post(
          `${this.geminiConfig.apiUrl}?key=${this.geminiConfig.apiKey}`,
          requestConfig,
          {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'WhatsApp-Bot-AI/1.0'
            },
            timeout: 20000 // زيادة timeout للردود الأطول
          }
        );

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          const responseTime = Date.now() - startTime;
          this.updateStats(true, responseTime);
          return response.data.candidates[0].content.parts[0].text.trim();
        }

        throw new Error('Invalid response structure from Gemini API');

      } catch (error) {
        console.error(`Gemini API attempt ${attempt} failed:`, {
          error: error.message,
          status: error.response?.status
        });

        if (attempt === retries) {
          this.stats.lastError = {
            message: error.message,
            timestamp: new Date(),
            status: error.response?.status
          };
          this.updateStats(false, Date.now() - startTime);
          return null;
        }

        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return null;
  }

  // ردود الطوارئ المحسنة
  generateFallbackResponse(message, customerInfo, language, intents, conversationHistory = []) {
    const customerName = customerInfo?.name ? ` ${customerInfo.name}` : '';
    
    // التحقق من تاريخ المحادثة لتجنب التكرار
    const recentResponses = conversationHistory
      .filter(msg => msg.role === 'assistant')
      .slice(-3)
      .map(msg => msg.content);

    const responses = {
      darija: {
        greeting: [
          `أهلا وسهلا${customerName}! كيفاش نقدر نعاونك اليوم؟ 😊`,
          `مرحبا بيك${customerName}! كيداير؟ عندنا منتجات زوينة بزاف!`,
          `سلام عليكم${customerName}! نورتي، كيفاش نخدمك؟`
        ],
        priceInquiry: [
          `الثمن ديالنا تنافسي بزاف${customerName}! 299 درهم غير، وجودة عالية!`,
          `السعر مناسب ومعقول${customerName}. 299 درهم ومعاه ضمان الجودة!`,
          `بـ299 درهم غير${customerName}! قيمة ممتازة للجودة اللي كتحصل عليها`
        ],
        followUp: [
          `أش كتبغي تعرف أكثر${customerName}؟ أنا هنا باش نجاوبك`,
          `واش عندك شي سؤال آخر${customerName}؟ نقدر نعاونك أكثر`,
          `كيما قلت ليك${customerName}، عندنا حلول ممتازة ليك`
        ],
        default: [
          `شكرا على الاهتمام ديالك${customerName}! كيفاش نقدر نعاونك أكثر؟`,
          `أهلا بيك${customerName}! عندنا حلول مثالية ليك`,
          `مرحبا${customerName}! أش كتبغي تعرف على المنتجات ديالنا؟`
        ]
      }
    };

    let responseCategory = 'default';
    if (intents.greeting) responseCategory = 'greeting';
    else if (intents.priceInquiry) responseCategory = 'priceInquiry';
    else if (intents.followUp || conversationHistory.length > 2) responseCategory = 'followUp';

    const langResponses = responses.darija;
    const categoryResponses = langResponses[responseCategory] || langResponses.default;

    // تجنب تكرار نفس الرد
    const availableResponses = categoryResponses.filter(response => 
      !recentResponses.some(recent => recent.includes(response.substring(0, 20)))
    );

    const responsesToUse = availableResponses.length > 0 ? availableResponses : categoryResponses;
    return responsesToUse[Math.floor(Math.random() * responsesToUse.length)];
  }

  // الدالة الرئيسية المحسنة مع ذاكرة المحادثة
  async analyzeMessageWithAI(message, customerInfo = {}, conversationHistory = []) {
    if (!message || typeof message !== 'string') {
      return {
        analysis: { language: 'darija', intent: {} },
        response: 'مرحبا! كيفاش نقدر نعاونك؟',
        aiGenerated: false,
        error: 'Invalid message format'
      };
    }

    try {
      const phoneNumber = customerInfo.phoneNumber || 'unknown';
      
      // إضافة الرسالة الحالية لذاكرة المحادثة
      this.addMessageToHistory(phoneNumber, 'user', message);

      // الحصول على تاريخ المحادثة الكامل
      const fullConversationHistory = this.getConversationHistory(phoneNumber);

      // تحليل اللغة والنوايا
      const language = this.detectLanguage(message);
      const intents = await this.analyzeIntent(message, language);

      // تحميل المنتجات
      const productsInfo = await this.loadProductsInfo();

      // العثور على المنتج المناسب مع الأخذ بعين الاعتبار تاريخ المحادثة
      const matchedProduct = await this.getMatchedProduct(message, productsInfo, fullConversationHistory);

      // بناء البرومبت مع تاريخ المحادثة
      const prompt = this.buildEnhancedPromptWithHistory(
        message, 
        customerInfo, 
        matchedProduct, 
        fullConversationHistory
      );

      // استدعاء الذكاء الاصطناعي
      const aiResponse = await this.callGeminiAPI(prompt);

      if (aiResponse) {
        // إضافة الرد لذاكرة المحادثة
        this.addMessageToHistory(phoneNumber, 'assistant', aiResponse, {
          aiGenerated: true,
          productUsed: matchedProduct.title
        });

        return {
          analysis: { language, intent: intents },
          response: aiResponse,
          aiGenerated: true,
          processingTime: this.stats.averageResponseTime,
          productUsed: matchedProduct,
          conversationLength: fullConversationHistory.length + 1
        };
      }

      // رد الطوارئ مع الأخذ بعين الاعتبار تاريخ المحادثة
      const fallbackResponse = this.generateFallbackResponse(
        message, 
        customerInfo, 
        language, 
        intents, 
        fullConversationHistory
      );

      // إضافة رد الطوارئ لذاكرة المحادثة
      this.addMessageToHistory(phoneNumber, 'assistant', fallbackResponse, {
        aiGenerated: false,
        fallback: true
      });

      return {
        analysis: { language, intent: intents },
        response: fallbackResponse,
        aiGenerated: false,
        fallbackReason: this.stats.lastError?.message || 'API unavailable',
        conversationLength: fullConversationHistory.length + 1
      };

    } catch (error) {
      console.error('Error in analyzeMessageWithAI:', error);
      
      const customerName = customerInfo?.name ? ` ${customerInfo.name}` : '';
      const emergencyResponse = `سماح ليا${customerName} على هاد الخطأ التقني. الفريق ديالنا غادي يتواصل معاك قريبا.`;

      return {
        analysis: { language: this.detectLanguage(message), intent: {} },
        response: emergencyResponse,
        aiGenerated: false,
        error: error.message
      };
    }
  }

  // تحديث الإحصائيات
  updateStats(success, responseTime) {
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    const totalSuccessful = this.stats.successfulRequests;
    if (totalSuccessful > 0) {
      this.stats.averageResponseTime = (
        (this.stats.averageResponseTime * (totalSuccessful - 1) + responseTime) / totalSuccessful
      );
    }
  }

  // الحصول على إحصائيات مفصلة
  getServiceStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0 ? 
        (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%',
      cacheStatus: {
        productsLoaded: !!this.cache.products,
        contextLoaded: !!this.cache.context,
        lastUpdate: this.cache.lastUpdate ? new Date(this.cache.lastUpdate).toISOString() : null
      },
      conversationStats: {
        activeConversations: this.stats.conversationsActive,
        totalConversations: this.stats.totalConversations,
        averageConversationLength: this.getAverageConversationLength()
      }
    };
  }

  getAverageConversationLength() {
    if (this.conversationMemory.size === 0) return 0;
    
    let totalMessages = 0;
    for (const conversation of this.conversationMemory.values()) {
      totalMessages += conversation.messageCount;
    }
    
    return Math.round(totalMessages / this.conversationMemory.size);
  }

  // تنظيف الذاكرة
  clearCache() {
    this.cache = {
      products: null,
      context: null,
      lastUpdate: null,
      ttl: 15 * 60 * 1000
    };
  }

  // إعادة تعيين محادثة معينة
  resetConversation(phoneNumber) {
    if (this.conversationMemory.has(phoneNumber)) {
      this.conversationMemory.delete(phoneNumber);
      console.log(`🔄 Conversation reset for ${phoneNumber}`);
      return true;
    }
    return false;
  }

  // test API connection
  async testAPIConnection() {
    try {
      const testPrompt = 'Test de connexion API. Réponds simplement "OK" en darija marocaine.';
      const response = await this.callGeminiAPI(testPrompt, 1);
      return {
        connected: !!response,
        response: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // الحصول على معلومات محادثة معينة
  getConversationInfo(phoneNumber) {
    const conversation = this.conversationMemory.get(phoneNumber);
    if (!conversation) {
      return null;
    }

    return {
      phoneNumber,
      messageCount: conversation.messageCount,
      startTime: new Date(conversation.startTime).toISOString(),
      lastUpdate: new Date(conversation.lastUpdate).toISOString(),
      duration: Date.now() - conversation.startTime,
      isActive: (Date.now() - conversation.lastUpdate) <= this.conversationTimeout,
      messages: conversation.messages.map(msg => ({
        role: msg.role,
        content: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
        timestamp: new Date(msg.timestamp).toISOString()
      }))
    };
  }

  // الحصول على قائمة جميع المحادثات النشطة
  getAllActiveConversations() {
    const activeConversations = [];
    const now = Date.now();

    for (const [phoneNumber, conversation] of this.conversationMemory.entries()) {
      if (now - conversation.lastUpdate <= this.conversationTimeout) {
        activeConversations.push({
          phoneNumber,
          messageCount: conversation.messageCount,
          lastActivity: new Date(conversation.lastUpdate).toISOString(),
          duration: this.formatDuration(now - conversation.startTime),
          isRecent: (now - conversation.lastUpdate) <= 5 * 60 * 1000 // آخر 5 دقائق
        });
      }
    }

    return activeConversations.sort((a, b) => 
      new Date(b.lastActivity) - new Date(a.lastActivity)
    );
  }

  formatDuration(milliseconds) {
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }

  // تحديد ما إذا كانت المحادثة جديدة أم متواصلة
  isNewConversation(phoneNumber) {
    const conversation = this.conversationMemory.get(phoneNumber);
    if (!conversation) return true;
    
    const timeSinceLastMessage = Date.now() - conversation.lastUpdate;
    return timeSinceLastMessage > this.conversationTimeout;
  }

  // إحصائيات مفصلة للمحادثات
  getConversationAnalytics() {
    const now = Date.now();
    const analytics = {
      total: this.conversationMemory.size,
      active: 0,
      idle: 0,
      recent: 0, // آخر 5 دقائق
      longConversations: 0, // أكثر من 10 رسائل
      averageLength: 0,
      totalMessages: 0,
      byHour: Array(24).fill(0)
    };

    let totalMessages = 0;
    let conversationLengths = [];

    for (const conversation of this.conversationMemory.values()) {
      const timeSinceLastUpdate = now - conversation.lastUpdate;
      
      if (timeSinceLastUpdate <= this.conversationTimeout) {
        analytics.active++;
        
        if (timeSinceLastUpdate <= 5 * 60 * 1000) {
          analytics.recent++;
        }
      } else {
        analytics.idle++;
      }

      totalMessages += conversation.messageCount;
      conversationLengths.push(conversation.messageCount);

      if (conversation.messageCount > 10) {
        analytics.longConversations++;
      }

      // تحليل التوزيع بالساعات
      const hour = new Date(conversation.lastUpdate).getHours();
      analytics.byHour[hour]++;
    }

    analytics.totalMessages = totalMessages;
    analytics.averageLength = conversationLengths.length > 0 
      ? Math.round(conversationLengths.reduce((a, b) => a + b, 0) / conversationLengths.length)
      : 0;

    return analytics;
  }
}

// Export singleton instance
module.exports = new AIEnhancedService();