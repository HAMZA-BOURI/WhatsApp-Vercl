// services/data-processing.js - Fixed version with better extraction logic
const { formatPhoneNumber, cleanText } = require('./data-utils');

/**
 * Extract client information from a message using AI analysis
 * @param {Object} messageAnalysis The AI analysis of the message
 * @param {string} rawMessage The original raw message
 * @returns {Object} Extracted client information
 */
const extractClientInfo = async (messageAnalysis, rawMessage) => {
  try {
    // If the AI has already identified this as client info submission with structured data
    if (
      messageAnalysis.analysis && 
      messageAnalysis.analysis.intent && 
      messageAnalysis.analysis.intent.isClientInfoSubmission
    ) {
      // Use the structured data from AI if available
      if (messageAnalysis.extractedData) {
        return {
          ...messageAnalysis.extractedData,
          source: 'ai_structured'
        };
      }
    }
    
    // Enhanced manual pattern matching
    return extractClientInfoManually(rawMessage);
  } catch (error) {
    console.error('Error extracting client information:', error);
    return {
      success: false,
      message: 'Error extracting client information',
      source: 'error'
    };
  }
};

/**
 * Enhanced manual extraction with better patterns
 * @param {string} message The raw message text
 * @returns {Object} Extracted client information
 */
const extractClientInfoManually = (message) => {
  const result = {
    name: null,
    city: null, 
    address: null,
    phoneNumber: null,
    confidence: 0,
    source: 'pattern_matching'
  };
  
  if (!message || typeof message !== 'string') {
    return {
      ...result,
      success: false,
      message: 'Invalid message format'
    };
  }
  
  const cleanedMessage = cleanText(message);
  console.log('🔍 Processing message:', cleanedMessage);
  
  // Enhanced phone number extraction
  result.phoneNumber = extractPhoneNumber(cleanedMessage);
  if (result.phoneNumber) {
    result.confidence += 0.3;
    console.log('📱 Phone found:', result.phoneNumber);
  }
  
  // Enhanced city extraction
  result.city = extractCity(cleanedMessage);
  if (result.city) {
    result.confidence += 0.3;
    console.log('🏙️ City found:', result.city);
  }
  
  // Enhanced name extraction
  result.name = extractName(cleanedMessage);
  if (result.name) {
    result.confidence += 0.3;
    console.log('👤 Name found:', result.name);
  }
  
  // Enhanced address extraction
  result.address = extractAddress(cleanedMessage);
  if (result.address) {
    result.confidence += 0.1;
    console.log('📍 Address found:', result.address);
  }
  
  result.success = result.confidence >= 0.3 && (result.name || result.phoneNumber);
  
  console.log(`✅ Extraction result: Success=${result.success}, Confidence=${result.confidence.toFixed(2)}`);
  
  return result;
};

/**
 * Enhanced phone number extraction
 */
const extractPhoneNumber = (message) => {
  const phonePatterns = [
    // Standard Moroccan formats
    /(?:(?:\+|00)212|0)[\s-]?([67]\d{8})/g,
    // International format
    /\+212[\s-]?([67]\d{8})/g,
    // Local format without country code
    /\b0([67]\d{8})\b/g,
    // 9 digits starting with 6 or 7
    /\b([67]\d{8})\b/g
  ];
  
  for (const pattern of phonePatterns) {
    const matches = message.match(pattern);
    if (matches && matches.length > 0) {
      const formatted = formatPhoneNumber(matches[0]);
      if (formatted) {
        return formatted;
      }
    }
  }
  
  return null;
};

/**
 * Enhanced city extraction with better mapping
 */
const extractCity = (message) => {
  const cities = [
    // Arabic names with variations
    { patterns: ['الدار البيضاء', 'كازابلانكا', 'كازا'], standard: 'الدار البيضاء' },
    { patterns: ['الرباط'], standard: 'الرباط' },
    { patterns: ['فاس', 'فاز'], standard: 'فاس' },
    { patterns: ['مراكش', 'مراكش'], standard: 'مراكش' },
    { patterns: ['أكادير', 'اكادير'], standard: 'أكادير' },
    { patterns: ['طنجة', 'طنجه'], standard: 'طنجة' },
    { patterns: ['مكناس', 'مكناز'], standard: 'مكناس' },
    { patterns: ['وجدة', 'وجده'], standard: 'وجدة' },
    { patterns: ['القنيطرة', 'قنيطرة'], standard: 'القنيطرة' },
    { patterns: ['تمارة', 'تماره'], standard: 'تمارة' },
    { patterns: ['آسفي', 'اسفي', 'سافي'], standard: 'آسفي' },
    { patterns: ['الجديدة', 'جديدة'], standard: 'الجديدة' },
    { patterns: ['المحمدية', 'محمدية'], standard: 'المحمدية' },
    { patterns: ['سطات'], standard: 'سطات' },
    
    // French/Latin names
    { patterns: ['casablanca', 'casa'], standard: 'الدار البيضاء' },
    { patterns: ['rabat'], standard: 'الرباط' },
    { patterns: ['fes', 'fès'], standard: 'فاس' },
    { patterns: ['marrakech', 'marrakesh'], standard: 'مراكش' },
    { patterns: ['agadir'], standard: 'أكادير' },
    { patterns: ['tanger', 'tangier'], standard: 'طنجة' },
    { patterns: ['meknes', 'meknès'], standard: 'مكناس' },
    { patterns: ['oujda'], standard: 'وجدة' },
    { patterns: ['kenitra', 'kénitra'], standard: 'القنيطرة' },
    { patterns: ['temara', 'témara'], standard: 'تمارة' },
    { patterns: ['safi'], standard: 'آسفي' },
    { patterns: ['el jadida'], standard: 'الجديدة' },
    { patterns: ['mohammedia'], standard: 'المحمدية' },
    { patterns: ['settat'], standard: 'سطات' }
  ];
  
  const messageLower = message.toLowerCase();
  
  for (const cityGroup of cities) {
    for (const pattern of cityGroup.patterns) {
      if (messageLower.includes(pattern.toLowerCase())) {
        return cityGroup.standard;
      }
    }
  }
  
  return null;
};

/**
 * Enhanced name extraction with better patterns
 */
const extractName = (message) => {
  // Clean patterns to find names
  const namePatterns = [
    // Arabic patterns
    /(?:اسمي|سميتي|انا|أنا)\s+([^\d\n,]{2,40})/i,
    /(?:اسم|اسمي|سمية|سميتي)[\s:]+([^\d\n,]{2,40})/i,
    
    // Darija patterns  
    /(?:انا سميتي|smiتي|انا)\s+([^\d\n,]{2,40})/i,
    
    // French patterns
    /(?:je m'appelle|my name is|je suis)\s+([^\d\n,]{2,40})/i,
    /(?:name|nom)[\s:]+([^\d\n,]{2,40})/i
  ];
  
  for (const pattern of namePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      let extractedName = match[1].trim();
      
      // Clean the extracted name
      extractedName = cleanExtractedName(extractedName);
      
      if (extractedName && extractedName.length >= 2 && extractedName.length <= 30) {
        return extractedName;
      }
    }
  }
  
  // Fallback: try to extract name from beginning of message
  return extractNameFromBeginning(message);
};

/**
 * Clean extracted name from common words
 */
const cleanExtractedName = (name) => {
  if (!name) return null;
  
  // Remove common words that are not part of names
  const wordsToRemove = [
    'هو', 'هي', 'ديالي', 'my', 'is', 'est', 'وأسكن', 'وأنا', 'من', 'في',
    'و', 'أو', 'أم', 'أب', 'ابن', 'بنت', 'the', 'a', 'an', 'le', 'la', 'les'
  ];
  
  let cleaned = name;
  
  // Remove words to remove
  wordsToRemove.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });
  
  // Clean up extra spaces and punctuation
  cleaned = cleaned.replace(/[,،;:.!?]/g, '').replace(/\s+/g, ' ').trim();
  
  // If the result is too short or contains numbers, return null
  if (cleaned.length < 2 || /\d/.test(cleaned)) {
    return null;
  }
  
  return cleaned;
};

/**
 * Extract name from the beginning of the message
 */
const extractNameFromBeginning = (message) => {
  const words = message.split(/[\s,;:.!?]+/).slice(0, 4); // First 4 words
  const arabicNamePattern = /^[\u0600-\u06FF\s]{2,}$/;
  const latinNamePattern = /^[A-Za-z\s]{2,}$/;
  
  // Look for sequences of 1-3 words that could be names
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j <= Math.min(i + 3, words.length); j++) {
      const candidate = words.slice(i, j).join(' ').trim();
      
      if (candidate.length >= 3 && candidate.length <= 25) {
        if (arabicNamePattern.test(candidate) || latinNamePattern.test(candidate)) {
          // Avoid common non-name words
          const nonNameWords = [
            'مرحبا', 'أهلا', 'شكرا', 'من فضلك', 'لو سمحت', 'hello', 'hi', 'thanks', 'please',
            'bonjour', 'salut', 'merci', 'سلام عليكم', 'صباح الخير', 'مساء الخير'
          ];
          
          if (!nonNameWords.some(word => candidate.toLowerCase().includes(word.toLowerCase()))) {
            return candidate;
          }
        }
      }
    }
  }
  
  return null;
};

/**
 * Enhanced address extraction
 */
const extractAddress = (message) => {
  // Address keywords in different languages
  const addressKeywords = [
    // Arabic
    'شارع', 'زنقة', 'حي', 'دوار', 'رقم', 'عمارة', 'الطابق', 'بناية', 'مجمع',
    // French
    'rue', 'avenue', 'quartier', 'numero', 'immeuble', 'etage', 'batiment', 'residence',
    // English
    'street', 'district', 'building', 'floor', 'apartment', 'block', 'complex'
  ];
  
  const messageLower = message.toLowerCase();
  const hasAddressKeywords = addressKeywords.some(keyword => 
    messageLower.includes(keyword.toLowerCase())
  );
  
  if (!hasAddressKeywords) {
    return null;
  }
  
  // Try to extract sentences containing address keywords
  const sentences = message.split(/[.!?؟]+/);
  
  for (const sentence of sentences) {
    const sentenceLower = sentence.toLowerCase().trim();
    
    if (addressKeywords.some(keyword => sentenceLower.includes(keyword.toLowerCase()))) {
      let cleanAddress = sentence.trim();
      
      // Remove name and city from address if they exist
      const detectedName = extractName(cleanAddress);
      const detectedCity = extractCity(cleanAddress);
      
      if (detectedName) {
        cleanAddress = cleanAddress.replace(detectedName, '').trim();
      }
      if (detectedCity) {
        cleanAddress = cleanAddress.replace(detectedCity, '').trim();
      }
      
      // Clean up the address
      cleanAddress = cleanAddress.replace(/^[وو،,\s]+|[وو،,\s]+$/g, '').trim();
      
      if (cleanAddress.length >= 5 && cleanAddress.length <= 100) {
        return cleanAddress;
      }
    }
  }
  
  return null;
};

/**
 * Validate client information with enhanced checks
 * @param {Object} clientInfo The extracted client information
 * @returns {Object} Validation result
 */
const validateClientInfo = (clientInfo) => {
  const validation = {
    isValid: true,
    errors: []
  };
  
  // Enhanced phone number validation
  if (!clientInfo.phoneNumber) {
    validation.isValid = false;
    validation.errors.push('Missing phone number');
  } else {
    const phoneRegex = /^\+212[67]\d{8}$/;
    if (!phoneRegex.test(clientInfo.phoneNumber)) {
      validation.isValid = false;
      validation.errors.push('Invalid phone number format');
    }
  }
  
  // Enhanced name validation
  if (!clientInfo.name) {
    validation.errors.push('Missing name (recommended)');
  } else {
    if (clientInfo.name.length < 2) {
      validation.errors.push('Name too short');
    } else if (clientInfo.name.length > 40) {
      validation.errors.push('Name too long');
    } else if (/^\d+$/.test(clientInfo.name)) {
      validation.isValid = false;
      validation.errors.push('Name cannot be only numbers');
    }
  }
  
  // Enhanced city validation
  if (clientInfo.city) {
    const validCities = [
      'الدار البيضاء', 'الرباط', 'فاس', 'مراكش', 'أكادير', 'طنجة',
      'مكناس', 'وجدة', 'القنيطرة', 'تمارة', 'آسفي', 'الجديدة', 'المحمدية', 'سطات'
    ];
    
    if (!validCities.includes(clientInfo.city)) {
      validation.errors.push(`Unknown city: ${clientInfo.city} (will be processed anyway)`);
    }
  }
  
  // Address validation
  if (clientInfo.address) {
    if (clientInfo.address.length < 5) {
      validation.errors.push('Address too short');
    } else if (clientInfo.address.length > 150) {
      validation.errors.push('Address too long');
    }
  }
  
  return validation;
};

/**
 * Format client info into a standard format with better cleaning
 * @param {Object} clientInfo Raw client information
 * @returns {Object} Standardized client information
 */
const formatClientInfo = (clientInfo) => {
  const formatted = {
    name: null,
    city: null,
    address: null,
    phoneNumber: null,
    notes: '',
    source: clientInfo.source || 'manual',
    extractionConfidence: clientInfo.confidence || 0
  };
  
  // Format name
  if (clientInfo.name) {
    formatted.name = cleanText(clientInfo.name);
    // Ensure proper capitalization
    formatted.name = formatted.name.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  // Format city
  if (clientInfo.city) {
    formatted.city = cleanText(clientInfo.city);
  }
  
  // Format address
  if (clientInfo.address) {
    formatted.address = cleanText(clientInfo.address);
  }
  
  // Format phone number
  if (clientInfo.phoneNumber) {
    formatted.phoneNumber = formatPhoneNumber(clientInfo.phoneNumber);
  }
  
  // Add extraction notes
  if (clientInfo.source === 'pattern_matching') {
    formatted.notes = `Extracted using pattern matching (confidence: ${(clientInfo.confidence * 100).toFixed(0)}%)`;
  } else if (clientInfo.source === 'ai_structured') {
    formatted.notes = 'Extracted using AI analysis';
  }
  
  return formatted;
};

/**
 * Test the extraction system with sample data
 */
const testExtraction = () => {
  const testCases = [
    'اسمي أحمد محمد وأسكن في الدار البيضاء شارع محمد الخامس رقم 123 ورقم هاتفي 0661234567',
    'انا سميتي فاطمة من كازا وساكنة في حي الحسان رقم التيليفون ديالي 0712345678',
    'Je m\'appelle Pierre Dubois, j\'habite à Rabat rue Hassan II et mon numéro est 0661111111',
    'اسمي خالد من مراكش',
    'رقمي 0622334455'
  ];
  
  console.log('🧪 Testing extraction system...');
  
  testCases.forEach((testCase, index) => {
    console.log(`\n--- Test ${index + 1} ---`);
    console.log('Input:', testCase);
    
    const result = extractClientInfoManually(testCase);
    console.log('Result:', {
      name: result.name,
      city: result.city,
      address: result.address,
      phoneNumber: result.phoneNumber,
      success: result.success,
      confidence: result.confidence.toFixed(2)
    });
  });
};

module.exports = {
  extractClientInfo,
  extractClientInfoManually,
  validateClientInfo,
  formatClientInfo,
  testExtraction
};