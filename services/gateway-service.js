// services/gateway-service.js - Service to connect Vercel deployment with self-hosted WhatsApp server
const axios = require('axios');

class GatewayService {
  constructor() {
    this.whatsappApiUrl = process.env.WHATSAPP_API_URL || '';
    this.whatsappApiKey = process.env.WHATSAPP_API_KEY || '';
    
    // Cache for status and stats to reduce API calls
    this.cache = {
      status: null,
      stats: null,
      lastStatusCheck: 0,
      lastStatsCheck: 0,
      cacheTime: 60 * 1000 // 1 minute cache
    };
    
    // Track basic stats
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastError: null
    };
  }

  /**
   * Check if the gateway is properly configured
   */
  isConfigured() {
    return !!this.whatsappApiUrl;
  }

  /**
   * Create headers with authentication if available
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (this.whatsappApiKey) {
      headers['X-API-Key'] = this.whatsappApiKey;
    }
    
    return headers;
  }

  /**
   * Process a message through the self-hosted WhatsApp service
   */
  async processMessage(message, phoneNumber) {
    if (!this.isConfigured()) {
      return this.getLocalResponse(message, phoneNumber);
    }
    
    this.stats.totalRequests++;
    
    try {
      const response = await axios.post(
        `${this.whatsappApiUrl}/api/remote/process-message`,
        { message, phoneNumber },
        { headers: this.getHeaders(), timeout: 15000 }
      );
      
      this.stats.successfulRequests++;
      return response.data;
    } catch (error) {
      this.handleError(error, 'Error processing message through gateway');
      return this.getLocalResponse(message, phoneNumber);
    }
  }

  /**
   * Get WhatsApp status from self-hosted server
   */
  async getWhatsappStatus() {
    const now = Date.now();
    
    // Return cached status if available and fresh
    if (this.cache.status && (now - this.cache.lastStatusCheck < this.cache.cacheTime)) {
      return this.cache.status;
    }
    
    if (!this.isConfigured()) {
      return {
        connected: false,
        qr: null,
        stats: {
          isConnected: false,
          uptime: 'N/A',
          totalMessages: 0,
          clientsHelped: 0,
          aiResponses: 0
        },
        gateway: {
          configured: false,
          message: 'Gateway not configured'
        }
      };
    }
    
    try {
      const response = await axios.get(
        `${this.whatsappApiUrl}/api/remote/whatsapp-status`,
        { headers: this.getHeaders(), timeout: 5000 }
      );
      
      // Update cache
      this.cache.status = response.data;
      this.cache.lastStatusCheck = now;
      
      return response.data;
    } catch (error) {
      this.handleError(error, 'Error getting WhatsApp status');
      
      return {
        connected: false,
        qr: null,
        stats: {
          isConnected: false,
          uptime: 'N/A',
          totalMessages: 0,
          clientsHelped: 0,
          aiResponses: 0
        },
        gateway: {
          configured: true,
          error: error.message,
          url: this.getSafeUrl()
        }
      };
    }
  }

  /**
   * Send a message through the self-hosted WhatsApp service
   */
  async sendMessage(phoneNumber, message) {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Gateway not configured',
        gateway: {
          configured: false
        }
      };
    }
    
    this.stats.totalRequests++;
    
    try {
      const response = await axios.post(
        `${this.whatsappApiUrl}/api/remote/send-message`,
        { phoneNumber, message },
        { headers: this.getHeaders(), timeout: 10000 }
      );
      
      this.stats.successfulRequests++;
      return response.data;
    } catch (error) {
      this.handleError(error, 'Error sending message through gateway');
      
      return {
        success: false,
        error: error.message,
        gateway: {
          configured: true,
          error: error.message
        }
      };
    }
  }

  /**
   * Get detailed statistics from self-hosted server
   */
  async getDetailedStats() {
    const now = Date.now();
    
    // Return cached stats if available and fresh
    if (this.cache.stats && (now - this.cache.lastStatsCheck < this.cache.cacheTime)) {
      return this.cache.stats;
    }
    
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Gateway not configured',
        gateway: this.getGatewayStats()
      };
    }
    
    try {
      const response = await axios.get(
        `${this.whatsappApiUrl}/api/remote/stats`,
        { headers: this.getHeaders(), timeout: 5000 }
      );
      
      // Update cache
      this.cache.stats = {
        ...response.data,
        gateway: this.getGatewayStats()
      };
      this.cache.lastStatsCheck = now;
      
      return this.cache.stats;
    } catch (error) {
      this.handleError(error, 'Error getting detailed stats');
      
      return {
        success: false,
        error: error.message,
        gateway: this.getGatewayStats()
      };
    }
  }

  /**
   * Handle API errors
   */
  handleError(error, message) {
    console.error(`${message}:`, error.message);
    
    this.stats.failedRequests++;
    this.stats.lastError = {
      message: error.message,
      timestamp: new Date().toISOString(),
      url: error.config?.url ? this.getSafeUrl(error.config.url) : 'unknown'
    };
    
    // Clear cache on error
    this.clearCache();
  }

  /**
   * Get basic gateway statistics
   */
  getGatewayStats() {
    return {
      configured: this.isConfigured(),
      url: this.getSafeUrl(),
      totalRequests: this.stats.totalRequests,
      successRate: this.stats.totalRequests > 0 ? 
        Math.round((this.stats.successfulRequests / this.stats.totalRequests) * 100) + '%' : 'N/A',
      lastError: this.stats.lastError
    };
  }

  /**
   * Return a local response when gateway is not available
   */
  getLocalResponse(message, phoneNumber) {
    return {
      success: false,
      message: 'This is a serverless deployment. WhatsApp integration is only available on the self-hosted server.',
      response: 'سنقوم بالرد عليك قريباً. شكراً للتواصل معنا.',
      gateway: {
        configured: this.isConfigured(),
        error: this.isConfigured() ? 'Gateway error' : 'Gateway not configured'
      }
    };
  }

  /**
   * Get a safe URL for logging (hide API key)
   */
  getSafeUrl(url = this.whatsappApiUrl) {
    if (!url) return 'not configured';
    
    try {
      // Hide sensitive parts of URL for logging
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}/*****`;
    } catch (e) {
      return 'invalid url';
    }
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.status = null;
    this.cache.stats = null;
    this.cache.lastStatusCheck = 0;
    this.cache.lastStatsCheck = 0;
  }

  /**
   * Test the gateway connection
   */
  async testConnection() {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Gateway not configured',
        gateway: this.getGatewayStats()
      };
    }
    
    try {
      const response = await axios.get(
        `${this.whatsappApiUrl}/health`,
        { headers: this.getHeaders(), timeout: 5000 }
      );
      
      return {
        success: true,
        message: 'Gateway connection successful',
        response: response.data,
        gateway: this.getGatewayStats()
      };
    } catch (error) {
      this.handleError(error, 'Error testing gateway connection');
      
      return {
        success: false,
        message: 'Gateway connection failed',
        error: error.message,
        gateway: this.getGatewayStats()
      };
    }
  }
}

module.exports = new GatewayService();