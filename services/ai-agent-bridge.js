// services/ai-agent-bridge.js - الجسر الذكي بين AI والوكيل الذكي
const aiEnhanced = require('./ai-enhanced');
const intelligentAgent = require('./intelligent-agent');
const conversationManager = require('./conversation-manager');

class AIAgentBridge {
  constructor() {
    this.conversationStates = {
      CASUAL_CHAT: 'casual_chat',
      PRODUCT_INTEREST: 'product_interest', 
      GENTLE_INFO_GATHERING: 'gentle_info_gathering',
      ACTIVE_ORDER_PROCESS: 'active_order_process',
      ORDER_FINALIZATION: 'order_finalization',
      COMPLETED: 'completed'
    };

    // نقاط انتقال ذكية
    this.transitionTriggers = {
      // كلمات تدل على الاهتمام بالشراء
      orderIntent: [
        'بغيت', 'أريد', 'عاوز', 'أطلب', 'أشتري', 'نشري', 'نطلب',
        'je veux', 'i want', 'acheter', 'commander', 'order', 'buy',
        'شحال', 'كم', 'prix', 'price', 'ثمن', 'تمن'
      ],
      
      // معلومات شخصية طوعية
      personalInfo: [
        'اسمي', 'سميتي', 'انا', 'je m\'appelle', 'my name',
        'من', 'فين', 'ساكن', 'j\'habite', 'i live', 'من', 'مدينة'
      ],
      
      // استعداد للتفاعل
      engagement: [
        'كيفاش', 'comment', 'how', 'ممكن', 'possible', 'واش يمكن',
        'عطيني', 'قوليا', 'tell me', 'dis moi'
      ]
    };

    // قوالب الانتقال التدريجي
    this.transitionResponses = {
      arabic: {
        gentle_interest: [
          "رائع! منتجنا ÉCLORA حقاً مميز. بالمناسبة، ما اسمك الكريم حتى أخاطبك باسمك؟",
          "ممتاز! ÉCLORA منتج طبيعي 100%. لو سمحت، ما اسمك؟",
          "جميل! دعني أخبرك عن ÉCLORA أولاً... وما اسمك حتى نتحدث بطريقة أفضل؟"
        ],
        collect_city: [
          "شكراً {name}! من أي مدينة أنت؟ حتى أحسب لك تكلفة التوصيل",
          "أهلاً {name}! في أي مدينة تقيم؟ نوصل لجميع المدن المغربية",
          "مرحباً {name}! ما مدينتك؟ لدينا خدمة توصيل سريعة"
        ],
        collect_address: [
          "ممتاز {name}! هل يمكنك إعطائي عنوانك في {city} للتوصيل؟",
          "رائع {name}! ما هو عنوانك التفصيلي في {city}؟",
          "شكراً {name}! أحتاج عنوان التوصيل في {city} من فضلك"
        ]
      },
      darija: {
        gentle_interest: [
          "زوين! المنتج ديالنا ÉCLORA واعر بزاف. بالمناسبة، أش سميتك باش نناديك بيها؟",
          "مزيان! ÉCLORA طبيعي 100%. عافاك، أش سميتك؟",
          "واخا! خليني نقوليك على ÉCLORA... وأش سميتك باش نتهضرو أحسن؟"
        ],
        collect_city: [
          "شكرا {name}! فين ساكن؟ باش نحسبليك التوصيل",
          "مرحبا {name}! فأي مدينة كاين؟ كنوصلو لكامل المغرب",
          "أهلا {name}! أش هي مدينتك؟ عندنا توصيل سريع"
        ],
        collect_address: [
          "تمام {name}! واش ممكن تعطيني العنوان ديالك ف{city}؟",
          "زوين {name}! أش هو العنوان كامل ف{city}؟",
          "شكرا {name}! بغيت العنوان ديال التوصيل ف{city}"
        ]
      },
      french: {
        gentle_interest: [
          "Parfait! Notre produit ÉCLORA est vraiment exceptionnel. Au fait, quel est votre nom?",
          "Excellent! ÉCLORA est 100% naturel. Votre nom s'il vous plaît?",
          "Génial! Laissez-moi vous parler d'ÉCLORA... Quel est votre nom?"
        ],
        collect_city: [
          "Merci {name}! Dans quelle ville habitez-vous? Pour calculer la livraison",
          "Bonjour {name}! Quelle est votre ville? Nous livrons partout au Maroc",
          "Salut {name}! Votre ville? Nous avons une livraison rapide"
        ],
        collect_address: [
          "Parfait {name}! Pouvez-vous me donner votre adresse à {city}?",
          "Excellent {name}! Quelle est votre adresse complète à {city}?",
          "Merci {name}! J'ai besoin de votre adresse de livraison à {city}"
        ]
      }
    };
  }

  // تحليل الرسالة وتحديد نقطة الانتقال
  async analyzeTransitionPoint(phoneNumber, message, customerInfo) {
    const conversation = conversationManager.getConversation(phoneNumber);
    const language = this.detectLanguage(message);
    
    // فحص نوايا الانتقال
    const intentAnalysis = this.analyzeTransitionIntents(message);
    
    // تحديد الحالة الحالية والانتقال المناسب
    const currentState = conversation.state;
    const suggestedTransition = this.determineBestTransition(
      currentState, 
      intentAnalysis, 
      conversation.userData,
      message
    );
    
    return {
      shouldTransition: suggestedTransition.shouldTransition,
      newState: suggestedTransition.newState,
      transitionType: suggestedTransition.type,
      extractedInfo: suggestedTransition.extractedInfo,
      language: language,
      confidence: suggestedTransition.confidence
    };
  }

  // تحليل نوايا الانتقال
  analyzeTransitionIntents(message) {
    const lowerMessage = message.toLowerCase();
    const intents = {
      hasOrderIntent: false,
      hasPersonalInfo: false,
      hasEngagement: false,
      infoTypes: []
    };

    // فحص نية الطلب
    intents.hasOrderIntent = this.transitionTriggers.orderIntent.some(trigger => 
      lowerMessage.includes(trigger.toLowerCase())
    );

    // فحص المعلومات الشخصية
    intents.hasPersonalInfo = this.transitionTriggers.personalInfo.some(trigger => 
      lowerMessage.includes(trigger.toLowerCase())
    );

    // فحص التفاعل
    intents.hasEngagement = this.transitionTriggers.engagement.some(trigger => 
      lowerMessage.includes(trigger.toLowerCase())
    );

    // استخراج أنواع المعلومات الموجودة
    if (this.hasName(message)) intents.infoTypes.push('name');
    if (this.hasCity(message)) intents.infoTypes.push('city');
    if (this.hasPhone(message)) intents.infoTypes.push('phone');
    if (this.hasAddress(message)) intents.infoTypes.push('address');

    return intents;
  }

  // تحديد أفضل انتقال
  determineBestTransition(currentState, intentAnalysis, userData, message) {
    const transition = {
      shouldTransition: false,
      newState: currentState,
      type: 'none',
      extractedInfo: {},
      confidence: 0
    };

    // استخراج المعلومات من الرسالة الحالية
    const extractedInfo = this.extractInfoFromMessage(message);

    switch (currentState) {
      case this.conversationStates.CASUAL_CHAT:
        if (intentAnalysis.hasOrderIntent || intentAnalysis.hasEngagement) {
          transition.shouldTransition = true;
          transition.newState = this.conversationStates.PRODUCT_INTEREST;
          transition.type = 'to_product_interest';
          transition.confidence = 0.8;
        }
        break;

      case this.conversationStates.PRODUCT_INTEREST:
        if (intentAnalysis.hasPersonalInfo || extractedInfo.hasAnyInfo) {
          transition.shouldTransition = true;
          transition.newState = this.conversationStates.GENTLE_INFO_GATHERING;
          transition.type = 'to_gentle_gathering';
          transition.extractedInfo = extractedInfo;
          transition.confidence = 0.7;
        }
        break;

      case this.conversationStates.GENTLE_INFO_GATHERING:
        const completeness = this.checkInfoCompleteness({...userData, ...extractedInfo});
        if (completeness.completionRate >= 0.75) {
          transition.shouldTransition = true;
          transition.newState = this.conversationStates.ACTIVE_ORDER_PROCESS;
          transition.type = 'to_active_order';
          transition.extractedInfo = extractedInfo;
          transition.confidence = 0.9;
        } else if (extractedInfo.hasAnyInfo) {
          // البقاء في نفس الحالة مع تحديث المعلومات
          transition.shouldTransition = true;
          transition.newState = this.conversationStates.GENTLE_INFO_GATHERING;
          transition.type = 'update_info';
          transition.extractedInfo = extractedInfo;
          transition.confidence = 0.6;
        }
        break;

      case this.conversationStates.ACTIVE_ORDER_PROCESS:
        // الانتقال للوكيل الذكي بالكامل
        transition.shouldTransition = true;
        transition.newState = this.conversationStates.ORDER_FINALIZATION;
        transition.type = 'to_intelligent_agent';
        transition.confidence = 1.0;
        break;
    }

    return transition;
  }

  // معالجة الرسالة مع الانتقال الذكي
  async processMessageWithTransition(phoneNumber, message, whatsappClient, customerInfo) {
    try {
      // تحليل نقطة الانتقال
      const transitionAnalysis = await this.analyzeTransitionPoint(phoneNumber, message, customerInfo);
      
      if (!transitionAnalysis.shouldTransition) {
        // معالجة عادية بالـ AI
        return await aiEnhanced.analyzeMessageWithAI(message, customerInfo);
      }

      // تنفيذ الانتقال
      return await this.executeTransition(
        phoneNumber, 
        message, 
        transitionAnalysis, 
        whatsappClient, 
        customerInfo
      );

    } catch (error) {
      console.error('Error in smart transition:', error);
      // العودة للـ AI العادي في حالة الخطأ
      return await aiEnhanced.analyzeMessageWithAI(message, customerInfo);
    }
  }

  // تنفيذ الانتقال
  async executeTransition(phoneNumber, message, analysis, whatsappClient, customerInfo) {
    const conversation = conversationManager.getConversation(phoneNumber);
    
    // تحديث البيانات المستخرجة
    const updatedUserData = {
      ...conversation.userData,
      ...analysis.extractedInfo
    };

    // تحديث حالة المحادثة
    conversationManager.updateConversationState(
      phoneNumber, 
      analysis.newState, 
      updatedUserData
    );

    switch (analysis.transitionType) {
      case 'to_product_interest':
        return await this.handleProductInterestTransition(phoneNumber, analysis.language, updatedUserData);

      case 'to_gentle_gathering':
        return await this.handleGentleGatheringTransition(phoneNumber, analysis.language, updatedUserData);

      case 'update_info':
        return await this.handleInfoUpdateTransition(phoneNumber, analysis.language, updatedUserData);

      case 'to_active_order':
        return await this.handleActiveOrderTransition(phoneNumber, analysis.language, updatedUserData);

      case 'to_intelligent_agent':
        // انتقال كامل للوكيل الذكي
        return await intelligentAgent.processMessage(phoneNumber, message, whatsappClient);

      default:
        // معالجة افتراضية
        return await aiEnhanced.analyzeMessageWithAI(message, customerInfo);
    }
  }

  // معالجة انتقال الاهتمام بالمنتج
  async handleProductInterestTransition(phoneNumber, language, userData) {
    const response = this.getRandomResponse(language, 'gentle_interest');
    
    return {
      analysis: { language, intent: { productInterest: true } },
      response: response,
      aiGenerated: false,
      smartTransition: true,
      transitionType: 'product_interest'
    };
  }

  // معالجة انتقال الجمع اللطيف للمعلومات
  async handleGentleGatheringTransition(phoneNumber, language, userData) {
    const missingInfo = this.identifyMissingInfo(userData);
    const nextInfoToAsk = missingInfo[0]; // أول معلومة ناقصة
    
    let response;
    
    if (nextInfoToAsk === 'city' && userData.name) {
      response = this.getRandomResponse(language, 'collect_city', { name: userData.name });
    } else if (nextInfoToAsk === 'address' && userData.name && userData.city) {
      response = this.getRandomResponse(language, 'collect_address', { 
        name: userData.name, 
        city: userData.city 
      });
    } else {
      // رد عام مع شكر على المعلومات المقدمة
      response = this.generateThankAndAskResponse(language, userData, nextInfoToAsk);
    }

    return {
      analysis: { language, intent: { infoCollection: true } },
      response: response,
      aiGenerated: false,
      smartTransition: true,
      transitionType: 'gentle_gathering',
      nextInfoNeeded: nextInfoToAsk
    };
  }

  // معالجة تحديث المعلومات
  async handleInfoUpdateTransition(phoneNumber, language, userData) {
    const completeness = this.checkInfoCompleteness(userData);
    const nextInfo = this.identifyMissingInfo(userData)[0];
    
    // رد يشكر على المعلومة الجديدة ويطلب التالية بلطف
    const response = this.generateProgressResponse(language, userData, completeness, nextInfo);
    
    return {
      analysis: { language, intent: { infoUpdate: true } },
      response: response,
      aiGenerated: false,
      smartTransition: true,
      transitionType: 'info_update',
      completionRate: completeness.completionRate
    };
  }

  // معالجة انتقال الطلب النشط
  async handleActiveOrderTransition(phoneNumber, language, userData) {
    // هنا نبدأ التحضير للانتقال للوكيل الذكي
    const response = this.generatePreOrderSummary(language, userData);
    
    return {
      analysis: { language, intent: { orderReady: true } },
      response: response,
      aiGenerated: false,
      smartTransition: true,
      transitionType: 'pre_order',
      readyForAgent: true
    };
  }

  // دوال مساعدة

  detectLanguage(text) {
    // نفس منطق ai-enhanced.js
    const darijaPatterns = [
      /\b(wach|wash|labas|bghit|khoya|sahbi|mrhba|fin|feen|chno|nta|nti|dyal|mashi|kifash|wakha)\b/i
    ];
    
    const hasArabic = /[\u0600-\u06FF]/;
    const hasFrench = /[éèêëàâäôöùûüÿçîï]/i;
    const hasDarija = darijaPatterns.some(pattern => pattern.test(text.toLowerCase()));
    
    if (hasDarija) return 'darija';
    if (hasArabic.test(text)) return 'arabic';
    if (hasFrench.test(text)) return 'french';
    
    return 'darija';
  }

  hasName(message) {
    return /(?:اسمي|سميتي|انا|je m'appelle|my name|اسم)/i.test(message);
  }

  hasCity(message) {
    const cities = ['الدار البيضاء', 'كازا', 'الرباط', 'فاس', 'مراكش', 'casablanca', 'rabat'];
    return cities.some(city => message.toLowerCase().includes(city.toLowerCase()));
  }

  hasPhone(message) {
    return /(?:\+212|0)[67]\d{8}/.test(message);
  }

  hasAddress(message) {
    return /(?:شارع|زنقة|حي|دوار|rue|avenue|street)/i.test(message);
  }

  extractInfoFromMessage(message) {
    const info = {
      hasAnyInfo: false
    };

    // استخراج الاسم
    const nameMatch = message.match(/(?:اسمي|سميتي|انا|je m'appelle)\s+([^\d\n,]{2,30})/i);
    if (nameMatch) {
      info.name = nameMatch[1].trim();
      info.hasAnyInfo = true;
    }

    // استخراج المدينة
    const cities = [
      { patterns: ['الدار البيضاء', 'كازا', 'casablanca'], standard: 'الدار البيضاء' },
      { patterns: ['الرباط', 'rabat'], standard: 'الرباط' },
      { patterns: ['فاس', 'fes'], standard: 'فاس' },
      { patterns: ['مراكش', 'marrakech'], standard: 'مراكش' }
    ];

    for (const cityGroup of cities) {
      if (cityGroup.patterns.some(pattern => 
        message.toLowerCase().includes(pattern.toLowerCase())
      )) {
        info.city = cityGroup.standard;
        info.hasAnyInfo = true;
        break;
      }
    }

    // استخراج رقم الهاتف
    const phoneMatch = message.match(/(?:\+212|0)([67]\d{8})/);
    if (phoneMatch) {
      info.phoneNumber = '+212' + phoneMatch[1];
      info.hasAnyInfo = true;
    }

    return info;
  }

  checkInfoCompleteness(userData) {
    const required = ['name', 'city', 'phoneNumber'];
    const completed = required.filter(field => userData[field] && userData[field].trim() !== '');
    
    return {
      completionRate: completed.length / required.length,
      completed: completed,
      missing: required.filter(field => !completed.includes(field))
    };
  }

  identifyMissingInfo(userData) {
    const priorities = ['name', 'city', 'phoneNumber', 'address'];
    return priorities.filter(field => !userData[field] || userData[field].trim() === '');
  }

  getRandomResponse(language, type, variables = {}) {
    const templates = this.transitionResponses[language] || this.transitionResponses.darija;
    const responses = templates[type] || ['شكراً!'];
    
    let response = responses[Math.floor(Math.random() * responses.length)];
    
    // استبدال المتغيرات
    Object.keys(variables).forEach(key => {
      response = response.replace(new RegExp(`{${key}}`, 'g'), variables[key]);
    });
    
    return response;
  }

  generateThankAndAskResponse(language, userData, nextInfo) {
    const templates = {
      arabic: {
        name: "شكراً! ما اسمك الكريم؟",
        city: "ممتاز! من أي مدينة أنت؟",
        phoneNumber: "رائع! ما رقم هاتفك للتواصل؟",
        address: "جميل! ما عنوانك للتوصيل؟"
      },
      darija: {
        name: "شكرا! أش سميتك؟",
        city: "مزيان! فين ساكن؟", 
        phoneNumber: "واخا! أش رقم التيليفون ديالك؟",
        address: "تمام! أش هو العنوان ديالك؟"
      },
      french: {
        name: "Merci! Quel est votre nom?",
        city: "Parfait! Dans quelle ville habitez-vous?",
        phoneNumber: "Excellent! Quel est votre numéro de téléphone?",
        address: "Génial! Quelle est votre adresse?"
      }
    };
    
    return templates[language]?.[nextInfo] || templates.darija[nextInfo] || "شكراً!";
  }

  generateProgressResponse(language, userData, completeness, nextInfo) {
    const percentage = Math.round(completeness.completionRate * 100);
    
    const templates = {
      arabic: [
        `ممتاز! جمعنا ${percentage}% من المعلومات المطلوبة. `,
        `رائع! نحن في الطريق الصحيح (${percentage}% مكتمل). `,
        `شكراً! ${percentage}% جاهز. `
      ],
      darija: [
        `زوين! جمعنا ${percentage}% من المعلومات. `,
        `مزيان! احنا فالطريق الصحيح (${percentage}% كمل). `,
        `شكرا! ${percentage}% وجد. `
      ],
      french: [
        `Parfait! Nous avons ${percentage}% des informations. `,
        `Excellent! Nous sommes sur la bonne voie (${percentage}% complété). `,
        `Merci! ${percentage}% prêt. `
      ]
    };
    
    const progressMessage = templates[language]?.[0] || templates.darija[0];
    const nextQuestion = this.generateThankAndAskResponse(language, userData, nextInfo);
    
    return progressMessage + nextQuestion;
  }

  generatePreOrderSummary(language, userData) {
    const templates = {
      arabic: `ممتاز ${userData.name || 'عزيزي العميل'}! لدينا تقريباً كل ما نحتاجه:
• الاسم: ${userData.name || 'محدد'}
• المدينة: ${userData.city || 'محدد'}
• الهاتف: ${userData.phoneNumber || 'محدد'}

هل أنت مستعد لإتمام الطلب؟`,
      
      darija: `تمام ${userData.name || 'صاحبي'}! عندنا تقريبا كلشي:
• السمية: ${userData.name || 'معروف'}
• المدينة: ${userData.city || 'معروف'}  
• التيليفون: ${userData.phoneNumber || 'معروف'}

واش مستعد نكملو الطلبية؟`,
      
      french: `Parfait ${userData.name || 'cher client'}! Nous avons presque tout:
• Nom: ${userData.name || 'défini'}
• Ville: ${userData.city || 'définie'}
• Téléphone: ${userData.phoneNumber || 'défini'}

Êtes-vous prêt à finaliser la commande?`
    };
    
    return templates[language] || templates.darija;
  }

  // واجهة عامة للاستخدام في النظام
  async processMessage(phoneNumber, message, whatsappClient, customerInfo = {}) {
    return await this.processMessageWithTransition(phoneNumber, message, whatsappClient, customerInfo);
  }

  // إحصائيات التحسين
  getTransitionStats() {
    const stats = conversationManager.getConversationStats();
    
    // إضافة إحصائيات خاصة بالانتقالات
    let transitionCounts = {
      to_product_interest: 0,
      to_gentle_gathering: 0,
      to_active_order: 0,
      to_intelligent_agent: 0
    };

    // فحص المحادثات للحصول على إحصائيات الانتقال
    for (const conversation of conversationManager.conversations.values()) {
      if (conversation.state === this.conversationStates.PRODUCT_INTEREST) {
        transitionCounts.to_product_interest++;
      } else if (conversation.state === this.conversationStates.GENTLE_INFO_GATHERING) {
        transitionCounts.to_gentle_gathering++;
      } else if (conversation.state === this.conversationStates.ACTIVE_ORDER_PROCESS) {
        transitionCounts.to_active_order++;
      } else if (conversation.state === this.conversationStates.ORDER_FINALIZATION) {
        transitionCounts.to_intelligent_agent++;
      }
    }

    return {
      ...stats,
      transitions: transitionCounts,
      efficiency: {
        averageStepsToOrder: this.calculateAverageStepsToOrder(),
        naturalTransitionRate: this.calculateNaturalTransitionRate()
      }
    };
  }

  calculateAverageStepsToOrder() {
    let totalSteps = 0;
    let completedOrders = 0;

    for (const conversation of conversationManager.conversations.values()) {
      if (conversation.state === this.conversationStates.ORDER_FINALIZATION || 
          conversation.state === this.conversationStates.COMPLETED) {
        totalSteps += conversation.metadata.messageCount;
        completedOrders++;
      }
    }

    return completedOrders > 0 ? Math.round(totalSteps / completedOrders) : 0;
  }

  calculateNaturalTransitionRate() {
    const totalConversations = conversationManager.conversations.size;
    if (totalConversations === 0) return 0;

    let naturalTransitions = 0;
    for (const conversation of conversationManager.conversations.values()) {
      if (conversation.state !== this.conversationStates.CASUAL_CHAT) {
        naturalTransitions++;
      }
    }

    return Math.round((naturalTransitions / totalConversations) * 100);
  }
}

module.exports = new AIAgentBridge();