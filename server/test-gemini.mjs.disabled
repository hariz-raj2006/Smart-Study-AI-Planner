
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

async function testGemini() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      console.log(`Attempt ${attempt}/5 using ${model}`);

      const response = await ai.models.generateContent({
        model,
        contents: 'Explain SmartStudy AI in one sentence.',
      });

      console.log('\nGemini response:');
      console.log(response.text);
      return;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.status);

      if (error.status !== 503 || attempt === 5) {
        throw error;
      }

      const delay = Math.min(5000 * 2 ** (attempt - 1), 60000);
      console.log(`Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

testGemini().catch(error => {
  console.error('Gemini test failed:', error.message);
  process.exitCode = 1;
});
