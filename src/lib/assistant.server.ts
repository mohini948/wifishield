import { GoogleGenAI } from "@google/genai";

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM = `You are WiFiShield's wireless security assistant.

Explain the user's Wi-Fi scan dashboard in simple language and give practical,
prioritized security advice.

Focus on:
- Wi-Fi encryption
- WPS
- router firmware
- guest networks
- rogue or evil-twin access points
- channel congestion
- VPN usage

Rules:
- Base claims about the user's Wi-Fi environment only on the scan snapshot.
- Be concise and practical.
- Never invent scan results.
- If information is unavailable or simulated, say so honestly.
- Explain technical terms simply.`;

export async function askAssistant(input: {
  messages: AssistantTurn[];
  snapshot: string;
}): Promise<string> {
  const apiKey = process.env?.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const ai = new GoogleGenAI({
    apiKey,
  });

  const conversation = input.messages
    .map((message) => {
      const role = message.role === "assistant" ? "Assistant" : "User";
      return `${role}: ${message.content}`;
    })
    .join("\n\n");

  const prompt = `${SYSTEM}

Current Wi-Fi scan snapshot:
${input.snapshot}

Conversation:
${conversation}

Answer the user's latest question based on the scan snapshot.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: prompt,
  });

  return (
    response.text?.trim() ||
    "I could not produce an answer. Please try again."
  );
}