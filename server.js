// server.js - Serveur principal corrigé et optimisé
require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const whatsappService = require('./services/whatsapp-unified.js');

const PORT = process.env.PORT || 5000;

class ServerManager {
  constructor() {
    this.server = null;
    this.isShuttingDown = false;
    this.activeConnections = new Set();
  }

  // Démarrage du serveur
  async start() {
    try {
      console.log('🚀 Starting WhatsApp AI Bot Server...');
      console.log('====================================');
      
      // Vérification des variables d'environnement
      this.checkEnvironmentVariables();
      
      // Connexion à la base de données
      console.log('📊 Connecting to database...');
      await connectDB();
      console.log('✅ Database connected successfully');
      
      // Démarrage du serveur HTTP
      console.log(`🌐 Starting HTTP server on port ${PORT}...`);
      this.server = app.listen(PORT, () => {
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`🌍 Admin Interface: http://localhost:${PORT}`);
        console.log(`🤖 Agent Dashboard: http://localhost:${PORT}/agent-dashboard`);
        console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
      });
      
      // Configuration du serveur
      this.configureServer();
      
      // Initialisation du service WhatsApp (avec délai)
      console.log('📱 Initializing WhatsApp service...');
      setTimeout(async () => {
        try {
          await whatsappService.initializeClient();
          console.log('✅ WhatsApp service initialized successfully');
        } catch (whatsappError) {
          console.error('❌ WhatsApp initialization failed:', whatsappError.message);
          console.log('⚠️  Server continues running. You can retry via the admin interface.');
        }
      }, 3000);
      
      // Configuration des gestionnaires d'arrêt propre
      this.setupGracefulShutdown();
      
      // Affichage du résumé de démarrage
      this.displayStartupSummary();
      
    } catch (error) {
      console.error('❌ Critical startup error:', error);
      this.displayTroubleshootingTips();
      process.exit(1);
    }
  }

  // Vérification des variables d'environnement
  checkEnvironmentVariables() {
    console.log('🔍 Checking environment variables...');
    
    const required = ['MONGO_URI'];
    const optional = ['GEMINI_API_KEY', 'PUPPETEER_EXECUTABLE_PATH', 'GOOGLE_SHEETS_SPREADSHEET_ID'];
    
    const missing = required.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing.join(', '));
      console.error('💡 Please configure these variables in your .env file');
      process.exit(1);
    }
    
    required.forEach(varName => {
      console.log(`✅ ${varName}: Configured`);
    });
    
    optional.forEach(varName => {
      if (process.env[varName]) {
        console.log(`✅ ${varName}: Configured`);
      } else {
        console.log(`ℹ️  ${varName}: Not configured (optional)`);
      }
    });
    
    console.log('✅ Environment variables checked\n');
  }

  // Configuration du serveur HTTP
  configureServer() {
    if (!this.server) return;
    
    // Timeouts
    this.server.timeout = 120000; // 2 minutes
    this.server.keepAliveTimeout = 65000; // 65 secondes
    this.server.headersTimeout = 66000; // 66 secondes
    
    // Suivi des connexions actives
    this.server.on('connection', (connection) => {
      this.activeConnections.add(connection);
      connection.on('close', () => {
        this.activeConnections.delete(connection);
      });
    });
    
    // Gestion des erreurs du serveur
    this.server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.log('💡 Try using a different port or stop the other process');
      } else {
        console.error('❌ Server error:', error);
      }
    });
  }

  // Configuration de l'arrêt propre
  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      if (this.isShuttingDown) {
        console.log('⚠️  Shutdown already in progress...');
        return;
      }
      
      this.isShuttingDown = true;
      console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);
      
      // Arrêter d'accepter de nouvelles connexions
      if (this.server) {
        this.server.close(async () => {
          console.log('🔌 HTTP server closed');
          
          try {
            // Fermer les connexions actives
            console.log(`🔗 Closing ${this.activeConnections.size} active connections...`);
            for (const connection of this.activeConnections) {
              connection.destroy();
            }
            
            // Arrêter le service WhatsApp
            if (whatsappService.isClientReady) {
              console.log('📱 Shutting down WhatsApp service...');
              await whatsappService.resetClient();
            }
            
            // Fermer la connexion à la base de données
            console.log('📊 Closing database connection...');
            const mongoose = require('mongoose');
            await mongoose.connection.close();
            
            console.log('✅ Graceful shutdown completed');
            process.exit(0);
          } catch (shutdownError) {
            console.error('❌ Error during shutdown:', shutdownError);
            process.exit(1);
          }
        });
      } else {
        process.exit(0);
      }
      
      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.log('⏰ Force shutdown after timeout');
        process.exit(1);
      }, 30000);
    };
    
    // Écouter les signaux d'arrêt
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Gestion des erreurs non capturées
    process.on('uncaughtException', (error) => {
      console.error('🚨 UNCAUGHT EXCEPTION:', error);
      console.error('Stack trace:', error.stack);
      
      if (process.env.NODE_ENV === 'production') {
        console.log('🔄 Restarting application...');
        setTimeout(() => process.exit(1), 1000);
      } else {
        console.log('⚠️  Application continues in development mode');
      }
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 UNHANDLED REJECTION at:', promise);
      console.error('Reason:', reason);
      
      if (process.env.NODE_ENV === 'production') {
        console.log('🔄 Restarting application...');
        setTimeout(() => process.exit(1), 1000);
      } else {
        console.log('⚠️  Application continues in development mode');
      }
    });
  }

  // Affichage du résumé de démarrage
  displayStartupSummary() {
    const features = [];
    
    if (process.env.GEMINI_API_KEY) features.push('✅ AI Powered (Gemini)');
    if (process.env.GOOGLE_SHEETS_SPREADSHEET_ID) features.push('✅ Google Sheets Integration');
    if (process.env.PUPPETEER_EXECUTABLE_PATH) features.push('✅ Custom Chrome Path');
    
    console.log('\n🎉 WhatsApp AI Bot Started Successfully!');
    console.log('==========================================');
    console.log(`🌐 Server: http://localhost:${PORT}`);
    console.log(`📊 Database: ${process.env.MONGO_URI ? 'Connected' : 'Local'}`);
    console.log(`🤖 AI Service: ${process.env.GEMINI_API_KEY ? 'Active (Gemini)' : 'Disabled'}`);
    console.log(`📱 WhatsApp: ${whatsappService.isClientReady ? 'Connected' : 'Initializing...'}`);
    
    if (features.length > 0) {
      console.log('\n🚀 Active Features:');
      features.forEach(feature => console.log(`   ${feature}`));
    }
    
    console.log('\n📋 Available Endpoints:');
    console.log('   🏠 Admin Interface: /');
    console.log('   🤖 Agent Dashboard: /agent-dashboard');
    console.log('   👥 Clients Dashboard: /clients-dashboard.html');
    console.log('   ✅ Confirmations: /confirmations.html');
    console.log('   🧪 AI Test: /ai-test.html');
    console.log('   ❤️  Health Check: /health');
    
    console.log('\n📱 WhatsApp Features:');
    console.log('   🤖 AI-Powered Responses');
    console.log('   💬 Multi-language Support (Arabic, Darija, French)');
    console.log('   📊 Conversation Memory');
    console.log('   🎯 Intent Recognition');
    console.log('   📈 Real-time Analytics');
    console.log('   🔄 Auto-reconnection');
    
    console.log('==========================================\n');
  }

  // Conseils de dépannage
  displayTroubleshootingTips() {
    console.log('\n🔧 Troubleshooting Tips:');
    console.log('1. Ensure MongoDB is running and accessible');
    console.log('2. Check environment variables in .env file');
    console.log('3. Verify port', PORT, 'is available');
    console.log('4. Check file permissions');
    console.log('5. Ensure Chrome/Chromium is installed for WhatsApp Web');
    console.log('6. For AI features, ensure GEMINI_API_KEY is valid');
    console.log('\n📚 Documentation: README.md');
    console.log('🆘 Support: Check logs above for specific errors');
  }

  // Surveillance de la santé du système
  startHealthMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const memUsageMB = Math.round(memUsage.rss / 1024 / 1024);
      
      // Avertissement si la mémoire dépasse 1GB
      if (memUsageMB > 1024) {
        console.warn(`⚠️  High memory usage: ${memUsageMB}MB`);
      }
      
      // Statistiques périodiques (toutes les heures)
      if (Date.now() % (60 * 60 * 1000) < 30000) {
        const stats = whatsappService.getStats();
        console.log(`📊 Hourly Stats - Messages: ${stats.totalMessages}, Clients: ${stats.clientsHelped}, Uptime: ${stats.uptime.formatted}`);
      }
    }, 30000); // Vérification toutes les 30 secondes
  }
}

// Création et démarrage du serveur
const serverManager = new ServerManager();

// Démarrage asynchrone
(async () => {
  try {
    await serverManager.start();
    
    // Démarrer la surveillance de santé
    serverManager.startHealthMonitoring();
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();

// Export pour les tests
module.exports = serverManager;