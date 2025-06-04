// services/intelligent-agent.js - Enhanced version with Google Sheets integration
const conversationManager = require('./conversation-manager');
const { extractClientInfoWithGemini } = require('./ai-client-extraction');
const googleSheetsService = require('./google-sheets');
const axios = require('axios');

class IntelligentAgent {
  constructor() {
    this.geminiConfig = {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'AIzaSyBqGyqagvCy9TVQVrLzuma70YexC5BDsK8',
      GEMINI_API_URL: process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
    };

    // حالات المحادثة مع إضافة حالات جديدة للتأكيد
    this.conversationStates = {
      GREETING: 'greeting',
      PRODUCT_INQUIRY: 'product_inquiry',
      INFO_COLLECTION: 'info_collection',
      INFO_CONFIRMATION: 'info_confirmation', // جديد
      PHONE_CONFIRMATION: 'phone_confirmation', // جديد
      ORDER_CONFIRMATION: 'order_confirmation', // جديد
      COMPLETED: 'completed',
      IDLE: 'idle'
    };

    // رسائل ديناميكية حسب اللغة والسياق
    this.responseTemplates = {
      arabic: {
        greeting: [
          "أهلاً وسهلاً! كيف يمكنني مساعدتك اليوم؟",
          "مرحبًا بك! أنا هنا لمساعدتك، ما الذي تبحث عنه؟",
          "السلام عليكم! يسعدني خدمتك، كيف يمكنني المساعدة؟"
        ],
        askName: [
          "حتى أتمكن من خدمتك بشكل أفضل، هل يمكنك إخباري باسمك؟",
          "ما اسمك الكريم حتى أخاطبك باسمك؟",
          "لو سمحت، ما اسمك؟"
        ],
        askCity: [
          "وما هي مدينتك؟",
          "في أي مدينة تقيم؟",
          "من أي مدينة أنت؟"
        ],
        askAddress: [
          "هل يمكنك إعطائي عنوانك الكامل للتوصيل؟",
          "ما هو عنوانك بالتفصيل حتى نتمكن من التوصيل؟",
          "أحتاج عنوان التوصيل الكامل من فضلك"
        ],
        askPhoneConfirmation: [
          "هل رقم الهاتف {phone} صحيح للتواصل معك؟",
          "سنتصل بك على الرقم {phone}، هل هذا صحيح؟",
          "للتأكيد، هل يمكننا الاتصال بك على {phone}؟"
        ],
        askAlternativePhone: [
          "هل لديك رقم هاتف آخر يمكننا الاتصال عليه؟",
          "ما هو الرقم الأفضل للاتصال بك؟",
          "أعطني رقم الهاتف الذي تفضل أن نتصل عليه"
        ],
        confirmOrder: [
          "ممتاز {name}! دعني أؤكد معلوماتك:\n📋 الاسم: {name}\n🏙️ المدينة: {city}\n📍 العنوان: {address}\n📱 الهاتف: {phone}\n💰 السعر: {price}\n\nهل هذه المعلومات صحيحة؟ (نعم/لا)",
          "تمام {name}! قبل إتمام الطلب:\n• الاسم: {name}\n• المدينة: {city}\n• العنوان: {address}\n• رقم الهاتف: {phone}\n• السعر: {price}\n\nكل شيء صحيح؟",
          "شكراً {name}! معلومات الطلب:\n✅ الاسم: {name}\n✅ المدينة: {city}\n✅ العنوان: {address}\n✅ الهاتف: {phone}\n✅ السعر: {price}\n\nموافق على المعلومات؟"
        ],
        finalConfirmation: [
          "ممتاز {name}! تم حفظ طلبك بنجاح 🎉\n\nسيتواصل معك فريق التوصيل خلال 24 ساعة على الرقم {phone} لتأكيد الطلب والتوصيل.\n\nشكراً لثقتك بنا! 💚",
          "تم استلام طلبك بنجاح {name}! 🎊\n\nالفريق سيتصل بك على {phone} خلال يوم واحد لترتيب التوصيل.\n\nنتطلع لخدمتك! 🌟",
          "شكراً لك {name}! طلبك مسجل ✅\n\nسنتواصل معك على {phone} قريباً لتأكيد التوصيل.\n\nأهلاً وسهلاً بك دائماً! 😊"
        ]
      },
      darija: {
        greeting: [
          "أهلا وسهلا! كيفاش نقدر نعاونك اليوم؟",
          "مرحبا بيك! أنا هنا باش نعاونك، أش كتبغي؟",
          "سلام عليكم! فرحانين بيك، كيفاش نقدر نخدمك؟"
        ],
        askName: [
          "باش نقدر نخدمك بشكل أحسن، واش ممكن تعطيني سميتك؟",
          "أش هي سميتك باش نناديك بيها؟",
          "عافاك، أش سميتك؟"
        ],
        askCity: [
          "وفين ساكن؟",
          "من أي مدينة نتا؟",
          "فين كاين؟"
        ],
        askAddress: [
          "واش ممكن تعطيني العنوان كامل باش نوصلوليك؟",
          "أش هو العنوان ديالك بالتفصيل؟",
          "بغيت العنوان كامل باش ما نضيعوش"
        ],
        askPhoneConfirmation: [
          "الرقم ديالك {phone} هو اللي غانتصلو عليه، مزيان؟",
          "غانتواصلو معاك على {phone}، واخا؟",
          "باش نتأكدو، الرقم {phone} صحيح؟"
        ],
        askAlternativePhone: [
          "واش عندك شي رقم آخر نقدرو نتصلو عليه؟",
          "أش هو الرقم اللي تفضل نتصلو عليه؟",
          "عطيني الرقم اللي كتبغي نتصلو عليه"
        ],
        confirmOrder: [
          "زوين {name}! خليني نتأكد من المعلومات:\n📋 السمية: {name}\n🏙️ المدينة: {city}\n📍 العنوان: {address}\n📱 التيليفون: {phone}\n💰 الثمن: {price}\n\nكلشي مزيان؟ (أيه/لا)",
          "واخا {name}! قبل ما نكملو:\n• السمية: {name}\n• المدينة: {city}\n• العنوان: {address}\n• الرقم: {phone}\n• الثمن: {price}\n\nموافق على كلشي؟",
          "شكرا {name}! معلومات الطلبية:\n✅ السمية: {name}\n✅ المدينة: {city}\n✅ العنوان: {address}\n✅ التيليفون: {phone}\n✅ الثمن: {price}\n\nكلشي صحيح؟"
        ],
        finalConfirmation: [
          "ممتاز {name}! تسجلات الطلبية ديالك بنجاح 🎉\n\nالفريق ديالنا غادي يتواصل معاك خلال 24 ساعة على الرقم {phone} باش يأكدليك الطلبية والتوصيل.\n\nشكرا على الثقة ديالك فينا! 💚",
          "تمت الطلبية ديالك {name}! 🎊\n\nغانتصلو بيك على {phone} خلال نهار واحد باش نرتبو التوصيل.\n\nمتشوقين نخدموك! 🌟",
          "شكرا ليك {name}! الطلبية مسجلة ✅\n\nغانتواصلو معاك على {phone} قريبا باش نأكدو التوصيل.\n\nأهلا وسهلا بيك ديما! 😊"
        ]
      },
      french: {
        greeting: [
          "Bonjour ! Comment puis-je vous aider aujourd'hui ?",
          "Salut ! Je suis là pour vous aider, que recherchez-vous ?",
          "Bonjour ! Je suis ravi de vous servir, comment puis-je vous aider ?"
        ],
        askName: [
          "Pour mieux vous servir, pourriez-vous me dire votre nom ?",
          "Quel est votre nom pour que je puisse vous appeler par votre nom ?",
          "S'il vous plaît, quel est votre nom ?"
        ],
        askCity: [
          "Et dans quelle ville habitez-vous ?",
          "Dans quelle ville résidez-vous ?",
          "De quelle ville êtes-vous ?"
        ],
        askAddress: [
          "Pouvez-vous me donner votre adresse complète pour la livraison ?",
          "Quelle est votre adresse détaillée pour que nous puissions livrer ?",
          "J'ai besoin de votre adresse complète de livraison"
        ],
        askPhoneConfirmation: [
          "Le numéro {phone} est-il correct pour vous contacter ?",
          "Nous vous appellerons au {phone}, est-ce correct ?",
          "Pour confirmer, pouvons-nous vous appeler au {phone} ?"
        ],
        askAlternativePhone: [
          "Avez-vous un autre numéro de téléphone que nous pouvons appeler ?",
          "Quel est le meilleur numéro pour vous contacter ?",
          "Donnez-moi le numéro sur lequel vous préférez qu'on vous appelle"
        ],
        confirmOrder: [
          "Parfait {name} ! Laissez-moi confirmer vos informations :\n📋 Nom : {name}\n🏙️ Ville : {city}\n📍 Adresse : {address}\n📱 Téléphone : {phone}\n💰 Prix : {price}\n\nCes informations sont-elles correctes ? (oui/non)",
          "Très bien {name} ! Avant de finaliser :\n• Nom : {name}\n• Ville : {city}\n• Adresse : {address}\n• Téléphone : {phone}\n• Prix : {price}\n\nTout est correct ?",
          "Merci {name} ! Informations de commande :\n✅ Nom : {name}\n✅ Ville : {city}\n✅ Adresse : {address}\n✅ Téléphone : {phone}\n✅ Prix : {price}\n\nD'accord avec les informations ?"
        ],
        finalConfirmation: [
          "Excellent {name} ! Votre commande a été enregistrée avec succès 🎉\n\nNotre équipe de livraison vous contactera dans les 24 heures au {phone} pour confirmer la commande et la livraison.\n\nMerci de votre confiance ! 💚",
          "Commande reçue avec succès {name} ! 🎊\n\nL'équipe vous appellera au {phone} dans un jour pour organiser la livraison.\n\nNous avons hâte de vous servir ! 🌟",
          "Merci {name} ! Votre commande est enregistrée ✅\n\nNous vous contacterons au {phone} bientôt pour confirmer la livraison.\n\nBienvenue chez nous ! 😊"
        ]
      }
    };

    // معلومات المنتج الافتراضية
    this.defaultProduct = {
      name: "ÉCLORA - منتج العناية الطبيعي",
      price: "299 MAD",
      pack: "Pack Premium"
    };
  }

  // تحديد اللغة من النص
  detectLanguage(text) {
    const arabicPattern = /[\u0600-\u06FF]/;
    const frenchPattern = /[éèêëàâäôöùûüÿçîïÉÈÊËÀÂÄÔÖÙÛÜŸÇÎÏ]/;
    
    const darijaPatterns = [
      /\b(wach|wash|labas|bghit|khoya|sahbi|mrhba|fin|feen|chno|wa|hna|fash|kayn|nta|nti|dyal|mashi|kifash|wakha)\b/i,
      /\b(m3a|3nd|l9it|mzyan|hadshi|bzaf|flous|atay|ch7al|shhal|b7al|ghadi|ndir|sawb|f7al|dyali|dyalna)\b/i
    ];
    
    const hasDarijaWords = darijaPatterns.some(pattern => pattern.test(text.toLowerCase()));
    
    if (hasDarijaWords || (arabicPattern.test(text) && /[0-9]/.test(text))) {
      return 'darija';
    }
    
    if (arabicPattern.test(text)) return 'arabic';
    if (frenchPattern.test(text)) return 'french';
    
    return 'darija'; // افتراضي
  }

  // الحصول على رسالة عشوائية من القالب
  getRandomResponse(language, type, variables = {}) {
    const templates = this.responseTemplates[language] || this.responseTemplates.darija;
    const responses = templates[type] || ['مرحبا!'];
    
    let response = responses[Math.floor(Math.random() * responses.length)];
    
    // استبدال المتغيرات
    Object.keys(variables).forEach(key => {
      response = response.replace(new RegExp(`{${key}}`, 'g'), variables[key]);
    });
    
    return response;
  }

  // استخراج معلومات العميل من الرسالة
  async extractClientInfo(message, phoneNumber) {
    try {
      const result = await extractClientInfoWithGemini(message, this.geminiConfig);
      
      if (result.success) {
        // إذا لم يكن هناك رقم هاتف في النص، استخدم رقم WhatsApp
        if (!result.phoneNumber) {
          result.phoneNumber = phoneNumber;
        }
        
        return {
          success: true,
          name: result.name,
          city: result.city,
          address: result.address || null,
          phoneNumber: result.phoneNumber,
          confidence: result.confidence || 'medium',
          missingInfo: result.missingInfo || []
        };
      }
      
      return { success: false, reason: 'extraction_failed' };
    } catch (error) {
      console.error('Error extracting client info:', error);
      return { success: false, reason: 'error', error: error.message };
    }
  }

  // التحقق من اكتمال المعلومات
  checkInfoCompleteness(clientInfo) {
    const missing = [];
    
    if (!clientInfo.name || clientInfo.name.trim() === '') missing.push('name');
    if (!clientInfo.city || clientInfo.city.trim() === '') missing.push('city');
    if (!clientInfo.address || clientInfo.address.trim() === '') missing.push('address');
    if (!clientInfo.phoneNumber || clientInfo.phoneNumber.trim() === '') missing.push('phoneNumber');
    
    return {
      isComplete: missing.length === 0,
      missing: missing
    };
  }

  // طلب المعلومات الناقصة
  async requestMissingInfo(phoneNumber, missingInfo, language, whatsappClient) {
    const templates = this.responseTemplates[language] || this.responseTemplates.darija;
    
    let message = '';
    if (missingInfo.includes('name')) {
      message = this.getRandomResponse(language, 'askName');
    } else if (missingInfo.includes('city')) {
      message = this.getRandomResponse(language, 'askCity');
    } else if (missingInfo.includes('address')) {
      message = this.getRandomResponse(language, 'askAddress');
    }
    
    if (message) {
      await this.sendMessage(phoneNumber, message, whatsappClient);
      return true;
    }
    
    return false;
  }

  // تأكيد رقم الهاتف
  async confirmPhoneNumber(phoneNumber, extractedPhone, language, whatsappClient) {
    const phoneToConfirm = extractedPhone || phoneNumber;
    
    // إذا كان الرقم المستخرج مختلف عن رقم WhatsApp، اطلب التأكيد
    if (extractedPhone && extractedPhone !== phoneNumber) {
      const message = this.getRandomResponse(language, 'askPhoneConfirmation', {
        phone: extractedPhone
      });
      await this.sendMessage(phoneNumber, message, whatsappClient);
      return false; // انتظار التأكيد
    }
    
    // إذا كان نفس الرقم، اطلب رقم بديل للتأكد
    const message = this.getRandomResponse(language, 'askAlternativePhone');
    await this.sendMessage(phoneNumber, message, whatsappClient);
    return false; // انتظار الرد
  }

  // تأكيد الطلب قبل الإرسال
  async confirmOrder(phoneNumber, clientInfo, language, whatsappClient) {
    const message = this.getRandomResponse(language, 'confirmOrder', {
      name: clientInfo.name,
      city: clientInfo.city,
      address: clientInfo.address,
      phone: clientInfo.phoneNumber,
      price: this.defaultProduct.price
    });
    
    await this.sendMessage(phoneNumber, message, whatsappClient);
  }

  // إرسال البيانات إلى Google Sheets
  async sendToGoogleSheets(clientInfo) {
    try {
      const sheetData = {
        name: clientInfo.name,
        city: clientInfo.city,
        address: clientInfo.address,
        phoneNumber: clientInfo.phoneNumber,
        pack: this.defaultProduct.pack,
        prix: this.defaultProduct.price,
        notes: `تم جمع البيانات تلقائياً بواسطة الذكاء الاصطناعي في ${new Date().toLocaleString('ar-EG')}`
      };
      
      console.log('📊 Sending client data to Google Sheets:', sheetData);
      
      const result = await googleSheetsService.addClientToSheet(sheetData);
      
      if (result.success) {
        console.log('✅ Client data sent to Google Sheets successfully');
        return { success: true, data: sheetData };
      } else {
        console.error('❌ Failed to send to Google Sheets:', result.message);
        return { success: false, error: result.message };
      }
    } catch (error) {
      console.error('❌ Error sending to Google Sheets:', error);
      return { success: false, error: error.message };
    }
  }

  // إتمام العملية وإرسال رسالة التأكيد النهائية
  async completeOrder(phoneNumber, clientInfo, language, whatsappClient) {
    // إرسال البيانات إلى Google Sheets
    const sheetResult = await this.sendToGoogleSheets(clientInfo);
    
    if (sheetResult.success) {
      // إرسال رسالة التأكيد النهائية
      const finalMessage = this.getRandomResponse(language, 'finalConfirmation', {
        name: clientInfo.name,
        phone: clientInfo.phoneNumber
      });
      
      await this.sendMessage(phoneNumber, finalMessage, whatsappClient);
      
      // تحديث الحالة إلى مكتملة
      conversationManager.updateConversationState(phoneNumber, this.conversationStates.COMPLETED, {
        orderCompleted: true,
        sheetsSent: true,
        completionTime: new Date()
      });
      
      console.log(`✅ Order completed successfully for ${phoneNumber}`);
      return true;
    } else {
      // في حالة فشل إرسال البيانات
      const errorMessage = language === 'arabic' ? 
        'عذراً، حدث خطأ في حفظ البيانات. سيتواصل معك فريق خدمة العملاء قريباً.' :
        language === 'french' ?
        'Désolé, une erreur s\'est produite lors de la sauvegarde. Notre équipe vous contactera bientôt.' :
        'سماح ليا، كان شي خطأ فحفظ البيانات. الفريق غادي يتواصل معاك قريبا.';
      
      await this.sendMessage(phoneNumber, errorMessage, whatsappClient);
      return false;
    }
  }

  // معالجة الرسالة الرئيسية
  async processMessage(phoneNumber, message, whatsappClient) {
    try {
      const conversation = conversationManager.getConversation(phoneNumber);
      const language = this.detectLanguage(message);
      
      conversationManager.addMessage(phoneNumber, message, 'user');

      console.log(`🤖 Processing message from ${phoneNumber} in state: ${conversation.state}`);

      // معالجة حسب حالة المحادثة
      switch (conversation.state) {
        case this.conversationStates.GREETING:
          return await this.handleGreeting(phoneNumber, message, whatsappClient, language);
          
        case this.conversationStates.PRODUCT_INQUIRY:
          return await this.handleProductInquiry(phoneNumber, message, whatsappClient, language);
          
        case this.conversationStates.INFO_COLLECTION:
          return await this.handleInfoCollection(phoneNumber, message, whatsappClient, language);
          
        case this.conversationStates.INFO_CONFIRMATION:
          return await this.handleInfoConfirmation(phoneNumber, message, whatsappClient, language);
          
        case this.conversationStates.PHONE_CONFIRMATION:
          return await this.handlePhoneConfirmation(phoneNumber, message, whatsappClient, language);
          
        case this.conversationStates.ORDER_CONFIRMATION:
          return await this.handleOrderConfirmation(phoneNumber, message, whatsappClient, language);
          
        case this.conversationStates.COMPLETED:
          return await this.handleCompletedOrder(phoneNumber, message, whatsappClient, language);
          
        default:
          return await this.handleGeneralInquiry(phoneNumber, message, whatsappClient, language);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      return await this.sendErrorMessage(phoneNumber, whatsappClient, this.detectLanguage(message));
    }
  }

  // معالجة التحية
  async handleGreeting(phoneNumber, message, whatsappClient, language) {
    const greeting = this.getRandomResponse(language, 'greeting');
    await this.sendMessage(phoneNumber, greeting, whatsappClient);
    
    conversationManager.updateConversationState(phoneNumber, this.conversationStates.PRODUCT_INQUIRY);
    return true;
  }

  // معالجة الاستفسار عن المنتج
  async handleProductInquiry(phoneNumber, message, whatsappClient, language) {
    // محاولة استخراج معلومات العميل من الرسالة
    const extractedInfo = await this.extractClientInfo(message, phoneNumber);
    
    if (extractedInfo.success) {
      // حفظ المعلومات المستخرجة
      conversationManager.updateConversationState(
        phoneNumber, 
        this.conversationStates.INFO_COLLECTION,
        extractedInfo
      );
      
      // فحص اكتمال المعلومات
      const completeness = this.checkInfoCompleteness(extractedInfo);
      
      if (completeness.isComplete) {
        // الانتقال لتأكيد رقم الهاتف
        conversationManager.updateConversationState(phoneNumber, this.conversationStates.PHONE_CONFIRMATION);
        return await this.confirmPhoneNumber(phoneNumber, extractedInfo.phoneNumber, language, whatsappClient);
      } else {
        // طلب المعلومات الناقصة
        return await this.requestMissingInfo(phoneNumber, completeness.missing, language, whatsappClient);
      }
    }
    
    // إذا لم يتم استخراج معلومات، رد عادي عن المنتج
    const productResponse = language === 'arabic' ?
      `منتجنا ÉCLORA منتج طبيعي عالي الجودة بسعر ${this.defaultProduct.price}. هل تريد طلبه؟` :
      language === 'french' ?
      `Notre produit ÉCLORA est naturel et de haute qualité à ${this.defaultProduct.price}. Voulez-vous le commander ?` :
      `المنتج ديالنا ÉCLORA طبيعي وجودة عالية بـ ${this.defaultProduct.price}. بغيتي تطلبيه؟`;
    
    await this.sendMessage(phoneNumber, productResponse, whatsappClient);
    return true;
  }

  // معالجة جمع المعلومات
  async handleInfoCollection(phoneNumber, message, whatsappClient, language) {
    const conversation = conversationManager.getConversation(phoneNumber);
    
    // محاولة استخراج معلومات إضافية
    const extractedInfo = await this.extractClientInfo(message, phoneNumber);
    
    if (extractedInfo.success) {
      // دمج المعلومات الجديدة مع الموجودة
      const updatedData = {
        ...conversation.userData,
        ...extractedInfo
      };
      
      conversationManager.updateConversationState(phoneNumber, conversation.state, updatedData);
    } else {
      // تحديد المعلومة الناقصة من السياق
      const currentData = conversation.userData;
      
      if (!currentData.name) {
        currentData.name = message.trim();
      } else if (!currentData.city) {
        currentData.city = message.trim();
      } else if (!currentData.address) {
        currentData.address = message.trim();
      }
      
      conversationManager.updateConversationState(phoneNumber, conversation.state, currentData);
    }
    
    // فحص اكتمال المعلومات
    const updatedConversation = conversationManager.getConversation(phoneNumber);
    const completeness = this.checkInfoCompleteness(updatedConversation.userData);
    
    if (completeness.isComplete) {
      // الانتقال لتأكيد رقم الهاتف
      conversationManager.updateConversationState(phoneNumber, this.conversationStates.PHONE_CONFIRMATION);
      return await this.confirmPhoneNumber(phoneNumber, updatedConversation.userData.phoneNumber, language, whatsappClient);
    } else {
      // طلب المعلومة التالية
      return await this.requestMissingInfo(phoneNumber, completeness.missing, language, whatsappClient);
    }
  }

  // معالجة تأكيد رقم الهاتف
  async handlePhoneConfirmation(phoneNumber, message, whatsappClient, language) {
    const conversation = conversationManager.getConversation(phoneNumber);
    const cleanMessage = message.toLowerCase().trim();
    
    // تحليل الرد للتأكيد أو رقم جديد
    const isConfirmation = this.isPositiveResponse(cleanMessage, language);
    const isNegative = this.isNegativeResponse(cleanMessage, language);
    const hasPhoneNumber = this.extractPhoneNumber(message);
    
    if (hasPhoneNumber) {
      // تم تقديم رقم هاتف جديد
      const updatedData = {
        ...conversation.userData,
        phoneNumber: hasPhoneNumber
      };
      
      conversationManager.updateConversationState(phoneNumber, this.conversationStates.ORDER_CONFIRMATION, updatedData);
      return await this.confirmOrder(phoneNumber, updatedData, language, whatsappClient);
      
    } else if (isConfirmation) {
      // تأكيد الرقم الحالي
      conversationManager.updateConversationState(phoneNumber, this.conversationStates.ORDER_CONFIRMATION);
      return await this.confirmOrder(phoneNumber, conversation.userData, language, whatsappClient);
      
    } else if (isNegative) {
      // رفض الرقم، طلب رقم بديل
      const message = this.getRandomResponse(language, 'askAlternativePhone');
      await this.sendMessage(phoneNumber, message, whatsappClient);
      return true;
      
    } else {
      // غير واضح، إعادة السؤال
      const message = this.getRandomResponse(language, 'askPhoneConfirmation', {
        phone: conversation.userData.phoneNumber
      });
      await this.sendMessage(phoneNumber, message, whatsappClient);
      return true;
    }
  }

  // معالجة تأكيد الطلب
  async handleOrderConfirmation(phoneNumber, message, whatsappClient, language) {
    const conversation = conversationManager.getConversation(phoneNumber);
    const cleanMessage = message.toLowerCase().trim();
    
    const isConfirmation = this.isPositiveResponse(cleanMessage, language);
    const isNegative = this.isNegativeResponse(cleanMessage, language);
    
    if (isConfirmation) {
      // تأكيد الطلب - إرسال البيانات إلى Google Sheets
      return await this.completeOrder(phoneNumber, conversation.userData, language, whatsappClient);
      
    } else if (isNegative) {
      // إلغاء الطلب أو طلب تعديل
      const cancelMessage = language === 'arabic' ?
        'لا مشكلة، هل تريد تعديل المعلومات أم إلغاء الطلب؟' :
        language === 'french' ?
        'Pas de problème, voulez-vous modifier les informations ou annuler la commande ?' :
        'ماشي مشكل، بغيتي تعدلي المعلومات ولا تلغي الطلبية؟';
        
      await this.sendMessage(phoneNumber, cancelMessage, whatsappClient);
      
      // العودة لحالة جمع المعلومات
      conversationManager.updateConversationState(phoneNumber, this.conversationStates.INFO_COLLECTION);
      return true;
      
    } else {
      // غير واضح، إعادة السؤال
      await this.confirmOrder(phoneNumber, conversation.userData, language, whatsappClient);
      return true;
    }
  }

  // معالجة الطلبات المكتملة
  async handleCompletedOrder(phoneNumber, message, whatsappClient, language) {
    // رد بسيط للطلبات المكتملة
    const completedMessage = language === 'arabic' ?
      'شكراً لك! طلبك مسجل وسيتم التواصل معك قريباً. هل تحتاج مساعدة في شيء آخر؟' :
      language === 'french' ?
      'Merci ! Votre commande est enregistrée et nous vous contacterons bientôt. Avez-vous besoin d\'aide pour autre chose ?' :
      'شكرا ليك! الطلبية مسجلة وغانتواصلو معاك قريبا. واش محتاج مساعدة في شي حاجة أخرى؟';
    
    await this.sendMessage(phoneNumber, completedMessage, whatsappClient);
    return true;
  }

  // معالجة الاستفسارات العامة
  async handleGeneralInquiry(phoneNumber, message, whatsappClient, language) {
    const generalResponse = language === 'arabic' ?
      'أهلاً بك! كيف يمكنني مساعدتك اليوم؟' :
      language === 'french' ?
      'Bonjour ! Comment puis-je vous aider aujourd\'hui ?' :
      'أهلا بيك! كيفاش نقدر نعاونك اليوم؟';
    
    await this.sendMessage(phoneNumber, generalResponse, whatsappClient);
    
    conversationManager.updateConversationState(phoneNumber, this.conversationStates.PRODUCT_INQUIRY);
    return true;
  }

  // إرسال رسالة خطأ
  async sendErrorMessage(phoneNumber, whatsappClient, language) {
    const errorMessage = language === 'arabic' ?
      'عذراً، حدث خطأ تقني. سيتواصل معك فريق الخدمة قريباً.' :
      language === 'french' ?
      'Désolé, une erreur technique s\'est produite. Notre équipe vous contactera bientôt.' :
      'سماح ليا، كان شي خطأ تقني. الفريق غادي يتواصل معاك قريبا.';
    
    await this.sendMessage(phoneNumber, errorMessage, whatsappClient);
  }

  // دوال مساعدة

  // التحقق من الرد الإيجابي
  isPositiveResponse(message, language) {
    const positivePatterns = {
      arabic: ['نعم', 'أيوة', 'صحيح', 'مزبوط', 'تمام', 'موافق', 'أوكي'],
      darija: ['أيه', 'واخا', 'مزيان', 'صحيح', 'تمام', 'موافق', 'اوكي'],
      french: ['oui', 'ok', 'okay', 'd\'accord', 'correct', 'exacte', 'parfait'],
      general: ['yes', 'نعم', 'ok', 'اوك', '👍', '✅']
    };
    
    const patterns = [
      ...positivePatterns[language] || [],
      ...positivePatterns.general
    ];
    
    return patterns.some(pattern => message.includes(pattern.toLowerCase()));
  }

  // التحقق من الرد السلبي
  isNegativeResponse(message, language) {
    const negativePatterns = {
      arabic: ['لا', 'خطأ', 'غلط', 'مش صحيح', 'مش مزبوط'],
      darija: ['لا', 'ماشي', 'غلط', 'ماشي صحيح', 'ماشي مزيان'],
      french: ['non', 'pas', 'incorrect', 'faux', 'erreur'],
      general: ['no', 'لا', '❌', '👎']
    };
    
    const patterns = [
      ...negativePatterns[language] || [],
      ...negativePatterns.general
    ];
    
    return patterns.some(pattern => message.includes(pattern.toLowerCase()));
  }

  // استخراج رقم الهاتف من النص
  extractPhoneNumber(message) {
    const phoneRegex = /(?:(?:\+|00)212|0)?\s*([67]\d{8})/g;
    const match = message.match(phoneRegex);
    
    if (match && match.length > 0) {
      let phone = match[0].replace(/\s/g, '');
      
      // تنسيق الرقم
      if (phone.startsWith('06') || phone.startsWith('07')) {
        phone = '+212' + phone.substring(1);
      } else if (phone.startsWith('00212')) {
        phone = '+212' + phone.substring(5);
      } else if (phone.startsWith('212') && !phone.startsWith('+212')) {
        phone = '+212' + phone.substring(3);
      } else if (/^[67]\d{8}$/.test(phone)) {
        phone = '+212' + phone;
      }
      
      return phone;
    }
    
    return null;
  }

  // إرسال رسالة مع تأخير طبيعي
  async sendMessage(phoneNumber, message, whatsappClient) {
    try {
      // تأخير طبيعي حسب طول الرسالة
      const delay = Math.min(message.length * 25, 4000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // إرسال الرسالة
      await whatsappClient.sendMessage(`${phoneNumber}@c.us`, message);
      
      // تسجيل الرسالة في المحادثة
      conversationManager.addMessage(phoneNumber, message, 'agent');
      
      console.log(`✅ Message sent to ${phoneNumber}: ${message.substring(0, 50)}...`);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  // الحصول على إحصائيات الوكيل
  getAgentStats() {
    const conversationStats = conversationManager.getConversationStats();
    
    return {
      ...conversationStats,
      sheetsIntegration: {
        enabled: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
        configured: !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
      },
      orderProcessing: {
        totalProcessed: this.getTotalOrdersProcessed(),
        successfullyCompleted: this.getSuccessfulOrders(),
        pendingConfirmation: this.getPendingOrders()
      }
    };
  }

  // إحصائيات الطلبات
  getTotalOrdersProcessed() {
    let count = 0;
    for (const conversation of conversationManager.conversations.values()) {
      if (conversation.state === this.conversationStates.COMPLETED ||
          conversation.state === this.conversationStates.ORDER_CONFIRMATION) {
        count++;
      }
    }
    return count;
  }

  getSuccessfulOrders() {
    let count = 0;
    for (const conversation of conversationManager.conversations.values()) {
      if (conversation.state === this.conversationStates.COMPLETED && 
          conversation.userData.orderCompleted) {
        count++;
      }
    }
    return count;
  }

  getPendingOrders() {
    let count = 0;
    for (const conversation of conversationManager.conversations.values()) {
      if (conversation.state === this.conversationStates.ORDER_CONFIRMATION ||
          conversation.state === this.conversationStates.PHONE_CONFIRMATION ||
          conversation.state === this.conversationStates.INFO_CONFIRMATION) {
        count++;
      }
    }
    return count;
  }

  // إعادة تعيين محادثة مكتملة
  resetCustomerConversation(phoneNumber) {
    conversationManager.resetCompletedConversation(phoneNumber);
  }

  // اختبار الاتصال بـ Google Sheets
  async testGoogleSheetsConnection() {
    try {
      const testResult = await googleSheetsService.testConnection();
      return testResult;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // إرسال بيانات تجريبية إلى Google Sheets للاختبار
  async testSendToGoogleSheets() {
    const testData = {
      name: 'عميل تجريبي',
      city: 'الدار البيضاء',
      address: 'شارع محمد الخامس، رقم 123',
      phoneNumber: '+212600123456',
      pack: this.defaultProduct.pack,
      prix: this.defaultProduct.price,
      notes: 'بيانات تجريبية للاختبار'
    };
    
    return await this.sendToGoogleSheets(testData);
  }

  // معالجة متقدمة للغة العربية والدارجة
  normalizeArabicText(text) {
    return text
      .replace(/أ|إ|آ/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // تحسين استخراج المعلومات من السياق
  extractInfoFromContext(message, conversation) {
    const context = conversation.messages.slice(-5); // آخر 5 رسائل
    const combinedText = context.map(msg => msg.content).join(' ') + ' ' + message;
    
    return this.extractClientInfo(combinedText, conversation.phoneNumber);
  }

  // التحقق من جودة البيانات قبل الإرسال
  validateClientData(clientInfo) {
    const issues = [];
    
    // التحقق من الاسم
    if (!clientInfo.name || clientInfo.name.length < 2) {
      issues.push('اسم غير صالح');
    }
    
    // التحقق من المدينة
    const validCities = [
      'الدار البيضاء', 'الرباط', 'فاس', 'مراكش', 'أكادير', 'طنجة',
      'مكناس', 'وجدة', 'القنيطرة', 'تمارة', 'آسفي', 'المحمدية',
      'casablanca', 'rabat', 'fes', 'marrakech', 'agadir', 'tanger'
    ];
    
    if (!clientInfo.city || !validCities.some(city => 
      city.toLowerCase().includes(clientInfo.city.toLowerCase()) ||
      clientInfo.city.toLowerCase().includes(city.toLowerCase())
    )) {
      issues.push('مدينة غير مألوفة');
    }
    
    // التحقق من رقم الهاتف
    const phoneRegex = /^\+212[67]\d{8}$/;
    if (!clientInfo.phoneNumber || !phoneRegex.test(clientInfo.phoneNumber)) {
      issues.push('رقم هاتف غير صالح');
    }
    
    // التحقق من العنوان
    if (!clientInfo.address || clientInfo.address.length < 10) {
      issues.push('عنوان غير مكتمل');
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues
    };
  }

  // إنشاء ملخص للمحادثة
  generateConversationSummary(phoneNumber) {
    const conversation = conversationManager.getConversation(phoneNumber);
    
    return {
      phoneNumber,
      state: conversation.state,
      userData: conversation.userData,
      messageCount: conversation.metadata.messageCount,
      startTime: conversation.metadata.startTime,
      lastActivity: conversation.metadata.lastActivity,
      completionRate: this.calculateCompletionRate(conversation),
      nextAction: this.getNextAction(conversation)
    };
  }

  calculateCompletionRate(conversation) {
    const requiredFields = ['name', 'city', 'address', 'phoneNumber'];
    const completedFields = requiredFields.filter(field => 
      conversation.userData[field] && conversation.userData[field].trim() !== ''
    );
    
    return Math.round((completedFields.length / requiredFields.length) * 100);
  }

  getNextAction(conversation) {
    switch (conversation.state) {
      case this.conversationStates.GREETING:
        return 'انتظار الاستفسار عن المنتج';
      case this.conversationStates.PRODUCT_INQUIRY:
        return 'جمع معلومات العميل';
      case this.conversationStates.INFO_COLLECTION:
        return 'استكمال المعلومات الناقصة';
      case this.conversationStates.PHONE_CONFIRMATION:
        return 'تأكيد رقم الهاتف';
      case this.conversationStates.ORDER_CONFIRMATION:
        return 'تأكيد الطلب وإرسال البيانات';
      case this.conversationStates.COMPLETED:
        return 'مكتملة - في انتظار المتابعة';
      default:
        return 'غير محدد';
    }
  }
}

// إنشاء مثيل واحد للاستخدام في التطبيق
const intelligentAgent = new IntelligentAgent();

module.exports = intelligentAgent;