import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Ensure you have GEMINI_API_KEY in your backend/.env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface BotDecision {
  action: 'DRAW_CARD' | 'PLAY_CARD' | 'DEFUSE';
  cardId?: string;
  targetId?: string;
  insertIndex?: number;
  reasoning: string;
}

export async function askGeminiForMove(gameStateDescription: string, handCards: any[]): Promise<BotDecision | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not set. Falling back to simple logic.");
    return null;
  }

  try {
    const prompt = `
You are an expert AI playing the game Exploding Kittens. 
Your goal is to survive and eliminate other players.

IMPORTANT RULES:
- Playing an action card (FAVOR, SEE_THE_FUTURE, SHUFFLE) does NOT end your turn. You can play as many as you want.
- Playing a SKIP or ATTACK card DOES end your turn immediately.
- To end your turn normally, you MUST use the 'DRAW_CARD' action.
- You should usually play your functional cards (Favor, See The Future, Shuffle) BEFORE you draw to reduce risk.
- If you have 2 matching cards, you can't play them individually via this API yet, but prioritize using single action cards.

CURRENT GAME STATE:
${gameStateDescription}

YOUR HAND:
${JSON.stringify(handCards, null, 2)}

Analyze the game state and your hand.
1. If you are forced to defuse a kitten, you MUST choose the 'DEFUSE' action and specify an insertIndex (0 means top of deck, 1 means under the top card, etc.).
2. If you want to play a card, choose 'PLAY_CARD' and provide the exact 'cardId' and 'targetId' if needed.
3. If you are done playing cards and want to end your turn, choose 'DRAW_CARD'.

Provide your decision as a structured JSON object.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ['DRAW_CARD', 'PLAY_CARD', 'DEFUSE'] },
            cardId: { type: Type.STRING, description: 'ID of the card to play, if action is PLAY_CARD' },
            targetId: { type: Type.STRING, description: 'ID of the player to target, if required' },
            insertIndex: { type: Type.INTEGER, description: 'Index to insert the kitten (0 = top), if action is DEFUSE' },
            reasoning: { type: Type.STRING, description: 'Brief explanation of why you chose this action' }
          },
          required: ['action', 'reasoning']
        }
      }
    });

    const text = response.text;
    if (!text) return null;

    const decision: BotDecision = JSON.parse(text);
    console.log(`[Gemini Bot Decision] ${decision.action} - ${decision.reasoning}`);
    return decision;
  } catch (error) {
    console.error("Error asking Gemini for move:", error);
    return null;
  }
}
