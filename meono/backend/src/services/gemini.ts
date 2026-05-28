import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import dotenv from 'dotenv';

// Force dotenv to reload to catch manual file changes
dotenv.config();

export interface BotDecision {
  action: 'DRAW_CARD' | 'PLAY_CARDS' | 'DEFUSE';
  cardIds?: string[];
  targetId?: string;
  insertIndex?: number;
  requestedCardType?: string;
  reasoning: string;
}

export async function askGeminiForMove(gameStateDescription: string, handCards: any[]): Promise<BotDecision | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  
  if (!apiKey || apiKey === 'your_key_here') {
    console.warn("[Gemini Service] API Key is missing or invalid. Set GEMINI_API_KEY in backend/.env");
    return null;
  }

  // Debug log (masked for security)
  console.log(`[Gemini Service] Initializing with API Key ending in: ...${apiKey.substring(apiKey.length - 4)}`);

  try {
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            action: { 
              type: SchemaType.STRING, 
              enum: ['DRAW_CARD', 'PLAY_CARDS', 'DEFUSE'] 
            },
            cardIds: { 
              type: SchemaType.ARRAY, 
              items: { type: SchemaType.STRING },
              description: 'Array of card IDs to play. Empty if drawing.' 
            },
            targetId: { 
              type: SchemaType.STRING, 
              description: 'ID of the player to target, if required (e.g. Favor, Pairs)' 
            },
            insertIndex: { 
              type: SchemaType.NUMBER, 
              description: 'Index to insert the kitten (0 = top), if action is DEFUSE' 
            },
            requestedCardType: {
              type: SchemaType.STRING,
              description: 'The type of card to ask for if playing 3 of a kind.'
            },
            reasoning: { 
              type: SchemaType.STRING, 
              description: 'Brief tactical explanation of why you chose this action' 
            }
          },
          required: ['action', 'reasoning']
        }
      }
    });

    const prompt = `
You are an expert AI playing the game Exploding Kittens. 
Your goal is to survive and eliminate other players.

IMPORTANT RULES:
- You must take your action phase, and then end your turn by drawing.
- To end your turn normally, choose the 'DRAW_CARD' action.
- If you have functional cards (Favor, See The Future, Shuffle) or Pairs, try to play them BEFORE you draw.
- If you choose 'PLAY_CARDS', you must provide an array of exactly 'cardIds' from your hand.
- If playing a FAVOR or a Pair (2 cards of same type), provide the 'targetId' of an opponent.

CURRENT GAME STATE:
${gameStateDescription}

YOUR HAND:
${JSON.stringify(handCards, null, 2)}

DECISION LOGIC:
1. Are you forced to defuse? -> Action: DEFUSE, provide insertIndex.
2. Do you have a good combo or action card to play? -> Action: PLAY_CARDS, provide cardIds and targetId.
3. Are you ready to risk drawing? -> Action: DRAW_CARD.

Provide your decision as a structured JSON object.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) return null;

    const decision: BotDecision = JSON.parse(text);
    console.log(`[Gemini Bot Decision] ${decision.action} - ${decision.reasoning}`);
    return decision;
  } catch (error: any) {
    console.error("[Gemini Service] Fatal Error:", error?.message || error);
    if (error?.status === 400 && error?.message?.includes('API key expired')) {
      console.error(">>> GOOGLE HAS EXPIRED THIS API KEY. You must generate a brand new one at aistudio.google.com <<<");
    }
    return null;
  }
}
