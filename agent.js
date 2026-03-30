import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// 1. Initialize the API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function runAgent() {
  console.log("🧠 Loading Engineering Personas...");
  
  // 2. Read all .md files from the 'personas' folder
  const personaDir = './personas';
  let multiPersonaPrompt = "You are an elite, multi-disciplinary engineering council. You must analyze the user's request through the combined lenses of the following experts:\n\n";

  try {
    const files = fs.readdirSync(personaDir).filter(file => file.endsWith('.md'));
    
    if (files.length === 0) {
      console.log("⚠️ No .md files found in the 'personas' folder!");
    } else {
      for (const file of files) {
        const content = fs.readFileSync(path.join(personaDir, file), 'utf8');
        multiPersonaPrompt += `========================================\n`;
        multiPersonaPrompt += `ROLE: ${file.replace('.md', '').toUpperCase()}\n`;
        multiPersonaPrompt += `========================================\n`;
        multiPersonaPrompt += `${content}\n\n`;
        console.log(`✅ Loaded: ${file}`);
      }
    }
  } catch (err) {
    console.error("❌ Error reading personas folder. Make sure you created the 'personas' folder and put the .md files inside it.");
    process.exit(1);
  }

  multiPersonaPrompt += "When you reply, synthesize the knowledge of these roles to provide the most architecturally sound, bug-free, and optimized code possible. Do not break character.";

  // 3. Boot up the Gemini Model with the Super-Prompt
  const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-pro", // The Pro model handles massive prompts perfectly
      systemInstruction: multiPersonaPrompt 
  });

  const chat = model.startChat({
    history: [],
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("\n🚀 Multi-Agent Council Online! Type your code issue or 'exit' to quit:");

  const askQuestion = () => {
    rl.question('\n> ', async (userInput) => {
      if (userInput.toLowerCase() === 'exit') {
        rl.close();
        return;
      }
      
      try {
        process.stdout.write("🤖 Council is thinking...\n");
        const result = await chat.sendMessage(userInput);
        console.log('\n' + result.response.text());
      } catch (error) {
        console.error("\n❌ Error connecting to Gemini:", error.message);
      }
      
      askQuestion();
    });
  };

  askQuestion();
}

runAgent();