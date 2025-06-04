// routes/confirmations.js - Fixed version with WhatsApp Unified Service
const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const whatsappService = require('../services/whatsapp-unified'); // استخدام الخدمة الموحدة

// الحصول على قائمة العملاء في انتظار التأكيد
router.get('/', (req, res) => {
  try {
    // الحصول على الإحصائيات من الخدمة الموحدة
    const stats = whatsappService.getStats();
    const pendingClientInfo = stats.clientInfo || {};
    
    // إنشاء قائمة وهمية إذا لم تكن هناك بيانات حقيقية
    // في التطبيق الحقيقي، ستحصل على هذه البيانات من whatsappService.pendingClientInfo
    const pendingConfirmations = [];
    
    // محاولة الحصول على البيانات الحقيقية إذا كانت متاحة
    if (whatsappService.pendingClientInfo && whatsappService.pendingClientInfo.size > 0) {
      for (const [phoneNumber, info] of whatsappService.pendingClientInfo.entries()) {
        if (info.processed) {
          pendingConfirmations.push({
            phoneNumber,
            timestamp: info.timestamp,
            clientData: info.clientData || {},
            waitingTime: Math.round((new Date() - new Date(info.timestamp)) / (1000 * 60)) // بالدقائق
          });
        }
      }
    }
    
    // ترتيب حسب التوقيت
    pendingConfirmations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    res.json({
      success: true,
      pendingConfirmations,
      count: pendingConfirmations.length
    });
  } catch (error) {
    console.error('Error getting pending confirmations:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// تأكيد طلب عميل
router.post('/confirm/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { message, status } = req.body;
    
    // التحقق من وجود العميل في قائمة الانتظار
    if (!whatsappService.pendingClientInfo || 
        !whatsappService.pendingClientInfo.has(phoneNumber)) {
      return res.status(404).json({
        success: false,
        message: 'Client not found in pending confirmations'
      });
    }
    
    // التحقق من جاهزية عميل WhatsApp
    if (!whatsappService.isClientReady) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp client is not connected'
      });
    }
    
    // إعداد رسالة التأكيد
    const confirmationMessage = message || 'تم تأكيد طلبك بنجاح. شكراً لك على ثقتك فينا. سيتواصل معك فريق التوصيل قريباً.';
    
    // تنسيق رقم WhatsApp
    let whatsappNumber = phoneNumber;
    if (!whatsappNumber.includes('@c.us')) {
      whatsappNumber = `${whatsappNumber}@c.us`;
    }
    
    // إرسال رسالة التأكيد
    const sendResult = await whatsappService.sendManualMessage(whatsappNumber, confirmationMessage);
    
    if (!sendResult.success) {
      return res.status(500).json({
        success: false,
        message: `Failed to send message: ${sendResult.error}`
      });
    }
    
    // تحديث حالة العميل في قاعدة البيانات
    try {
      const customer = await Customer.findOne({ phoneNumber });
      if (customer) {
        customer.orderStatus = status || 'confirmed';
        customer.lastContactDate = new Date();
        customer.notes = customer.notes ? 
          `${customer.notes}\nConfirmed on ${new Date().toISOString()}` : 
          `Confirmed on ${new Date().toISOString()}`;
        await customer.save();
        console.log(`✅ Customer ${phoneNumber} status updated to ${customer.orderStatus}`);
      }
    } catch (dbError) {
      console.error('Error updating customer status:', dbError);
      // المتابعة رغم خطأ قاعدة البيانات
    }
    
    // إعادة تعيين حالة العميل للسماح بتفاعلات جديدة
    whatsappService.resetClientConfirmationStatus(phoneNumber);
    
    res.json({
      success: true,
      message: 'Confirmation message sent successfully',
      customerUpdated: true
    });
  } catch (error) {
    console.error('Error confirming order:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// رفض طلب عميل
router.post('/reject/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { message, reason } = req.body;
    
    // التحقق من وجود العميل في قائمة الانتظار
    if (!whatsappService.pendingClientInfo || 
        !whatsappService.pendingClientInfo.has(phoneNumber)) {
      return res.status(404).json({
        success: false,
        message: 'Client not found in pending confirmations'
      });
    }
    
    // التحقق من جاهزية عميل WhatsApp
    if (!whatsappService.isClientReady) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp client is not connected'
      });
    }
    
    // إعداد رسالة الرفض
    const rejectionMessage = message || 'نعتذر، ولكن لا يمكننا تأكيد طلبك في الوقت الحالي. سيتواصل معك فريق خدمة العملاء لمزيد من التوضيح.';
    
    // تنسيق رقم WhatsApp
    let whatsappNumber = phoneNumber;
    if (!whatsappNumber.includes('@c.us')) {
      whatsappNumber = `${whatsappNumber}@c.us`;
    }
    
    // إرسال رسالة الرفض
    const sendResult = await whatsappService.sendManualMessage(whatsappNumber, rejectionMessage);
    
    if (!sendResult.success) {
      return res.status(500).json({
        success: false,
        message: `Failed to send message: ${sendResult.error}`
      });
    }
    
    // تحديث حالة العميل في قاعدة البيانات
    try {
      const customer = await Customer.findOne({ phoneNumber });
      if (customer) {
        customer.orderStatus = 'rejected';
        customer.lastContactDate = new Date();
        customer.notes = customer.notes ? 
          `${customer.notes}\nRejected: ${reason || 'No reason provided'} on ${new Date().toISOString()}` : 
          `Rejected: ${reason || 'No reason provided'} on ${new Date().toISOString()}`;
        await customer.save();
        console.log(`❌ Customer ${phoneNumber} status updated to rejected`);
      }
    } catch (dbError) {
      console.error('Error updating customer status:', dbError);
      // المتابعة رغم خطأ قاعدة البيانات
    }
    
    // إعادة تعيين حالة العميل للسماح بتفاعلات جديدة
    whatsappService.resetClientConfirmationStatus(phoneNumber);
    
    res.json({
      success: true,
      message: 'Rejection message sent successfully',
      customerUpdated: true
    });
  } catch (error) {
    console.error('Error rejecting order:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// إعادة تعيين حالة عميل (للاختبار أو الإدارة)
router.post('/reset/:phoneNumber', (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    const resetResult = whatsappService.resetClientConfirmationStatus(phoneNumber);
    
    if (resetResult) {
      res.json({
        success: true,
        message: `Client ${phoneNumber} confirmation status reset successfully`
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Client ${phoneNumber} not found in pending confirmations`
      });
    }
  } catch (error) {
    console.error('Error resetting client status:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// الحصول على إحصائيات التأكيدات
router.get('/stats', async (req, res) => {
  try {
    const stats = whatsappService.getStats();
    
    // إحصائيات من قاعدة البيانات
    const [confirmedCount, rejectedCount, pendingCount] = await Promise.all([
      Customer.countDocuments({ orderStatus: 'confirmed' }),
      Customer.countDocuments({ orderStatus: 'rejected' }),
      Customer.countDocuments({ orderStatus: 'pending' })
    ]);
    
    res.json({
      success: true,
      stats: {
        clientInfo: stats.clientInfo || {},
        database: {
          confirmed: confirmedCount,
          rejected: rejectedCount,
          pending: pendingCount,
          total: confirmedCount + rejectedCount + pendingCount
        },
        whatsapp: {
          connected: stats.isConnected,
          totalMessages: stats.totalMessages,
          clientsHelped: stats.clientsHelped
        }
      }
    });
  } catch (error) {
    console.error('Error getting confirmation stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// إرسال رسالة مخصصة لعميل معين
router.post('/send-custom-message/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }
    
    if (!whatsappService.isClientReady) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp client is not connected'
      });
    }
    
    // تنسيق رقم WhatsApp
    let whatsappNumber = phoneNumber;
    if (!whatsappNumber.includes('@c.us')) {
      whatsappNumber = `${whatsappNumber}@c.us`;
    }
    
    // إرسال الرسالة
    const sendResult = await whatsappService.sendManualMessage(whatsappNumber, message.trim());
    
    if (sendResult.success) {
      // تحديث آخر تاريخ تواصل
      try {
        const customer = await Customer.findOne({ phoneNumber });
        if (customer) {
          customer.lastContactDate = new Date();
          await customer.save();
        }
      } catch (dbError) {
        console.error('Error updating customer last contact:', dbError);
      }
      
      res.json({
        success: true,
        message: 'Custom message sent successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to send message: ${sendResult.error}`
      });
    }
  } catch (error) {
    console.error('Error sending custom message:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// الحصول على تفاصيل عميل معين
router.get('/client/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    // البحث في قاعدة البيانات
    const customer = await Customer.findOne({ phoneNumber });
    
    // البحث في قائمة الانتظار
    const pendingInfo = whatsappService.pendingClientInfo ? 
      whatsappService.pendingClientInfo.get(phoneNumber) : null;
    
    // الحصول على معلومات المحادثة
    const conversationInfo = whatsappService.getConversationInfo(phoneNumber);
    
    if (!customer && !pendingInfo) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    res.json({
      success: true,
      client: {
        database: customer ? {
          name: customer.name,
          phoneNumber: customer.phoneNumber,
          city: customer.city,
          orderStatus: customer.orderStatus,
          messageCount: customer.messageCount,
          firstContactDate: customer.firstContactDate,
          lastContactDate: customer.lastContactDate,
          notes: customer.notes
        } : null,
        pending: pendingInfo ? {
          processed: pendingInfo.processed,
          timestamp: pendingInfo.timestamp,
          clientData: pendingInfo.clientData,
          reminderSent: pendingInfo.reminderSent
        } : null,
        conversation: conversationInfo
      }
    });
  } catch (error) {
    console.error('Error getting client details:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;