const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");

let apiKey = "";
if (fs.existsSync(".env.local")) {
  const envContent = fs.readFileSync(".env.local", "utf-8");
  const match = envContent.match(/GEMINI_API_KEY\s*=\s*(.*)/);
  if (match) {
    apiKey = match[1].trim();
  }
}

if (!apiKey) {
  console.error("GEMINI_API_KEY not found in .env.local");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const models = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-flash-latest",
  "gemini-flash-lite-latest"
];

async function testModel(model) {
  console.log(`\n========================================`);
  console.log(`Testing model: ${model}...`);
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: "What is the latest news about AI tools for Product Managers in 2026?",
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    console.log(`SUCCESS! Response length: ${response.text?.length || 0}`);
  } catch (error) {
    console.error(`FAILED! Message: ${error.message}`);
    console.error(`Status: ${error.status}`);
  }
}

async function runAll() {
  for (const model of models) {
    await testModel(model);
  }
}

runAll();
