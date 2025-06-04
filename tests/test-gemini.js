// test-gemini.js - Script simple pour tester l'API Gemini
require('dotenv').config();
const axios = require('axios');

// Configuration de l'API Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBqGyqagvCy9TVQVrLzuma70YexC5BDsK8';
const GEMINI_API_URL = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Exemple de produit
const productInfo = {
  title: "كريم ليفريزين لترطيب وتجديد البشرة",
  description: "كريم ليفريزين هو الحل المثالي لبشرة ناعمة ومشرقة. مصنوع بمكونات طبيعية وفعالة بحال زيت الورد وفيتامين E، كيخلّي البشرة ديالك مرتاحة، مرطّبة وكتبان صحّية من أول استعمال. تركيبتو خفيفة وكتدخل بسرعة للبشرة بلا أثر دهني، ومناسبة لجميع أنواع البشرة.",
  benefits: [
    "ترطيب كييدوم حتى لـ24 ساعة",
    "كينقص من الخطوط الرفيعة والجفاف", 
    "كيعطي إشراقة طبيعية للبشرة"
  ],
  price: "230 درهم مغربي"
};

// Questions de test
const testQuestions = [
  "تقدر تنقص ليا الثمن شوية؟",
  "واش كاين شي تخفيض؟",
  "بزاف عليا هاد الثمن",
  "فين نقدر نلقاه فالمدينة؟",
  "شنو هوما المكونات ديالو؟"
];

// Fonction pour tester l'API Gemini
const testGeminiAPI = async (questionIndex = 0) => {
  try {
    // Sélectionner une question de test
    const question = testQuestions[questionIndex % testQuestions.length];
    console.log(`\n--- Test avec la question: "${question}" ---`);

    // Construire le prompt
    const prompt = `
**المهمة:** أجب على أي سؤال من الزبون بطريقة محترفة، لبقة ومقنعة، بهدف إقناعه بشراء المنتج.
**المعطيات المستعملة للإقناع:**
* **العنوان:** ${productInfo.title}
* **الوصف:** ${productInfo.description}
* **المزايا:**
${productInfo.benefits.map(benefit => `   * ${benefit}`).join('\n')}
* **الثمن:** ${productInfo.price}
**السؤال من الزبون:** ${question}
**قواعد إنشاء الجواب:**
* ضروري الجواب يكون بالدارجة المغربية
* يكون مقنع ومهني
* يكون لبق وجذاب
* مختصر قدر الإمكان (ماكس 10 كلمات)
`;

    // Configuration de la requête pour Gemini
    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 200,
        topP: 0.8,
        topK: 40
      }
    };

    console.log('Envoi de requête à Gemini API...');
    console.time('Temps de réponse');
    
    // Appel à l'API Gemini
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.timeEnd('Temps de réponse');

    // Traiter la réponse
    if (response.data && 
        response.data.candidates && 
        response.data.candidates.length > 0 && 
        response.data.candidates[0].content &&
        response.data.candidates[0].content.parts &&
        response.data.candidates[0].content.parts.length > 0) {
      
      const aiResponse = response.data.candidates[0].content.parts[0].text.trim();
      console.log('\nRéponse de Gemini:');
      console.log('-----------------');
      console.log(aiResponse);
      console.log('-----------------');
      
      return aiResponse;
    } else {
      console.log('Réponse vide ou format inattendu.');
      console.log(JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.error('Erreur lors de l\'appel à l\'API Gemini:', error.message);
    if (error.response) {
      console.error('Erreur de réponse API:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
};

// Exécuter le test pour toutes les questions
const runAllTests = async () => {
  console.log('=== TEST DE L\'API GEMINI AVEC PLUSIEURS QUESTIONS ===');
  console.log(`API Key: ${GEMINI_API_KEY.substring(0, 10)}...`);
  console.log(`API URL: ${GEMINI_API_URL}`);
  
  for (let i = 0; i < testQuestions.length; i++) {
    await testGeminiAPI(i);
  }
  
  console.log('\n=== TOUS LES TESTS SONT TERMINÉS ===');
};

// Lancer les tests
runAllTests();