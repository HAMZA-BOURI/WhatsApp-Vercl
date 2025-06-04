// services/whatsapp.js - Version corrigée avec gestion des messages améliorée
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const Customer = require('../models/Customer');
const multimediaService = require('./multimedia');
const aiEnhanced = require('./ai');
const { isLikelyContactInfo } = require('./data-utils');
const aiClientExtraction = require('./ai-client-extraction');
const dataProcessingService = require('./data-processing');
const messageQueue = new Map();
const RATE_LIMIT = 2000; // 2 ثانية بين الرسائل
// Global cache for WhatsApp sessions and settings
global.whatsappCache = {
  client: null,
  qr: null,
  settings: {
    enableAutoReply: true,
    enableAI: true,
    enableClientInfoExtraction: true,
    delay: 2,
  },
  startTime: new Date(),
  messageCount: 0,
  conversations: {},
  pendingClientInfo: {},
  clientInfoRequests: {}
};

// Default welcome message
let WELCOME_MESSAGE = `مرحبًا بك في متجرنا الإلكتروني!
شكرًا لتواصلك معنا. يمكنك تصفح منتجاتنا على موقعنا: 
www.yourstore.com

فريق خدمة العملاء متواجد للرد على استفساراتك خلال ساعات العمل:
السبت إلى الخميس: 9:00 ص - 9:00 م

استمتع بتجربة تسوق رائعة!`;

// Load welcome message from configuration
const loadWelcomeMessage = () => {
  try {
    const configPath = path.join(__dirname, '../config');
    const filePath = path.join(configPath, 'welcome-message.json');
    
    if (!fs.existsSync(configPath)) {
      fs.mkdirSync(configPath, { recursive: true });
    }
    
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && parsed.message) {
        WELCOME_MESSAGE = parsed.message;
        console.log('Welcome message loaded from configuration.');
      }
    } else {
      const defaultMessage = { message: WELCOME_MESSAGE };
      fs.writeFileSync(filePath, JSON.stringify(defaultMessage, null, 2));
      console.log('Default welcome message file created.');
    }
  } catch (error) {
    console.error('Error loading welcome message:', error);
  }
};

// Update welcome message
const updateWelcomeMessage = (message) => {
  if (message) {
    WELCOME_MESSAGE = message;
    console.log('Welcome message updated.');
    
    try {
      const configPath = path.join(__dirname, '../config');
      const filePath = path.join(configPath, 'welcome-message.json');
      
      if (!fs.existsSync(configPath)) {
        fs.mkdirSync(configPath, { recursive: true });
      }
      
      fs.writeFileSync(filePath, JSON.stringify({ message }, null, 2));
      console.log('Welcome message saved to configuration file.');
    } catch (error) {
      console.error('Error saving welcome message:', error);
    }
  }
};

// Update settings
const updateSettings = (settings) => {
  if (settings) {
    global.whatsappCache.settings = { ...global.whatsappCache.settings, ...settings };
    console.log('Settings updated:', global.whatsappCache.settings);
  }
};

// Helper function to detect language
const detectLanguage = (text) => {
  const arabicPattern = /[\u0600-\u06FF]/;
  const frenchPattern = /[éèêëàâäôöùûüÿçîïÉÈÊËÀÂÄÔÖÙÛÜŸÇÎÏ]/;
  
  const darijaPatterns = [
    /\b(wach|wash|labas|l3afu|smh|smha|bghit|bghina|khoya|khouya|sahbi|sahbti|mrhba|fin|feen|chno|wa|wah|hna|fash|kayn|zwin|zwina)\b/i,
    /\b(nta|nti|huma|hna|dyal|dial|mashi|kifash|kifach|wakha|wakhkha|wxa)\b/i
  ];
  
  const hasDarijaWords = darijaPatterns.some(pattern => pattern.test(text.toLowerCase()));
  
  if (hasDarijaWords || 
      (arabicPattern.test(text) && (frenchPattern.test(text) || /[0-9]/.test(text))) ||
      /\b(salam|salamo|salam alikom|mrk7ba|mrhba|mrh7ba)\b/i.test(text)) {
    return 'darija';
  }
  
  if (arabicPattern.test(text)) return 'arabic';
  if (frenchPattern.test(text)) return 'french';
  
  return 'french';
};

// Process client information from message with blocking mechanism
const processClientInfoFromMessage = async (message, customer, analysis) => {
  try {
    if (!global.whatsappCache.settings.enableClientInfoExtraction) {
      return { processed: false, reason: 'feature_disabled' };
    }
    
    const phoneNumber = message.from.split('@')[0];
    
    // Block further processing if client is already in confirmation queue
    if (global.whatsappCache.pendingClientInfo[phoneNumber] && 
        global.whatsappCache.pendingClientInfo[phoneNumber].processed) {
      
      if (!global.whatsappCache.pendingClientInfo[phoneNumber].reminderSent) {
        const reminderMessage = detectLanguage(message.body) === 'arabic' ? 
          'شكراً لمشاركة معلوماتك. سيتصل بك أحد ممثلي فريقنا قريبًا لتأكيد طلبك.' :
          'شكرا على المعلومات ديالك. غادي يتواصل معاك واحد من الفريق ديالنا عما قريب باش ناكدو الطلبية ديالك.';
        
        try {
          await global.whatsappCache.client.sendMessage(message.from, reminderMessage);
          global.whatsappCache.pendingClientInfo[phoneNumber].reminderSent = true;
        } catch (sendError) {
          console.error('Error sending reminder message:', sendError);
        }
      }
      
      return { 
        processed: true, 
        success: true,
        blocked: true,
        message: 'Client already in confirmation queue'
      };
    }
    
    const isContactInfo = isLikelyContactInfo(message.body);
    
    if (!isContactInfo && !global.whatsappCache.clientInfoRequests[phoneNumber]) {
      return { processed: false, reason: 'not_contact_info' };
    }
    
    // Extract client information using Gemini API
    const extractionResult = await aiClientExtraction.extractClientInfoWithGemini(
      message.body,
      {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        GEMINI_API_URL: process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
      }
    );
    
    if (extractionResult.success) {
      const clientData = dataProcessingService.formatClientInfo({
        ...extractionResult,
        phoneNumber
      });
      
      const validation = dataProcessingService.validateClientInfo(clientData);
      
      if (validation.isValid) {
        try {
          const googleSheetsService = require('./google-sheets');
          const result = await googleSheetsService.addClientToSheet(clientData);
          
          if (result.success) {
            delete global.whatsappCache.clientInfoRequests[phoneNumber];
            
            global.whatsappCache.pendingClientInfo[phoneNumber] = {
              processed: true,
              timestamp: new Date(),
              reminderSent: false,
              clientData: clientData
            };
            
            let confirmationMessage;
            
            if (analysis && analysis.analysis && analysis.analysis.language) {
              switch(analysis.analysis.language) {
                case 'arabic':
                  confirmationMessage = 'شكراً لمشاركة معلوماتك. سيتصل بك أحد ممثلي فريقنا قريبًا لتأكيد طلبك.';
                  break;
                case 'darija':
                  confirmationMessage = 'شكرا على المعلومات ديالك. غادي يتواصل معاك واحد من الفريق ديالنا عما قريب باش ناكدو الطلبية ديالك.';
                  break;
                default:
                  confirmationMessage = 'Merci pour vos informations. Un membre de notre équipe vous contactera prochainement pour confirmer votre commande.';
              }
            } else {
              confirmationMessage = 'شكرا على المعلومات ديالك. غادي يتواصل معاك واحد من الفريق ديالنا عما قريب باش ناكدو الطلبية ديالك.';
            }
            
            setTimeout(async () => {
              try {
                await global.whatsappCache.client.sendMessage(message.from, confirmationMessage);
              } catch (sendError) {
                console.error('Error sending confirmation message:', sendError);
              }
            }, 1000);
            
            return { 
              processed: true, 
              success: true,
              clientData 
            };
          }
        } catch (apiError) {
          console.error('Error calling API to store client info:', apiError);
        }
      }
    }
    
    // Request more information if extraction failed
    if (!global.whatsappCache.clientInfoRequests[phoneNumber]) {
      global.whatsappCache.clientInfoRequests[phoneNumber] = {
        requested: true,
        timestamp: new Date()
      };
      
      let requestMessage;
      
      if (analysis && analysis.analysis && analysis.analysis.language) {
        switch(analysis.analysis.language) {
          case 'arabic':
            requestMessage = 'لمساعدتك بشكل أفضل، هل يمكنك مشاركة اسمك ومدينتك معنا؟';
            break;
          case 'darija':
            requestMessage = 'باش نعاونوك بشكل أفضل، واش ممكن تعطينا سميتك والمدينة ديالك؟';
            break;
          default:
            requestMessage = 'Pour mieux vous aider, pourriez-vous nous communiquer votre nom et votre ville ?';
        }
      } else {
        requestMessage = 'باش نعاونوك بشكل أفضل، واش ممكن تعطينا سميتك والمدينة ديالك؟';
      }
      
      setTimeout(async () => {
        try {
          await global.whatsappCache.client.sendMessage(message.from, requestMessage);
        } catch (sendError) {
          console.error('Error sending info request message:', sendError);
        }
      }, 1000);
      
      return { 
        processed: true, 
        success: false,
        infoRequested: true
      };
    }
    
    return { 
      processed: false, 
      reason: 'extraction_failed',
      extractionResult
    };
  } catch (error) {
    console.error('Error processing client info from message:', error);
    return { 
      processed: false, 
      reason: 'error',
      error: error.message
    };
  }
};

// Reset client confirmation status
const resetClientConfirmationStatus = (phoneNumber) => {
  if (global.whatsappCache.pendingClientInfo[phoneNumber]) {
    delete global.whatsappCache.pendingClientInfo[phoneNumber];
    console.log(`Client confirmation status reset for ${phoneNumber}`);
    return true;
  }
  return false;
};

// Send welcome message with media
const sendWelcomeMessage = async (client, recipient) => {
  try {
    if (!client || !client.info) {
      console.error('WhatsApp client not initialized when trying to send message.');
      return false;
    }
    
    // Send text message
    await client.sendMessage(recipient, WELCOME_MESSAGE);
    
    // Send images
    const images = await multimediaService.getMediaFiles('images');
    for (const image of images) {
      try {
        const media = multimediaService.createMessageMedia('images', image);
        if (media) {
          await client.sendMessage(recipient, media);
          await new Promise(resolve => setTimeout(resolve, global.whatsappCache.settings.delay * 1000));
        }
      } catch (imgError) {
        console.error(`Error sending image ${image}:`, imgError);
      }
    }
    
    // Send videos
    const videos = await multimediaService.getMediaFiles('videos');
    for (const video of videos) {
      try {
        const media = multimediaService.createMessageMedia('videos', video);
        if (media) {
          await client.sendMessage(recipient, media);
          await new Promise(resolve => setTimeout(resolve, global.whatsappCache.settings.delay * 1000));
        }
      } catch (videoError) {
        console.error(`Error sending video ${video}:`, videoError);
      }
    }
    
    // Send audio files
    const audioFiles = await multimediaService.getMediaFiles('audio');
    for (const audio of audioFiles) {
      try {
        const media = multimediaService.createMessageMedia('audio', audio);
        if (media) {
          await client.sendMessage(recipient, media);
          await new Promise(resolve => setTimeout(resolve, global.whatsappCache.settings.delay * 1000));
        }
      } catch (audioError) {
        console.error(`Error sending audio file ${audio}:`, audioError);
      }
    }
    
    console.log(`Welcome message and media sent to ${recipient}`);
    return true;
  } catch (error) {
    console.error(`Error sending welcome message to ${recipient}:`, error);
    return false;
  }
};

// Handle common messages (prix, tarif, etc.)
const handleCommonMessages = async (message) => {
  const messageText = message.body.toLowerCase();
  const phoneNumber = message.from.split('@')[0];
  
  // Price request patterns in multiple languages
  const pricePatterns = [
    /^prix(\s+)?$/i,
    /^(tarif|cout|combien)(\s+)?$/i,
    /^(ثمن|سعر|بشحال|شحال)(\s+)?$/i,
    /^(ch7al|shhal|bchhal|bshhal)(\s+)?$/i,
    /^prix\??$/i,
    /^(cout|tarif)\??$/i,
    /combien.*co(û|u)te/i,
    /بشحال الثمن/i,
    /ch7al taman/i
  ];
  
  if (pricePatterns.some(pattern => pattern.test(messageText))) {
    let responseMessage = "";
    
    if (/[\u0600-\u06FF]/.test(messageText)) {
      responseMessage = "الثمن ديال المنتج هو 499 درهم. يمكنك طلب المزيد من المعلومات أو صور إضافية إذا كنت مهتم. 😊";
    } else {
      responseMessage = "Le prix de ce produit est de 499 MAD. N'hésitez pas à demander plus d'informations ou des photos supplémentaires si vous êtes intéressé(e). 😊";
    }
    
    try {
      await message.reply(responseMessage);
      
      if (global.whatsappCache) {
        global.whatsappCache.messageCount = (global.whatsappCache.messageCount || 0) + 1;
      }
      
      // Update customer in database
      try {
        const customer = await Customer.findOne({ phoneNumber });
        if (customer) {
          customer.lastContactDate = new Date();
          customer.messageCount += 1;
          await customer.save();
        }
      } catch (dbError) {
        console.error('Error updating customer:', dbError);
      }
      
      return true;
    } catch (error) {
      console.error('Error sending response:', error);
      return false;
    }
  }
  
  return false;
};

// Initialize WhatsApp client
const initWhatsAppClient = async () => {
  try {
    loadWelcomeMessage();
    multimediaService.initMediaDirectories();
    
    // Remove old session files
    const authFolder = path.join(__dirname, '../.wwebjs_auth');
    if (fs.existsSync(authFolder)) {
      try {
        console.log("Removing previous authentication data...");
        deleteFolder(authFolder);
        console.log("Authentication data removed successfully");
      } catch (err) {
        console.error("Error removing authentication data:", err);
      }
    }
    
    // Create new WhatsApp client
    const client = new Client({
      authStrategy: new LocalAuth({ 
        dataPath: path.join(__dirname, '../.wwebjs_auth'),
        clientId: 'whatsapp-bot-enhanced' 
      }),
      puppeteer: {
        headless: process.env.NODE_ENV === 'production',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, 
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-dev-shm-usage', 
          '--window-size=1280,800' 
        ],
        timeout: 180000,
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
    client.on('message', async (message) => {
      try {
        const phoneNumber = message.from.split('@')[0];
        const now = Date.now();
        
        // فحص Rate Limiting
        if (messageQueue.has(phoneNumber)) {
          const lastMessage = messageQueue.get(phoneNumber);
          if (now - lastMessage < RATE_LIMIT) {
            console.log(`Rate limited for ${phoneNumber}`);
            return; // تجاهل الرسالة إذا كانت سريعة جداً
          }
        }
        
        messageQueue.set(phoneNumber, now);
        
        // التأكد من عدم معالجة نفس الرسالة مرتين
        if (message.fromMe || message.isStatus) {
          return;
        }
        
        // فحص إذا كانت الرسالة معالجة مسبقاً
        const messageId = message.id._serialized;
        if (global.processedMessages && global.processedMessages.has(messageId)) {
          return;
        }
        
        // إضافة الرسالة للمعالجة
        if (!global.processedMessages) {
          global.processedMessages = new Set();
        }
        global.processedMessages.add(messageId);
        
        // معالجة الرسالة
        await processMessage(phoneNumber, message.body, client);
        
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
    // Event handlers
    client.on('qr', (qr) => {
      console.log('QR Code generated. Scan with WhatsApp:');
      qrcode.generate(qr, { small: true });
      global.whatsappCache.qr = qr;
      
      console.log('\nTo connect:');
      console.log('1. Open WhatsApp on your phone');
      console.log('2. Go to Settings > Connected Devices');
      console.log('3. Click "Link a Device"');
      console.log('4. Scan the QR code displayed above or in the web interface');
    });

    client.on('ready', () => {
      console.log('WhatsApp client ready!');
      global.whatsappCache.qr = null;
    });

    client.on('authenticated', () => {
      console.log('WhatsApp client authenticated');
    });

    client.on('auth_failure', (msg) => {
      console.error('Authentication failure:', msg);
      global.whatsappCache.qr = null;
    });

    client.on('disconnected', (reason) => {
      console.log('WhatsApp client disconnected:', reason);
      global.whatsappCache.client = null;
      global.whatsappCache.qr = null;
    });

    // Incoming message handling - CORRECTED VERSION
    client.on('message', async (message) => {
      try {
        if (!global.whatsappCache.settings.enableAutoReply) {
          console.log('Auto-replies disabled. Message ignored.');
          return;
        }
        
        if (message.from.endsWith('@c.us')) {
          const phoneNumber = message.from.split('@')[0];
          
          // Check if client is in confirmation queue
          if (global.whatsappCache.pendingClientInfo[phoneNumber] && 
              global.whatsappCache.pendingClientInfo[phoneNumber].processed) {
            
            if (!global.whatsappCache.pendingClientInfo[phoneNumber].reminderSent) {
              const reminderMessage = detectLanguage(message.body) === 'arabic' ? 
                'شكراً لمشاركة معلوماتك. سيتصل بك أحد ممثلي فريقنا قريبًا لتأكيد طلبك.' :
                'شكرا على المعلومات ديالك. غادي يتواصل معاك واحد من الفريق ديالنا عما قريب باش ناكدو الطلبية ديالك.';
              
              await client.sendMessage(message.from, reminderMessage);
              global.whatsappCache.pendingClientInfo[phoneNumber].reminderSent = true;
            }
            return;
          }
          
          // Try to handle common messages first
          const handledCommon = await handleCommonMessages(message);
          if (handledCommon) {
            return; // Message was handled as a common message
          }
          
          // Find or create customer
          let customer = await Customer.findOne({ phoneNumber });
          
          if (!customer) {
            const notifyName = message._data && message._data.notifyName 
              ? message._data.notifyName 
              : 'New customer';
                
            customer = new Customer({
              phoneNumber,
              name: notifyName
            });
            
            try {
              await customer.save();
              await sendWelcomeMessage(client, message.from);
              customer.receivedWelcomeMessage = true;
              await customer.save();
            } catch (saveError) {
              console.error('Error saving customer:', saveError);
            }
          } else {
            // Update existing customer
            try {
              customer.lastContactDate = new Date();
              customer.messageCount += 1;
              await customer.save();
              
              // Manage conversation history
              if (!global.whatsappCache.conversations[phoneNumber]) {
                global.whatsappCache.conversations[phoneNumber] = [];
              }
              
              global.whatsappCache.conversations[phoneNumber].push({
                role: 'user',
                content: message.body,
                timestamp: new Date()
              });
              
              if (global.whatsappCache.conversations[phoneNumber].length > 10) {
                global.whatsappCache.conversations[phoneNumber].shift();
              }
              
              // Show typing for natural experience
              try {
                const chat = await message.getChat();
                await chat.sendStateTyping();
              } catch (typingError) {
                console.error('Error showing typing indicator:', typingError);
              }
              
              // Natural response delay
              const typingDelay = 1000 + Math.floor(message.body.length * 30) + Math.random() * 1000;
              await new Promise(resolve => setTimeout(resolve, Math.min(typingDelay, 5000)));
              
              // Process client information extraction
              if (global.whatsappCache.settings.enableClientInfoExtraction) {
                const clientInfoResult = await processClientInfoFromMessage(
                  message, 
                  customer, 
                  null
                );
                
                if (clientInfoResult.processed && clientInfoResult.success) {
                  console.log(`Client info processed successfully for ${phoneNumber}`);
                  
                  if (clientInfoResult.clientData && clientInfoResult.clientData.name) {
                    customer.name = clientInfoResult.clientData.name;
                    if (clientInfoResult.clientData.city) {
                      customer.city = clientInfoResult.clientData.city;
                    }
                    await customer.save();
                    console.log(`Updated customer info: ${customer.name}, ${customer.city || 'No city'}`);
                  }
                  
                  return; // Skip AI processing
                }
              }
              
              // AI processing
              if (global.whatsappCache.settings.enableAI) {
                try {
                  const customerInfo = {
                    name: customer.name,
                    messageCount: customer.messageCount,
                    firstContact: customer.firstContactDate,
                    isNew: customer.messageCount <= 3
                  };
                  
                  const analysis = await aiEnhanced.analyzeMessageWithAI(
                    message.body, 
                    customerInfo,
                    global.whatsappCache.conversations[phoneNumber]
                  );
                  
                  // Check client info again with AI analysis
                  if (global.whatsappCache.settings.enableClientInfoExtraction) {
                    const clientInfoResult = await processClientInfoFromMessage(
                      message, 
                      customer, 
                      analysis
                    );
                    
                    if (clientInfoResult.processed && clientInfoResult.success) {
                      console.log(`Client info processed after AI analysis for ${phoneNumber}`);
                      return;
                    }
                  }
                  
                  // Add response to conversation history
                  global.whatsappCache.conversations[phoneNumber].push({
                    role: 'assistant',
                    content: analysis.response,
                    timestamp: new Date()
                  });
                  
                  // Send AI response
                  console.log(`Sending AI response: "${analysis.response}"`);
                  await client.sendMessage(message.from, analysis.response);
                  
                  global.whatsappCache.messageCount = (global.whatsappCache.messageCount || 0) + 1;
                  
                  console.log(`AI Performance: Generated=${analysis.aiGenerated}, Language=${analysis.analysis.language}`);
                } catch (aiError) {
                  console.error('Error processing with AI:', aiError);
                  
                  const fallbackMessage = "Désolé, une erreur s'est produite lors du traitement de votre message. Un de nos représentants du service client vous contactera bientôt.";
                  await client.sendMessage(message.from, fallbackMessage);
                }
              }
            } catch (updateError) {
              console.error('Error updating customer:', updateError);
            }
          }
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    // Start client
    console.log('Initializing WhatsApp client... This may take a moment.');
    await client.initialize();
    
    global.whatsappCache.client = client;
    
    return client;
  } catch (error) {
    console.error('Error initializing WhatsApp client:', error);
    global.whatsappCache.client = null;
    throw error;
  }
};

// Delete folder recursively
const deleteFolder = (folderPath) => {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const currentPath = path.join(folderPath, file);
      if (fs.lstatSync(currentPath).isDirectory()) {
        deleteFolder(currentPath);
      } else {
        fs.unlinkSync(currentPath);
      }
    });
    fs.rmdirSync(folderPath);
  }
};

// Reset WhatsApp client
const resetWhatsAppClient = async () => {
  try {
    console.log("Starting WhatsApp client reset...");
    
    if (global.whatsappCache.client) {
      try {
        console.log("Attempting to destroy existing client...");
        await global.whatsappCache.client.destroy();
      } catch (error) {
        console.error('Error during WhatsApp client destruction:', error);
      } finally {
        console.log("Resetting client cache...");
        global.whatsappCache.client = null;
        global.whatsappCache.qr = null;
      }
    }
    
    console.log("Waiting before client recreation...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log("Recreating WhatsApp client...");
    return await initWhatsAppClient();
  } catch (error) {
    console.error('Error resetting WhatsApp client:', error);
    return null;
  }
};


module.exports = {
  initWhatsAppClient,
  resetWhatsAppClient,
  updateWelcomeMessage,
  updateSettings,
  processClientInfoFromMessage,
  resetClientConfirmationStatus,
  get whatsappClient() {
    return global.whatsappCache.client;
  },
  getQRCode() {
    return global.whatsappCache.qr;
  }
};