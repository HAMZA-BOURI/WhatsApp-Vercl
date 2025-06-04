// services/ai-vercel.js - Lightweight AI service for Vercel serverless environment
const axios = require('axios');

class AIVercelService {
  constructor() {
    this.geminiConfig = {
      apiKey: process.env.GEMINI_API_KEY || '',
      apiUrl: process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    };

    // Simple stats for API responses
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastError: null
    };
  }

  // Simplified language detection
  detectLanguage(text) {
    if (!text || typeof text !== 'string') return 'darija';

    const hasArabicChars = /[\u0600-\u06FF]/.test(text);
    const hasFrenchChars = /[éèêëàâäôöùûüÿçîï]/i.test(text);
    const hasDarijaWords = /\b(wach|wash|labas|bghit|khoya|fin|chno)\b/i.test(text);

    if (hasDarijaWords || (hasArabicChars && /[0-9]/.test(text))) {
      return 'darija';
    } else if (hasArabicChars) {
      return 'arabic';
    } else if (hasFrenchChars) {
      return 'french';
    }

    return 'darija';
  }

  // Basic prompt builder
  buildSimplePrompt(message, customerInfo) {
    const language = this.detectLanguage(message);
    const customerName = customerInfo?.name ? ` ${customerInfo.name}` : '';
    const isNewCustomer = customerInfo?.isNew || false;

    let promptInstructions = '';
    
    if (language === 'darija' || language === 'arabic') {
      promptInstructions = `
أنت مساعد ذكي لخدمة العملاء. قم بالرد على العميل${customerName} باللغة الدارجة المغربية بطريقة لطيفة ومهنية.
${isNewCustomer ? 'هذا عميل جديد، كن مرحباً ومتعاوناً.' : 'هذا عميل عائد، أظهر أنك تقدر ولاءه.'}

المنتج: منتج ÉCLORA الطبيعي
الوصف: منتج طبيعي عالي الجودة مصنوع من مكونات طبيعية 100% يناسب جميع الأعمار
السعر: 299 درهم مغربي
المزايا: مكونات طبيعية 100%، آمن للاستخدام اليومي، نتائج سريعة ومضمونة

رسالة العميل: "${message}"

الرد:`;
    } else if (language === 'french') {
      promptInstructions = `
Vous êtes un assistant intelligent pour le service client. Répondez au client${customerName} en français de manière aimable et professionnelle.
${isNewCustomer ? 'C\'est un nouveau client, soyez accueillant et serviable.' : 'C\'est un client fidèle, montrez que vous appréciez sa fidélité.'}

Produit: ÉCLORA Naturel
Description: Produit naturel de haute qualité fabriqué à partir d'ingrédients 100% naturels, convient à tous les âges
Prix: 299 dirhams
Avantages: Ingrédients 100% naturels, sûr pour un usage quotidien, résultats rapides et garantis

Message du client: "${message}"

Réponse:`;
    } else {
      promptInstructions = `
You are an intelligent customer service assistant. Respond to the customer${customerName} in Moroccan Darija in a friendly and professional manner.
${isNewCustomer ? 'This is a new customer, be welcoming and helpful.' : 'This is a returning customer, show appreciation for their loyalty.'}

Product: ÉCLORA Natural
Description: High-quality natural product made from 100% natural ingredients, suitable for all ages
Price: 299 Moroccan dirhams
Benefits: 100% natural ingredients, safe for daily use, fast and guaranteed results

Customer message: "${message}"

Response:`;
    }

    return promptInstructions;
  }

  // Call Gemini API with retry
  async callGeminiAPI(prompt, retries = 2) {
    const startTime = Date.now();
    this.stats.totalRequests++;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Skip if no API key configured
        if (!this.geminiConfig.apiKey) {
          throw new Error('Gemini API key not configured');
        }

        const requestConfig = {
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
            topP: 0.8,
            topK: 40
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
              'Content-Type': 'application/json'
            },
            timeout: 15000 // 15 second timeout
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
          return this.getFallbackResponse(prompt);
        }

        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return this.getFallbackResponse(prompt);
  }

  // Get fallback response if API fails
  getFallbackResponse(prompt) {
    const language = /(?:الدارجة المغربية|باللغة العربية)/.test(prompt) ? 'arabic' :
                   /(?:en français)/.test(prompt) ? 'french' : 'darija';
    
    const responses = {
      darija: "شكراً على رسالتك. نعتذر عن عدم القدرة على معالجة طلبك حالياً. سنقوم بالرد عليك في أقرب وقت ممكن.",
      arabic: "شكراً على رسالتك. نعتذر عن عدم القدرة على معالجة طلبك حالياً. سنقوم بالرد عليك في أقرب وقت ممكن.",
      french: "Merci pour votre message. Nous sommes désolés de ne pas pouvoir traiter votre demande pour le moment. Nous vous répondrons dès que possible."
    };

    return responses[language] || responses.darija;
  }

  // Main method to analyze message with AI
  async analyzeMessageWithAI(message, customerInfo = {}) {
    if (!message || typeof message !== 'string') {
      return {
        analysis: { language: 'darija', intent: {} },
        response: 'مرحبا! كيفاش نقدر نعاونك؟',
        aiGenerated: false,
        error: 'Invalid message format'
      };
    }

    try {
      // Build simple prompt
      const language = this.detectLanguage(message);
      const prompt = this.buildSimplePrompt(message, customerInfo);
      
      // Call AI
      const aiResponse = await this.callGeminiAPI(prompt);
      
      if (aiResponse) {
        return {
          analysis: { 
            language, 
            intent: {}
          },
          response: aiResponse,
          aiGenerated: true,
          processingTime: this.stats.averageResponseTime
        };
      }

      // Fallback response
      const fallbackResponse = this.getFallbackResponse(prompt);
      
      return {
        analysis: { 
          language, 
          intent: {}
        },
        response: fallbackResponse,
        aiGenerated: false,
        fallbackReason: this.stats.lastError?.message || 'API unavailable'
      };
    } catch (error) {
      console.error('Error in analyzeMessageWithAI:', error);
      
      const emergencyResponse = 'نعتذر عن الخطأ التقني. سيتواصل معك فريقنا قريبا.';

      return {
        analysis: { language: this.detectLanguage(message), intent: {} },
        response: emergencyResponse,
        aiGenerated: false,
        error: error.message
      };
    }
  }

  // Update stats
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

  // Get service stats
  getServiceStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0 ? 
        (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%',
      environment: 'vercel-serverless'
    };
  }

  // Test API connection
  async testAPIConnection() {
    try {
      const testPrompt = 'Test connection. Respond with "OK" in Arabic.';
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

// Export singleton instance
module.exports = new AIVercelService();