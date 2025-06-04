// services/data-utils.js
/**
 * Clean text by removing extra spaces and normalizing
 * @param {string} text Input text
 * @returns {string} Cleaned text
 */
const cleanText = (text) => {
    if (!text) return '';
    
    return text
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
      .replace(/[^\w\s\u0600-\u06FF+:,;\.\?\!\-]/g, ''); // Keep alphanumeric, Arabic, and basic punctuation
  };
  
  /**
   * Format a phone number to standard format
   * @param {string} phoneNumber Input phone number
   * @returns {string} Formatted phone number
   */
  const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return '';
    
    // Remove all non-digit characters except + sign
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Handle Moroccan phone numbers
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      // Convert local format (0xxx) to international (+212xxx)
      cleaned = '+212' + cleaned.substring(1);
    } else if (cleaned.startsWith('212') && !cleaned.startsWith('+212')) {
      // Add + if missing
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 9 && /^[67]/.test(cleaned)) {
      // Handle 9-digit format without prefix
      cleaned = '+212' + cleaned;
    }
    
    return cleaned;
  };
  
  /**
   * Generate a formatted phone number with spaces for display
   * @param {string} phoneNumber Raw phone number
   * @returns {string} Formatted phone number for display
   */
  const formatPhoneNumberForDisplay = (phoneNumber) => {
    const cleaned = formatPhoneNumber(phoneNumber);
    
    if (!cleaned) return '';
    
    // Format Moroccan international numbers: +212 6xx xx xx xx
    if (cleaned.startsWith('+212') && cleaned.length === 13) {
      return cleaned.replace(/(\+212)(\d{1})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2$3 $4 $5 $6');
    }
    
    // For other formats, add a space every 3 digits
    return cleaned.replace(/(\d{3})(?=\d)/g, '$1 ');
  };
  
  /**
   * Normalize a city name to standard format
   * @param {string} city Input city name
   * @returns {string} Normalized city name
   */
  const normalizeCity = (city) => {
    if (!city) return '';
    
    // Map of common misspellings or variations to normalized names
    const cityNormalization = {
      'casa': 'Casablanca',
      'casablanca': 'Casablanca',
      'rbat': 'Rabat',
      'rabat': 'Rabat',
      'fes': 'Fès',
      'fès': 'Fès',
      'marrakech': 'Marrakech',
      'marrakesh': 'Marrakech',
      'tanger': 'Tanger',
      'tangier': 'Tanger',
      'agadir': 'Agadir',
      'meknes': 'Meknès',
      'meknès': 'Meknès',
      'oujda': 'Oujda',
      'kenitra': 'Kénitra',
      'kénitra': 'Kénitra',
      'temara': 'Témara',
      'témara': 'Témara',
      'tetouan': 'Tétouan',
      'tétouan': 'Tétouan',
      'mohammedia': 'Mohammedia',
      'eljadida': 'El Jadida',
      'el jadida': 'El Jadida',
      'safi': 'Safi',
      'beni mellal': 'Béni Mellal',
      'béni mellal': 'Béni Mellal',
      'nador': 'Nador',
      'khouribga': 'Khouribga',
      'settat': 'Settat'
    };
    
    const lowercaseCity = city.toLowerCase();
    return cityNormalization[lowercaseCity] || 
      (city.charAt(0).toUpperCase() + city.slice(1).toLowerCase());
  };
  
  /**
   * Detect if text is likely a contact information submission
   * @param {string} text Message text
   * @returns {boolean} True if the message appears to be contact information
   */
  const isLikelyContactInfo = (text) => {
    if (!text || typeof text !== 'string') return false;
    
    // Check for phone number pattern
    const hasPhoneNumber = /(?:(?:\+|00)212|0)\s*[67]\d{8}/.test(text);
    
    // Check for name pattern indicators
    const hasNameIndicator = /(?:my name|je m'appelle|je suis|i am|name|nom)/.test(text.toLowerCase());
    
    // Check for city pattern indicators
    const hasCityIndicator = /(?:city|ville|from|de|j'habite à|vit à)/.test(text.toLowerCase());
    
    // Count the number of indicators present
    let indicatorCount = 0;
    if (hasPhoneNumber) indicatorCount++;
    if (hasNameIndicator) indicatorCount++;
    if (hasCityIndicator) indicatorCount++;
    
    // If the message has at least 2 indicators, it's likely contact info
    return indicatorCount >= 2 || hasPhoneNumber;
  };
  
  module.exports = {
    cleanText,
    formatPhoneNumber,
    formatPhoneNumberForDisplay,
    normalizeCity,
    isLikelyContactInfo
  };