import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function test() {
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant for our housing society. 
Check if the user's query can be answered using ONLY the provided FAQ data. 
If it CAN be answered, provide the answer politely.
If it CANNOT be answered by the FAQ data, you MUST respond with EXACTLY the word: NO_MATCH.
Do not make up answers. Keep responses concise and friendly.
IMPORTANT: If your answer includes a phone number, format it as a Markdown tel link, e.g., [9876543210](tel:9876543210).

FAQ Data:
Q: Who do I contact for emergency?
A: Contact the security desk at 9876543210 or 08022223333.`,
      },
      {
        role: "user",
        content: "What is the emergency number?",
      },
    ],
    max_tokens: 300,
  });

  console.log(response.choices[0]?.message?.content?.trim());
}

test();
