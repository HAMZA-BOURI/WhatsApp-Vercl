// services/conversation-manager.js
class ConversationManager {
    constructor() {
      this.conversations = new Map();
      this.conversationStates = {
        GREETING: 'greeting',
        PRODUCT_INQUIRY: 'product_inquiry',
        INFO_COLLECTION: 'info_collection',
        CONFIRMATION_PENDING: 'confirmation_pending',
        COMPLETED: 'completed',
        IDLE: 'idle'
      };
    }
  
    // إنشاء أو استرجاع محادثة
    getConversation(phoneNumber) {
      if (!this.conversations.has(phoneNumber)) {
        this.conversations.set(phoneNumber, {
          id: phoneNumber,
          state: this.conversationStates.GREETING,
          messages: [],
          userData: {
            name: null,
            city: null,
            phoneNumber: phoneNumber,
            productInterest: null,
            completedFields: []
          },
          metadata: {
            startTime: new Date(),
            lastActivity: new Date(),
            messageCount: 0,
            infoAttempts: 0,
            language: 'arabic' // افتراضي
          }
        });
      }
      return this.conversations.get(phoneNumber);
    }
  
    // تحديث حالة المحادثة
    updateConversationState(phoneNumber, newState, additionalData = {}) {
      const conversation = this.getConversation(phoneNumber);
      conversation.state = newState;
      conversation.metadata.lastActivity = new Date();
      
      // دمج البيانات الإضافية
      Object.assign(conversation.userData, additionalData);
      
      this.conversations.set(phoneNumber, conversation);
      return conversation;
    }
  
    // إضافة رسالة للمحادثة
    addMessage(phoneNumber, message, sender = 'user') {
      const conversation = this.getConversation(phoneNumber);
      conversation.messages.push({
        content: message,
        sender: sender,
        timestamp: new Date(),
        processed: false
      });
      
      conversation.metadata.messageCount++;
      conversation.metadata.lastActivity = new Date();
      
      // الاحتفاظ بآخر 20 رسالة فقط
      if (conversation.messages.length > 20) {
        conversation.messages = conversation.messages.slice(-20);
      }
      
      this.conversations.set(phoneNumber, conversation);
      return conversation;
    }
  
    // فحص ما إذا كانت المحادثة مكتملة
    isConversationComplete(phoneNumber) {
      const conversation = this.getConversation(phoneNumber);
      return conversation.state === this.conversationStates.COMPLETED;
    }
  
    // فحص ما إذا كان العميل في انتظار التأكيد
    isPendingConfirmation(phoneNumber) {
      const conversation = this.getConversation(phoneNumber);
      return conversation.state === this.conversationStates.CONFIRMATION_PENDING;
    }
  
    // الحصول على البيانات الناقصة
    getMissingUserData(phoneNumber) {
      const conversation = this.getConversation(phoneNumber);
      const userData = conversation.userData;
      const missing = [];
      
      if (!userData.name || userData.name.trim() === '') missing.push('name');
      if (!userData.city || userData.city.trim() === '') missing.push('city');
      
      return missing;
    }
  
    // تنظيف المحادثات القديمة (أكثر من 24 ساعة)
    cleanupOldConversations() {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      for (const [phoneNumber, conversation] of this.conversations.entries()) {
        if (conversation.metadata.lastActivity < twentyFourHoursAgo) {
          this.conversations.delete(phoneNumber);
        }
      }
    }
  
    // إعادة تعيين حالة المحادثة للعملاء الذين أكملوا العملية
    resetCompletedConversation(phoneNumber) {
      const conversation = this.getConversation(phoneNumber);
      conversation.state = this.conversationStates.IDLE;
      conversation.metadata.lastActivity = new Date();
      this.conversations.set(phoneNumber, conversation);
    }
  
    // الحصول على إحصائيات المحادثات
    getConversationStats() {
      const stats = {
        total: this.conversations.size,
        byState: {},
        activeToday: 0
      };
  
      const today = new Date();
      today.setHours(0, 0, 0, 0);
  
      for (const conversation of this.conversations.values()) {
        // إحصائيات حسب الحالة
        stats.byState[conversation.state] = (stats.byState[conversation.state] || 0) + 1;
        
        // المحادثات النشطة اليوم
        if (conversation.metadata.lastActivity >= today) {
          stats.activeToday++;
        }
      }
  
      return stats;
    }
  }
  
  // إنشاء مثيل واحد للاستخدام في التطبيق
  const conversationManager = new ConversationManager();
  
  // تنظيف المحادثات القديمة كل ساعة
  setInterval(() => {
    conversationManager.cleanupOldConversations();
  }, 60 * 60 * 1000);
  
  module.exports = conversationManager;