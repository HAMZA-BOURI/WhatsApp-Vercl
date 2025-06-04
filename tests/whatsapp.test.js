// whatsapp.test.js - Tests pour le service WhatsApp
const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Chemin vers le service WhatsApp
const whatsappServicePath = path.join(__dirname, '../services/whatsapp.js');

describe('Tests du service WhatsApp', function() {
  // Augmenter le timeout pour les tests qui peuvent prendre du temps
  this.timeout(10000);
  
  // Vérifier que le service WhatsApp existe
  it('Le service WhatsApp devrait exister', () => {
    assert(fs.existsSync(whatsappServicePath), 'Le service WhatsApp est manquant');
  });
  
  // Vérifier que le service WhatsApp exporte les fonctions nécessaires
  it('Le service WhatsApp devrait exporter les fonctions nécessaires', () => {
    const whatsappService = require(whatsappServicePath);
    
    assert(typeof whatsappService.initWhatsAppClient === 'function', 
      'La fonction initWhatsAppClient devrait être exportée');
      
    assert(typeof whatsappService.resetWhatsAppClient === 'function', 
      'La fonction resetWhatsAppClient devrait être exportée');
      
    assert(typeof whatsappService.updateWelcomeMessage === 'function', 
      'La fonction updateWelcomeMessage devrait être exportée');
      
    assert(typeof whatsappService.updateSettings === 'function', 
      'La fonction updateSettings devrait être exportée');
      
    assert(whatsappService.whatsappClient !== undefined, 
      'La propriété whatsappClient devrait être exportée');
  });
  
  // Vérifier que le service contient les gestionnaires d'événements appropriés
  it('Le service WhatsApp devrait définir des gestionnaires d\'événements', () => {
    const serviceContent = fs.readFileSync(whatsappServicePath, 'utf8');
    
    // Vérifier les gestionnaires d'événements clés
    assert(serviceContent.includes('client.on(\'qr\''), 
      'Le gestionnaire d\'événement QR devrait être défini');
      
    assert(serviceContent.includes('client.on(\'ready\''), 
      'Le gestionnaire d\'événement ready devrait être défini');
      
    assert(serviceContent.includes('client.on(\'authenticated\''), 
      'Le gestionnaire d\'événement authenticated devrait être défini');
      
    assert(serviceContent.includes('client.on(\'message\''), 
      'Le gestionnaire d\'événement message devrait être défini');
  });
  
  // Vérifier que le service gère correctement les messages d'accueil
  it('Le service devrait définir et mettre à jour les messages d\'accueil', () => {
    const serviceContent = fs.readFileSync(whatsappServicePath, 'utf8');
    
    // Vérifier les fonctions de message d'accueil
    assert(serviceContent.includes('const loadWelcomeMessage'), 
      'La fonction loadWelcomeMessage devrait être définie');
      
    assert(serviceContent.includes('const updateWelcomeMessage'), 
      'La fonction updateWelcomeMessage devrait être définie');
      
    assert(serviceContent.includes('const sendWelcomeMessage'), 
      'La fonction sendWelcomeMessage devrait être définie');
  });
  
  // Vérifier la gestion des erreurs
  it('Le service WhatsApp devrait inclure une gestion des erreurs robuste', () => {
    const serviceContent = fs.readFileSync(whatsappServicePath, 'utf8');
    
    // Vérifier la présence de blocs try/catch
    const tryCatchCount = (serviceContent.match(/try\s*{/g) || []).length;
    const catchCount = (serviceContent.match(/catch\s*\(/g) || []).length;
    
    assert(tryCatchCount >= 3, 'Il devrait y avoir au moins 3 blocs try');
    assert(catchCount >= 3, 'Il devrait y avoir au moins 3 blocs catch');
    
    // Vérifier les journalisations d'erreurs
    assert(serviceContent.includes('console.error'), 
      'Les erreurs devraient être journalisées avec console.error');
  });
});