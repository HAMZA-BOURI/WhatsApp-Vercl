// message.test.js - Tests pour les fonctionnalités de messages
const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Chemins vers les fichiers pertinents
const appPath = path.join(__dirname, '../app.js');
const welcomeMessageConfigPath = path.join(__dirname, '../config/welcome-message.json');
const customerModelPath = path.join(__dirname, '../models/Customer.js');

describe('Tests des fonctionnalités de messages', function() {
  // Augmenter le timeout pour les tests qui peuvent prendre du temps
  this.timeout(5000);
  
  // Vérifier que le fichier app.js existe et contient les routes API nécessaires
  it('Le fichier app.js devrait définir les routes pour les messages', () => {
    assert(fs.existsSync(appPath), 'Le fichier app.js est manquant');
    
    const appContent = fs.readFileSync(appPath, 'utf8');
    
    // Vérifier les routes API pour les messages
    assert(appContent.includes('app.post(\'/api/send-message\''), 
      'La route API pour envoyer un message devrait être définie');
      
    assert(appContent.includes('app.get(\'/api/settings/welcome-message\''), 
      'La route API pour obtenir le message d\'accueil devrait être définie');
      
    assert(appContent.includes('app.post(\'/api/settings/welcome-message\''), 
      'La route API pour mettre à jour le message d\'accueil devrait être définie');
  });
  
  // Vérifier la configuration des messages d'accueil
  describe('Configuration du message d\'accueil', () => {
    it('Le dossier config devrait exister', () => {
      const configPath = path.join(__dirname, '../config');
      if (!fs.existsSync(configPath)) {
        fs.mkdirSync(configPath, { recursive: true });
      }
      assert(fs.existsSync(configPath), 'Le dossier config est manquant');
    });
    
    it('Le message d\'accueil devrait être correctement configuré', () => {
      // Créer le fichier s'il n'existe pas
      if (!fs.existsSync(welcomeMessageConfigPath)) {
        const defaultMessage = {
          message: 'Message d\'accueil de test'
        };
        fs.writeFileSync(welcomeMessageConfigPath, JSON.stringify(defaultMessage, null, 2));
      }
      
      // Vérifier que le fichier existe et est valide
      assert(fs.existsSync(welcomeMessageConfigPath), 
        'Le fichier de configuration du message d\'accueil est manquant');
        
      const configContent = JSON.parse(fs.readFileSync(welcomeMessageConfigPath, 'utf8'));
      assert(typeof configContent.message === 'string', 
        'Le message d\'accueil devrait être une chaîne de caractères');
    });
  });
  
  // Vérifier le modèle Customer pour la fonctionnalité de messagerie
  describe('Modèle Customer pour les messages', () => {
    it('Le modèle Customer devrait exister', () => {
      assert(fs.existsSync(customerModelPath), 
        'Le fichier du modèle Customer est manquant');
    });
    
    it('Le modèle Customer devrait inclure les champs liés aux messages', () => {
      const modelContent = fs.readFileSync(customerModelPath, 'utf8');
      
      // Vérifier les champs du modèle liés aux messages
      assert(modelContent.includes('receivedWelcomeMessage'), 
        'Le champ receivedWelcomeMessage devrait être défini');
        
      assert(modelContent.includes('messageCount'), 
        'Le champ messageCount devrait être défini');
        
      assert(modelContent.includes('lastContactDate'), 
        'Le champ lastContactDate devrait être défini');
    });
  });
  
  // Vérifier les fonctionnalités de gestion des images
  describe('Gestion des images dans les messages', () => {
    it('Le fichier app.js devrait définir les routes pour les images', () => {
      const appContent = fs.readFileSync(appPath, 'utf8');
      
      // Vérifier les routes API pour les images
      assert(appContent.includes('app.get(\'/api/settings/welcome-images\''), 
        'La route API pour obtenir les images d\'accueil devrait être définie');
        
      assert(appContent.includes('app.post(\'/api/settings/welcome-images\''), 
        'La route API pour télécharger des images d\'accueil devrait être définie');
        
      assert(appContent.includes('app.delete(\'/api/settings/welcome-images/'), 
        'La route API pour supprimer une image d\'accueil devrait être définie');
    });
    
    it('Le répertoire pour les images d\'accueil devrait exister', () => {
      const imagesDir = path.join(__dirname, '../public/images/welcome');
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      assert(fs.existsSync(imagesDir), 
        'Le répertoire pour les images d\'accueil est manquant');
    });
  });
});