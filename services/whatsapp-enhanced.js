// services/ai-enhanced.js - Service IA complet et optimisé pour 2025
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

    // Cache pour optimiser les performances
    this.cache = {
      products: null,
      context: null,
      lastUpdate: null,
      ttl: 15 * 60 * 1000 // 15 minutes
    };

    // Statistiques et monitoring
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastError: null
    };

    // Patterns de détection de langue avancés
    this.languagePatterns = {
      darija: [
        /\b(wach|wash|labas|bghit|khoya|sahbi|mrhba|fin|feen|chno|nta|nti|dyal|mashi|kifash|wakha|m3a|3nd|l9it|mzyan|hadshi|bzaf|flous|atay|ch7al|shhal|ghadi|ndir|dyali|dyalna)\b/i,
        /\b(salam|salamo|mرحبا|لباس|بغيت|خويا|صاحبي|فين|شنو|ديال|ماشي|كيفاش|واخا|معا|عند|لقيت|مزيان|هادشي|بزاف|فلوس|أتاي|شحال|غادي|نديرو|ديالي|ديالنا)\b/i
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
  }

  // Détection avancée de la langue
  detectLanguage(text) {
    if (!text || typeof text !== 'string') return 'darija'; // défaut

    const textLower = text.toLowerCase();

    // Test pour la darija (priorité car très utilisée au Maroc)
    for (const pattern of this.languagePatterns.darija) {
      if (pattern.test(textLower)) return 'darija';
    }

    // Test pour l'arabe classique
    for (const pattern of this.languagePatterns.arabic) {
      if (pattern.test(text)) return 'arabic';
    }

    // Test pour le français
    for (const pattern of this.languagePatterns.french) {
      if (pattern.test(textLower)) return 'french';
    }

    return 'darija'; // défaut
  }

  // Analyse des intentions avec IA
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
      supportRequest: {
        darija: /\b(3awnoni|sa3edni|moshkil|mushkila)\b/i,
        arabic: /\b(ساعدني|مساعدة|مشكلة|أحتاج مساعدة)\b/i,
        french: /\b(aide|aider|problème|support)\b/i
      }
    };

    const detectedIntents = {};
    
    Object.keys(intentPatterns).forEach(intent => {
      const patterns = intentPatterns[intent];
      detectedIntents[intent] = patterns[language] ? patterns[language].test(message) : false;
    });

    return detectedIntents;
  }

  // Chargement optimisé des produits avec cache
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

  // Chargement du contexte IA
  async loadAIContext(forceRefresh = false) {
    const now = Date.now();
    
    if (!forceRefresh && this.cache.context && this.cache.lastUpdate && 
        (now - this.cache.lastUpdate) < this.cache.ttl) {
      return this.cache.context;
    }

    try {
      const context = await AIContext.findOne({ active: true }).sort({ updatedAt: -1 });
      this.cache.context = context ? context.content : null;
      return this.cache.context;
    } catch (error) {
      console.error('Error loading AI context:', error);
      return this.cache.context;
    }
  }

  // Génération de prompt intelligent basé sur le contexte
  buildIntelligentPrompt(message, customerInfo, language, intents, productsInfo, customContext) {
    const languageInstructions = {
      darija: 'أجب بالدارجة المغربية بطريقة طبيعية ومألوفة',
      arabic: 'أجب باللغة العربية الفصحى بطريقة مهذبة ومحترمة',
      french: 'Réponds en français de manière professionnelle et courtoise'
    };

    const customerContext = customerInfo ? `
معلومات العميل:
- الاسم: ${customerInfo.name || 'غير معروف'}
- عدد الرسائل السابقة: ${customerInfo.messageCount || 0}
- عميل ${customerInfo.isNew ? 'جديد' : 'عائد'}
` : '';

    const intentContext = Object.keys(intents).filter(intent => intents[intent]).length > 0 ? `
الأهداف المكتشفة: ${Object.keys(intents).filter(intent => intents[intent]).join(', ')}
` : '';

    const productContext = productsInfo && productsInfo.categories && productsInfo.categories.length > 0 ? `
منتجاتنا المتاحة:
${productsInfo.categories.map(cat => 
  `- ${cat.name}: ${cat.products.map(p => `${p.name} (${p.price} درهم)`).join(', ')}`
).join('\n')}

معلومات التوصيل: ${productsInfo.shipping?.standard || 'توصيل سريع'}
سياسة الإرجاع: ${productsInfo.returns || 'إرجاع مجاني خلال 14 يوم'}
` : '';

    const customContextSection = customContext ? `
معلومات إضافية عن المنتجات:
${customContext}
` : '';

    return `أنت مساعد ذكي متخصص في خدمة العملاء لمتجر إلكتروني مغربي.

${languageInstructions[language] || languageInstructions.darija}

قواعد المحادثة:
- كن ودوداً ومساعداً دائماً
- اجعل الردود طبيعية وليست آلية
- استخدم الإيموجي بطريقة مناسبة
- اجعل الرد مختصراً (أقل من 100 كلمة)
- ادفع العميل برفق نحو الشراء
- إذا سأل عن معلومات شخصية، اطلبها بطريقة لطيفة

${customerContext}${intentContext}${productContext}${customContextSection}

رسالة العميل: "${message}"

أجب بطريقة ذكية ومناسبة للسياق:`;
  }

  // استدعاء Gemini API مع معالجة أخطاء محسنة
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
            maxOutputTokens: 300,
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
            timeout: 15000 // 15 secondes timeout
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
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });

        // Si c'est la dernière tentative, enregistrer l'erreur
        if (attempt === retries) {
          this.stats.lastError = {
            message: error.message,
            timestamp: new Date(),
            status: error.response?.status
          };
          this.updateStats(false, Date.now() - startTime);
          return null;
        }

        // Attendre avant de réessayer (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return null;
  }

  // Génération de réponse de secours intelligente
  generateFallbackResponse(message, customerInfo, language, intents) {
    const responses = {
      darija: {
        greeting: [
          'أهلا وسهلا! كيفاش نقدر نعاونك اليوم؟ 😊',
          'مرحبا بيك! كيداير؟ أش كتبغي تعرف على المنتجات ديالنا؟',
          'سلام عليكم! نورتي، كيفاش نخدمك؟'
        ],
        priceInquiry: [
          'بخصوص الثمن، عندنا أسعار تنافسية بزاف! أش هو المنتج اللي كتبغي تعرف الثمن ديالو؟',
          'الأسعار ديالنا مناسبة ومعقولة. واش بغيتي تعرف ثمن شي منتج معين؟',
          'الأثمنة ديالنا محددة حسب جودة المنتوج. قوليا أش كتبغي باش نعطيك الثمن الدقيق!'
        ],
        productInquiry: [
          'عندنا مجموعة واسعة من المنتجات عالية الجودة! أش نوع المنتوج اللي كتبغي؟',
          'المنتجات ديالنا متنوعة وكلها أصلية. واش عندك شي فكرة على أش كتبغي؟',
          'كاينين منتجات بزاف عندنا! قوليا أش كتقلب عليه باش نوريك أحسن حاجة!'
        ],
        default: [
          'شكرا على الرسالة ديالك! كيفاش نقدر نعاونك أكثر؟',
          'أهلا بيك! واش ممكن تعطيني تفاصيل أكثر باش نفهمك أحسن؟',
          'مرحبا! أنا هنا باش نساعدك. أش كتبغي تعرف؟'
        ]
      },
      arabic: {
        greeting: [
          'أهلاً وسهلاً! كيف يمكنني مساعدتك اليوم؟ 😊',
          'مرحباً بك! ما الذي تبحث عنه من منتجاتنا؟',
          'السلام عليكم! نورت، كيف يمكنني خدمتك؟'
        ],
        priceInquiry: [
          'بخصوص الأسعار، نحن نقدم أسعار تنافسية جداً! ما هو المنتج الذي تريد معرفة سعره؟',
          'أسعارنا مناسبة ومعقولة. هل تريد معرفة سعر منتج معين؟',
          'الأسعار محددة حسب جودة المنتج. أخبرني ماذا تريد لأعطيك السعر الدقيق!'
        ],
        productInquiry: [
          'لدينا مجموعة واسعة من المنتجات عالية الجودة! ما نوع المنتج الذي تبحث عنه؟',
          'منتجاتنا متنوعة وكلها أصلية. هل لديك فكرة عما تريد؟',
          'يوجد لدينا منتجات كثيرة! أخبرني عما تبحث عنه لأعرض عليك الأفضل!'
        ],
        default: [
          'شكراً لرسالتك! كيف يمكنني مساعدتك أكثر؟',
          'أهلاً بك! هل يمكنك إعطائي تفاصيل أكثر لأفهمك بشكل أفضل؟',
          'مرحباً! أنا هنا لمساعدتك. ماذا تريد أن تعرف؟'
        ]
      },
      french: {
        greeting: [
          'Bonjour et bienvenue ! Comment puis-je vous aider aujourd\'hui ? 😊',
          'Salut ! Que recherchez-vous parmi nos produits ?',
          'Bonjour ! Ravi de vous accueillir, comment puis-je vous servir ?'
        ],
        priceInquiry: [
          'Concernant les prix, nous offrons des tarifs très compétitifs ! Quel produit vous intéresse ?',
          'Nos prix sont raisonnables et abordables. Voulez-vous connaître le prix d\'un produit spécifique ?',
          'Les prix sont fixés selon la qualité du produit. Dites-moi ce que vous voulez pour un prix précis !'
        ],
        productInquiry: [
          'Nous avons une large gamme de produits de haute qualité ! Quel type de produit cherchez-vous ?',
          'Nos produits sont variés et tous authentiques. Avez-vous une idée de ce que vous voulez ?',
          'Nous avons beaucoup de produits ! Dites-moi ce que vous cherchez pour vous montrer le meilleur !'
        ],
        default: [
          'Merci pour votre message ! Comment puis-je vous aider davantage ?',
          'Bienvenue ! Pourriez-vous me donner plus de détails pour mieux vous comprendre ?',
          'Bonjour ! Je suis là pour vous aider. Que voulez-vous savoir ?'
        ]
      }
    };

    // Sélectionner la catégorie de réponse appropriée
    let responseCategory = 'default';
    if (intents.greeting) responseCategory = 'greeting';
    else if (intents.priceInquiry) responseCategory = 'priceInquiry';
    else if (intents.productInquiry) responseCategory = 'productInquiry';

    // Obtenir les réponses pour la langue détectée
    const langResponses = responses[language] || responses.darija;
    const categoryResponses = langResponses[responseCategory] || langResponses.default;

    // Sélectionner une réponse aléatoire
    const randomResponse = categoryResponses[Math.floor(Math.random() * categoryResponses.length)];

    // Personnaliser avec le nom du client si disponible
    if (customerInfo?.name && !intents.greeting) {
      const personalizedGreeting = language === 'darija' ? 
        `${randomResponse} ${customerInfo.name} 😊` :
        language === 'arabic' ?
        `${randomResponse} ${customerInfo.name} 😊` :
        `${randomResponse} ${customerInfo.name} 😊`;
      return personalizedGreeting;
    }

    return randomResponse;
  }

  // Fonction principale d'analyse avec IA
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
      // 1. Détection de la langue
      const language = this.detectLanguage(message);

      // 2. Analyse des intentions
      const intents = await this.analyzeIntent(message, language);

      // 3. Chargement des données
      const [productsInfo, customContext] = await Promise.all([
        this.loadProductsInfo(),
        this.loadAIContext()
      ]);

      // 4. Construction du prompt intelligent
      const prompt = this.buildIntelligentPrompt(
        message, customerInfo, language, intents, productsInfo, customContext
      );

      // 5. Tentative avec Gemini API
      const aiResponse = await this.callGeminiAPI(prompt);

      if (aiResponse) {
        return {
          analysis: { language, intent: intents },
          response: aiResponse,
          aiGenerated: true,
          processingTime: this.stats.averageResponseTime
        };
      }

      // 6. Fallback si l'IA échoue
      const fallbackResponse = this.generateFallbackResponse(message, customerInfo, language, intents);
      
      return {
        analysis: { language, intent: intents },
        response: fallbackResponse,
        aiGenerated: false,
        fallbackReason: this.stats.lastError?.message || 'API unavailable'
      };

    } catch (error) {
      console.error('Error in analyzeMessageWithAI:', error);
      
      // Réponse d'urgence
      const emergencyResponse = language === 'arabic' ? 
        'نعتذر عن هذا الخطأ التقني. سيتواصل معك فريق الخدمة قريباً.' :
        language === 'french' ?
        'Désolé pour cette erreur technique. Notre équipe vous contactera bientôt.' :
        'سماح ليا على هاد الخطأ التقني. الفريق ديالنا غادي يتواصل معاك قريبا.';

      return {
        analysis: { language: this.detectLanguage(message), intent: {} },
        response: emergencyResponse,
        aiGenerated: false,
        error: error.message
      };
    }
  }

  // Mise à jour des statistiques
  updateStats(success, responseTime) {
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    // Calcul de la moyenne du temps de réponse
    const totalSuccessful = this.stats.successfulRequests;
    if (totalSuccessful > 0) {
      this.stats.averageResponseTime = (
        (this.stats.averageResponseTime * (totalSuccessful - 1) + responseTime) / totalSuccessful
      );
    }
  }

  // Obtenir les statistiques du service
  getServiceStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0 ? 
        (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%',
      cacheStatus: {
        productsLoaded: !!this.cache.products,
        contextLoaded: !!this.cache.context,
        lastUpdate: this.cache.lastUpdate ? new Date(this.cache.lastUpdate).toISOString() : null
      }
    };
  }

  // Nettoyage du cache
  clearCache() {
    this.cache = {
      products: null,
      context: null,
      lastUpdate: null,
      ttl: 15 * 60 * 1000
    };
  }

  // Test de connectivité API
  async testAPIConnection() {
    try {
      const testPrompt = 'Test de connexion API. Réponds simplement "OK" en arabe.';
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
}

// Export singleton
module.exports = new AIEnhancedService();