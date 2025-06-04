// services/ai-client-extraction.js - Enhanced version with better extraction and validation
const { isLikelyContactInfo } = require('./data-utils');

/**
 * Prompt محسن لـ Gemini لاستخراج معلومات العميل بدقة أعلى
 */
const buildEnhancedClientExtractionPrompt = (message) => {
  return `
أنت خبير في استخراج معلومات العملاء من الرسائل النصية باللغة العربية والدارجة المغربية والفرنسية.

المهمة: استخرج معلومات العميل من الرسالة التالية بدقة عالية.

الرسالة: "${message}"

المعلومات المطلوب استخراجها:
1. **الاسم الكامل**: اسم العميل (يمكن أن يكون عربي، أمازيغي، أو فرنسي)
2. **المدينة**: المدينة المغربية (تأكد من التطابق مع المدن المغربية المعروفة)
3. **العنوان الكامل**: العنوان التفصيلي للتوصيل (شارع، رقم، حي، إلخ)
4. **رقم الهاتف**: رقم الهاتف المغربي (تحويل تلقائي إلى صيغة +212)
5. **معلومات إضافية**: أي تفاصيل أخرى مهمة (وقت التوصيل المفضل، ملاحظات خاصة)

المدن المغربية المقبولة:
- الدار البيضاء، كازابلانكا، كازا (Casablanca)
- الرباط (Rabat)
- فاس (Fès, Fez)
- مراكش (Marrakech, Marrakesh)
- أكادير (Agadir)
- طنجة (Tanger, Tangier)
- مكناس (Meknès, Meknes)
- وجدة (Oujda)
- القنيطرة (Kénitra, Kenitra)
- تمارة (Témara)
- آسفي (Safi)
- الجديدة (El Jadida)
- المحمدية (Mohammedia)
- سطات (Settat)
- خريبكة (Khouribga)
- بني ملال (Béni Mellal)
- الناظور (Nador)

قوانين الاستخراج:
- إذا كان النص يحتوي على "اسمي" أو "سميتي" أو "je m'appelle" فما بعدها هو الاسم
- ابحث عن أنماط العناوين مثل "شارع"، "حي"، "رقم"، "دوار"، "زنقة"
- رقم الهاتف يجب أن يبدأ بـ 06 أو 07 أو +212 أو 0212
- إذا ذُكرت مدينة غير معروفة، اقترح أقرب مدينة مغربية مطابقة
- تأكد من دقة المعلومات وعدم الخلط بين الاسم والمدينة

مستوى الثقة:
- **high**: المعلومة واضحة ومؤكدة 100%
- **medium**: المعلومة محتملة بنسبة 70-80%
- **low**: المعلومة غير مؤكدة أو مستنتجة من السياق

أجب بصيغة JSON فقط (بدون أي نص إضافي):
{
  "name": "الاسم الكامل أو null",
  "city": "المدينة أو null", 
  "address": "العنوان الكامل أو null",
  "phoneNumber": "رقم الهاتف بصيغة +212 أو null",
  "additionalInfo": "معلومات إضافية أو null",
  "confidence": {
    "name": "high/medium/low/null",
    "city": "high/medium/low/null", 
    "address": "high/medium/low/null",
    "phoneNumber": "high/medium/low/null"
  },
  "missingInfo": ["قائمة المعلومات الناقصة"],
  "suggestedQuestion": "سؤال مقترح للحصول على المعلومات الناقصة باللغة المناسبة",
  "detectedLanguage": "arabic/darija/french",
  "extractionSuccess": true/false
}`;
};

/**
 * استخراج معلومات العميل باستخدام Gemini مع تحسينات
 */
const extractClientInfoWithGemini = async (message, apiConfig) => {
  try {
    // فحص أولي للرسالة
    if (!message || typeof message !== 'string' || message.trim().length < 3) {
      return {
        success: false,
        message: 'رسالة غير صالحة أو قصيرة جداً',
        source: 'validation_error'
      };
    }

    // التحقق من وجود معلومات محتملة للعميل
    if (!isLikelyContactInfo(message)) {
      return {
        success: false,
        message: 'الرسالة لا تحتوي على معلومات عميل واضحة',
        source: 'content_analysis',
        suggestedQuestion: "للمساعدة بشكل أفضل، هل يمكنك مشاركة اسمك ومدينتك معي؟"
      };
    }

    const { GEMINI_API_KEY, GEMINI_API_URL } = apiConfig;
    const axios = require('axios');
    
    if (!GEMINI_API_KEY || !GEMINI_API_URL) {
      return {
        success: false,
        message: 'إعدادات Gemini API غير مكتملة',
        source: 'config_error'
      };
    }

    // بناء الـ prompt المحسن
    const prompt = buildEnhancedClientExtractionPrompt(message);
    
    // إعداد طلب API محسن
    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1, // درجة حرارة منخفضة للحصول على نتائج أكثر دقة
        maxOutputTokens: 500,
        topP: 0.8,
        topK: 20,
        candidateCount: 1
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH", 
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE"
        }
      ]
    };

    console.log('🤖 Calling Gemini API for client info extraction...');

    // استدعاء API مع معالجة الأخطاء المحسنة
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WhatsApp-Client-Extractor/1.0'
        },
        timeout: 15000 // 15 ثانية timeout
      }
    );

    // معالجة الاستجابة
    if (response.data && 
        response.data.candidates && 
        response.data.candidates.length > 0 && 
        response.data.candidates[0].content &&
        response.data.candidates[0].content.parts &&
        response.data.candidates[0].content.parts.length > 0) {
      
      const rawResponse = response.data.candidates[0].content.parts[0].text.trim();
      console.log('📄 Raw Gemini response:', rawResponse.substring(0, 200) + '...');

      try {
        // استخراج JSON من الاستجابة
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }

        const jsonStr = jsonMatch[0];
        const extractedData = JSON.parse(jsonStr);

        // التحقق من صحة البيانات المستخرجة
        const validationResult = validateExtractedData(extractedData);
        
        if (!validationResult.isValid) {
          console.warn('⚠️ Extracted data validation failed:', validationResult.issues);
          
          // محاولة إصلاح البيانات
          const correctedData = correctExtractedData(extractedData, message);
          return {
            ...correctedData,
            source: 'gemini_api_corrected',
            success: true,
            validationIssues: validationResult.issues
          };
        }

        // تنسيق البيانات النهائية
        const finalData = formatExtractedData(extractedData);
        
        console.log('✅ Successfully extracted client info:', {
          name: finalData.name || 'N/A',
          city: finalData.city || 'N/A',
          phone: finalData.phoneNumber || 'N/A',
          address: finalData.address ? 'Present' : 'N/A'
        });

        return {
          ...finalData,
          source: 'gemini_api',
          success: true,
          originalMessage: message
        };

      } catch (jsonError) {
        console.error('❌ JSON parsing error:', jsonError.message);
        console.log('Raw response that failed to parse:', rawResponse);
        
        // محاولة استخراج يدوي كـ fallback
        const manualExtraction = extractClientInfoManually(message);
        return {
          ...manualExtraction,
          source: 'manual_fallback',
          success: manualExtraction.success,
          apiError: 'JSON parsing failed'
        };
      }
    }

    // إذا لم نحصل على استجابة صالحة
    console.warn('⚠️ No valid response from Gemini API');
    const manualExtraction = extractClientInfoManually(message);
    return {
      ...manualExtraction,
      source: 'manual_fallback',
      success: manualExtraction.success,
      apiError: 'No valid API response'
    };

  } catch (error) {
    console.error('❌ Error in Gemini API call:', error.message);
    
    // Fallback للاستخراج اليدوي
    const manualExtraction = extractClientInfoManually(message);
    return {
      ...manualExtraction,
      source: 'manual_fallback',
      success: manualExtraction.success,
      apiError: error.message
    };
  }
};

/**
 * التحقق من صحة البيانات المستخرجة
 */
const validateExtractedData = (data) => {
  const issues = [];
  
  // التحقق من وجود البيانات الأساسية
  if (!data || typeof data !== 'object') {
    issues.push('Invalid data structure');
    return { isValid: false, issues };
  }

  // التحقق من رقم الهاتف
  if (data.phoneNumber) {
    const phoneRegex = /^\+212[67]\d{8}$/;
    if (!phoneRegex.test(data.phoneNumber)) {
      issues.push('Invalid phone number format');
    }
  }

  // التحقق من المدينة
  if (data.city) {
    const validCities = [
      'الدار البيضاء', 'كازابلانكا', 'casablanca', 'casa',
      'الرباط', 'rabat', 'فاس', 'fes', 'fès', 'مراكش', 'marrakech',
      'أكادير', 'agadir', 'طنجة', 'tanger', 'tangier', 'مكناس', 'meknes',
      'وجدة', 'oujda', 'القنيطرة', 'kenitra', 'تمارة', 'temara',
      'آسفي', 'safi', 'الجديدة', 'el jadida', 'المحمدية', 'mohammedia'
    ];
    
    const cityLower = data.city.toLowerCase();
    const isValidCity = validCities.some(validCity => 
      validCity.toLowerCase().includes(cityLower) || 
      cityLower.includes(validCity.toLowerCase())
    );
    
    if (!isValidCity) {
      issues.push(`Unknown city: ${data.city}`);
    }
  }

  // التحقق من الاسم
  if (data.name && data.name.length < 2) {
    issues.push('Name too short');
  }

  // التحقق من مستويات الثقة
  if (data.confidence) {
    const validConfidenceLevels = ['high', 'medium', 'low', null];
    Object.keys(data.confidence).forEach(key => {
      if (data.confidence[key] && !validConfidenceLevels.includes(data.confidence[key])) {
        issues.push(`Invalid confidence level for ${key}`);
      }
    });
  }

  return {
    isValid: issues.length === 0,
    issues: issues
  };
};

/**
 * تصحيح البيانات المستخرجة
 */
const correctExtractedData = (data, originalMessage) => {
  const corrected = { ...data };

  // تصحيح رقم الهاتف
  if (corrected.phoneNumber) {
    corrected.phoneNumber = formatPhoneNumber(corrected.phoneNumber);
  }

  // تصحيح المدينة
  if (corrected.city) {
    corrected.city = normalizeCityName(corrected.city);
  }

  // تنظيف الاسم
  if (corrected.name) {
    corrected.name = corrected.name.trim().replace(/\s+/g, ' ');
  }

  // تنظيف العنوان
  if (corrected.address) {
    corrected.address = corrected.address.trim().replace(/\s+/g, ' ');
  }

  // إضافة معلومات مفقودة من الرسالة الأصلية إذا لزم الأمر
  if (!corrected.phoneNumber) {
    const phoneFromMessage = extractPhoneFromMessage(originalMessage);
    if (phoneFromMessage) {
      corrected.phoneNumber = phoneFromMessage;
    }
  }

  return corrected;
};

/**
 * تنسيق البيانات المستخرجة للاستخدام النهائي
 */
const formatExtractedData = (data) => {
  return {
    name: data.name || null,
    city: data.city ? normalizeCityName(data.city) : null,
    address: data.address || null,
    phoneNumber: data.phoneNumber ? formatPhoneNumber(data.phoneNumber) : null,
    additionalInfo: data.additionalInfo || null,
    confidence: data.confidence || {},
    missingInfo: data.missingInfo || [],
    suggestedQuestion: data.suggestedQuestion || null,
    detectedLanguage: data.detectedLanguage || 'darija',
    extractionSuccess: data.extractionSuccess !== false
  };
};

/**
 * استخراج معلومات العميل يدوياً (Fallback)
 */
const extractClientInfoManually = (message) => {
  console.log('🔄 Using manual extraction fallback...');
  
  const result = {
    name: null,
    city: null,
    address: null,
    phoneNumber: null,
    additionalInfo: null,
    confidence: {},
    missingInfo: [],
    detectedLanguage: detectLanguage(message),
    extractionSuccess: false,
    source: 'manual_extraction'
  };

  try {
    // استخراج رقم الهاتف
    const phoneNumber = extractPhoneFromMessage(message);
    if (phoneNumber) {
      result.phoneNumber = phoneNumber;
      result.confidence.phoneNumber = 'high';
      result.extractionSuccess = true;
    }

    // استخراج المدينة
    const city = extractCityFromMessage(message);
    if (city) {
      result.city = city;
      result.confidence.city = 'medium';
      result.extractionSuccess = true;
    }

    // استخراج الاسم
    const name = extractNameFromMessage(message);
    if (name) {
      result.name = name;
      result.confidence.name = 'medium';
      result.extractionSuccess = true;
    }

    // استخراج العنوان
    const address = extractAddressFromMessage(message);
    if (address) {
      result.address = address;
      result.confidence.address = 'low';
      result.extractionSuccess = true;
    }

    // تحديد المعلومات المفقودة
    if (!result.name) result.missingInfo.push('name');
    if (!result.city) result.missingInfo.push('city');
    if (!result.address) result.missingInfo.push('address');
    if (!result.phoneNumber) result.missingInfo.push('phoneNumber');

    // اقتراح سؤال للمعلومات المفقودة
    if (result.missingInfo.length > 0) {
      result.suggestedQuestion = generateMissingInfoQuestion(result.missingInfo, result.detectedLanguage);
    }

    result.success = result.extractionSuccess;
    return result;

  } catch (error) {
    console.error('Error in manual extraction:', error);
    return {
      ...result,
      success: false,
      error: error.message
    };
  }
};

/**
 * استخراج رقم الهاتف من الرسالة
 */
const extractPhoneFromMessage = (message) => {
  const phonePatterns = [
    /(?:\+212|0212|212)[\s-]?([67]\d{8})/g,
    /0([67]\d{8})/g,
    /([67]\d{8})/g
  ];

  for (const pattern of phonePatterns) {
    const matches = message.match(pattern);
    if (matches && matches.length > 0) {
      return formatPhoneNumber(matches[0]);
    }
  }

  return null;
};

/**
 * استخراج المدينة من الرسالة
 */
const extractCityFromMessage = (message) => {
  const cities = [
    { names: ['الدار البيضاء', 'كازابلانكا', 'casablanca', 'casa', 'كازا'], standard: 'الدار البيضاء' },
    { names: ['الرباط', 'rabat'], standard: 'الرباط' },
    { names: ['فاس', 'fes', 'fès'], standard: 'فاس' },
    { names: ['مراكش', 'marrakech', 'marrakesh'], standard: 'مراكش' },
    { names: ['أكادير', 'agadir'], standard: 'أكادير' },
    { names: ['طنجة', 'tanger', 'tangier'], standard: 'طنجة' },
    { names: ['مكناس', 'meknes', 'meknès'], standard: 'مكناس' },
    { names: ['وجدة', 'oujda'], standard: 'وجدة' },
    { names: ['القنيطرة', 'kenitra', 'kénitra'], standard: 'القنيطرة' },
    { names: ['تمارة', 'temara', 'témara'], standard: 'تمارة' },
    { names: ['آسفي', 'safi'], standard: 'آسفي' },
    { names: ['الجديدة', 'el jadida'], standard: 'الجديدة' },
    { names: ['المحمدية', 'mohammedia'], standard: 'المحمدية' },
    { names: ['سطات', 'settat'], standard: 'سطات' }
  ];

  const messageLower = message.toLowerCase();
  
  for (const cityGroup of cities) {
    for (const cityName of cityGroup.names) {
      if (messageLower.includes(cityName.toLowerCase())) {
        return cityGroup.standard;
      }
    }
  }

  return null;
};

/**
 * استخراج الاسم من الرسالة
 */
const extractNameFromMessage = (message) => {
  // أنماط للبحث عن الأسماء
  const namePatterns = [
    /(?:اسمي|سميتي|انا|ana|je m'appelle|my name is)\s+([^\d\n]{2,30})/i,
    /(?:اسم|name|nom)[\s:]+([^\d\n]{2,30})/i
  ];

  for (const pattern of namePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // تنظيف الاسم من الكلمات الشائعة
      const cleanedName = name.replace(/\b(هو|هي|ديالي|my|is|est)\b/gi, '').trim();
      if (cleanedName.length >= 2) {
        return cleanedName;
      }
    }
  }

  // محاولة استخراج الاسم من بداية الرسالة
  const words = message.split(/[\s,;:.!?]+/);
  const arabicNamePattern = /^[\u0600-\u06FF]{2,}$/;
  const latinNamePattern = /^[A-Za-z]{2,}$/;

  for (let i = 0; i < Math.min(words.length, 3); i++) {
    const word = words[i].trim();
    if ((arabicNamePattern.test(word) || latinNamePattern.test(word)) && 
        word.length >= 2 && word.length <= 15) {
      return word;
    }
  }

  return null;
};

/**
 * استخراج العنوان من الرسالة
 */
const extractAddressFromMessage = (message) => {
  // كلمات مفتاحية للعناوين
  const addressKeywords = [
    'شارع', 'زنقة', 'حي', 'دوار', 'رقم', 'عمارة', 'الطابق',
    'rue', 'avenue', 'quartier', 'numero', 'immeuble', 'etage',
    'street', 'district', 'building', 'floor', 'apartment'
  ];

  const messageLower = message.toLowerCase();
  const hasAddressKeywords = addressKeywords.some(keyword => 
    messageLower.includes(keyword.toLowerCase())
  );

  if (hasAddressKeywords) {
    // محاولة استخراج الجملة التي تحتوي على كلمات العنوان
    const sentences = message.split(/[.!?]+/);
    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      if (addressKeywords.some(keyword => sentenceLower.includes(keyword.toLowerCase()))) {
        const cleanAddress = sentence.trim();
        if (cleanAddress.length >= 10) {
          return cleanAddress;
        }
      }
    }
  }

  return null;
};

/**
 * توليد سؤال للمعلومات المفقودة
 */
const generateMissingInfoQuestion = (missingInfo, language) => {
  const questions = {
    arabic: {
      name: 'ما اسمك الكريم؟',
      city: 'من أي مدينة أنت؟', 
      address: 'ما هو عنوانك للتوصيل؟',
      phoneNumber: 'ما رقم هاتفك؟',
      multiple: 'لإكمال طلبك، أحتاج اسمك ومدينتك وعنوانك'
    },
    darija: {
      name: 'أش سميتك؟',
      city: 'فين ساكن؟',
      address: 'أش هو العنوان ديالك؟', 
      phoneNumber: 'أش رقم التيليفون ديالك؟',
      multiple: 'باش نكمل الطلبية، بغيت السمية والمدينة والعنوان ديالك'
    },
    french: {
      name: 'Quel est votre nom ?',
      city: 'De quelle ville êtes-vous ?',
      address: 'Quelle est votre adresse de livraison ?',
      phoneNumber: 'Quel est votre numéro de téléphone ?',
      multiple: 'Pour compléter votre commande, j\'ai besoin de votre nom, ville et adresse'
    }
  };

  const langQuestions = questions[language] || questions.darija;
  
  if (missingInfo.length > 1) {
    return langQuestions.multiple;
  } else if (missingInfo.length === 1) {
    return langQuestions[missingInfo[0]] || langQuestions.multiple;
  }
  
  return langQuestions.multiple;
};

/**
 * تنسيق رقم الهاتف
 */
const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return null;
  
  // إزالة جميع الرموز والمسافات
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // تحويل الصيغ المختلفة للصيغة الدولية المغربية
  if (cleaned.startsWith('06') || cleaned.startsWith('07')) {
    cleaned = '+212' + cleaned.substring(1);
  } else if (cleaned.startsWith('00212')) {
    cleaned = '+212' + cleaned.substring(5);
  } else if (cleaned.startsWith('212') && !cleaned.startsWith('+212')) {
    cleaned = '+212' + cleaned.substring(3);
  } else if (/^[67]\d{8}$/.test(cleaned)) {
    cleaned = '+212' + cleaned;
  }
  
  // التحقق من صحة الصيغة النهائية
  if (/^\+212[67]\d{8}$/.test(cleaned)) {
    return cleaned;
  }
  
  return null;
};

/**
 * تطبيع اسم المدينة
 */
const normalizeCityName = (cityName) => {
  const cityMappings = {
    'كازا': 'الدار البيضاء',
    'كازابلانكا': 'الدار البيضاء', 
    'casablanca': 'الدار البيضاء',
    'casa': 'الدار البيضاء',
    'rabat': 'الرباط',
    'fes': 'فاس',
    'fès': 'فاس',
    'marrakech': 'مراكش',
    'marrakesh': 'مراكش',
    'agadir': 'أكادير',
    'tanger': 'طنجة', 
    'tangier': 'طنجة',
    'meknes': 'مكناس',
    'meknès': 'مكناس',
    'oujda': 'وجدة',
    'kenitra': 'القنيطرة',
    'kénitra': 'القنيطرة',
    'temara': 'تمارة',
    'témara': 'تمارة',
    'safi': 'آسفي',
    'el jadida': 'الجديدة',
    'mohammedia': 'المحمدية',
    'settat': 'سطات'
  };

  const normalized = cityMappings[cityName.toLowerCase()] || cityName;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
};

/**
 * تحديد لغة النص
 */
const detectLanguage = (text) => {
  const arabicPattern = /[\u0600-\u06FF]/;
  const frenchPattern = /[éèêëàâäôöùûüÿçîï]/i;
  const darijaPatterns = [
    /\b(wach|wash|bghit|khoya|fin|chno|kifash|wakha|dyal|mashi)\b/i,
    /\b(m3a|3nd|mzyan|bzaf|ch7al|shhal|ghadi|ndir)\b/i
  ];

  const hasDarija = darijaPatterns.some(pattern => pattern.test(text.toLowerCase()));
  
  if (hasDarija) return 'darija';
  if (arabicPattern.test(text)) return 'arabic';
  if (frenchPattern.test(text)) return 'french';
  
  return 'darija'; // default
};

/**
 * اختبار جودة الاستخراج
 */
const testExtractionQuality = async (testCases, apiConfig) => {
  console.log('🧪 Testing client info extraction quality...');
  
  const results = [];
  
  for (const testCase of testCases) {
    try {
      const result = await extractClientInfoWithGemini(testCase.input, apiConfig);
      
      const score = calculateExtractionScore(result, testCase.expected);
      
      results.push({
        input: testCase.input,
        expected: testCase.expected,
        actual: result,
        score: score,
        passed: score >= 0.7
      });
      
      console.log(`Test "${testCase.input.substring(0, 30)}...": ${score >= 0.7 ? '✅' : '❌'} (${score.toFixed(2)})`);
      
    } catch (error) {
      console.error(`Test failed for "${testCase.input}":`, error.message);
      results.push({
        input: testCase.input,
        error: error.message,
        score: 0,
        passed: false
      });
    }
  }
  
  const totalScore = results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length;
  const passRate = results.filter(r => r.passed).length / results.length;
  
  console.log(`📊 Overall extraction quality: ${(totalScore * 100).toFixed(1)}%`);
  console.log(`📈 Test pass rate: ${(passRate * 100).toFixed(1)}%`);
  
  return {
    overallScore: totalScore,
    passRate: passRate,
    results: results
  };
};

/**
 * حساب نقاط دقة الاستخراج
 */
const calculateExtractionScore = (actual, expected) => {
  let score = 0;
  let totalFields = 0;
  
  const fields = ['name', 'city', 'address', 'phoneNumber'];
  
  fields.forEach(field => {
    if (expected[field] !== undefined) {
      totalFields++;
      if (actual[field] && expected[field]) {
        // مقارنة تقريبية للنصوص
        const similarity = calculateStringSimilarity(
          actual[field].toLowerCase(), 
          expected[field].toLowerCase()
        );
        score += similarity;
      } else if (!actual[field] && !expected[field]) {
        score += 1; // both null/empty
      }
    }
  });
  
  return totalFields > 0 ? score / totalFields : 0;
};

/**
 * حساب التشابه بين النصوص
 */
const calculateStringSimilarity = (str1, str2) => {
  if (str1 === str2) return 1;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
};

/**
 * حساب المسافة بين النصوص (Levenshtein Distance)
 */
const levenshteinDistance = (str1, str2) => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

module.exports = {
  extractClientInfoWithGemini,
  buildEnhancedClientExtractionPrompt,
  formatPhoneNumber,
  normalizeCityName,
  testExtractionQuality,
  extractClientInfoManually,
  validateExtractedData
};