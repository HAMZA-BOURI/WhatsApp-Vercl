// run_tests.js - Script pour exécuter tous les tests et générer un rapport
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const testFiles = [
  'tests.js',
  'whatsapp.test.js',
  'message.test.js'
];

// Installation des dépendances de test si nécessaires
console.log('Installation des dépendances de test...');
spawnSync('npm', ['install', '--no-save', 'mocha@10.2.0', 'chai', 'sinon', 'supertest'], { 
  stdio: 'inherit',
  shell: true
});

// Création du répertoire de test s'il n'existe pas
const testDir = path.join(__dirname);
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir);
}

// Vérifier que les fichiers de test existent
let allFilesExist = true;
testFiles.forEach(file => {
  const testFilePath = path.join(testDir, file);
  if (!fs.existsSync(testFilePath)) {
    console.log(`Le fichier de test ${file} n'existe pas.`);
    allFilesExist = false;
  } else {
    console.log(`Le fichier de test ${file} a été trouvé.`);
  }
});

if (!allFilesExist) {
  console.log("Certains fichiers de test sont manquants. Veuillez vérifier qu'ils existent dans le dossier tests/");
  process.exit(1);
}

// Exécuter les tests et collecter les résultats
console.log('Exécution des tests...');
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  details: []
};

testFiles.forEach(file => {
  console.log(`\n--- Exécution de ${file} ---`);
  const testFile = path.join(testDir, file);
  
  if (fs.existsSync(testFile)) {
    const testProcess = spawnSync('npx', ['mocha', testFile, '--reporter', 'spec'], {
      stdio: 'inherit',
      shell: true
    });
    
    // Collecter les informations sur les résultats
    if (testProcess.status === 0) {
      console.log(`Test ${file} passé avec succès!`);
      results.passed += 1;
    } else {
      console.log(`Test ${file} a échoué avec code de sortie ${testProcess.status}`);
      results.failed += 1;
    }
    
    results.total += 1;
    results.details.push({
      file,
      status: testProcess.status === 0 ? 'Passé' : 'Échoué',
      exitCode: testProcess.status
    });
  } else {
    console.log(`Le fichier ${file} n'existe pas, test ignoré.`);
    results.skipped += 1;
  }
});

// Générer un rapport
console.log('\n=== RAPPORT DE TEST ===');
console.log(`Tests exécutés: ${results.total}`);
console.log(`Tests réussis: ${results.passed}`);
console.log(`Tests échoués: ${results.failed}`);
console.log(`Tests ignorés: ${results.skipped}`);

// Calculer une note approximative sur 20
const score = Math.round((results.passed / (results.total || 1)) * 20);
console.log(`\nNote approximative: ${score}/20`);

// Générer des recommandations
console.log('\n=== RECOMMANDATIONS ===');
if (results.failed > 0) {
  console.log('1. Corriger les tests qui ont échoué avant de déployer en production.');
}

if (results.skipped > 0) {
  console.log('2. Créer les fichiers de test manquants pour une couverture complète.');
}

console.log('3. Considérer l\'ajout de tests supplémentaires pour la couverture de code.');
console.log('4. Mettre en place une intégration continue pour exécuter automatiquement les tests.');

// Enregistrer le rapport dans un fichier
const reportContent = `
# Rapport de Test - ${new Date().toLocaleString()}

## Résumé
- Tests exécutés: ${results.total}
- Tests réussis: ${results.passed}
- Tests échoués: ${results.failed}
- Tests ignorés: ${results.skipped}

## Détails
${results.details.map(d => `- ${d.file}: ${d.status} (Code ${d.exitCode})`).join('\n')}

## Note
Note approximative: ${score}/20

## Recommandations
${results.failed > 0 ? '1. Corriger les tests qui ont échoué avant de déployer en production.\n' : ''}
${results.skipped > 0 ? '2. Créer les fichiers de test manquants pour une couverture complète.\n' : ''}
3. Considérer l'ajout de tests supplémentaires pour la couverture de code.
4. Mettre en place une intégration continue pour exécuter automatiquement les tests.
`;

const reportPath = path.join(__dirname, 'test-report.md');
fs.writeFileSync(reportPath, reportContent);
console.log(`\nRapport enregistré dans ${reportPath}`);