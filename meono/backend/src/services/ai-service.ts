import dotenv from 'dotenv';

// Force dotenv to reload and OVERRIDE existing system/cached env variables
dotenv.config({ override: true });

export interface BotDecision {
  action: 'DRAW_CARD' | 'PLAY_CARDS' | 'DEFUSE';
  cardIds?: string[];
  targetId?: string;
  insertIndex?: number;
  requestedCardType?: string;
  reasoning: string;
}

// Call a specific Gemini model
async function askGemini(modelName: string, gameStateDescription: string, handCards: any[], apiKey: string): Promise<BotDecision | null> {
  console.log(`[AI Service] Calling ${modelName} with key: ...${apiKey.slice(-6)}`);

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

  const prompt = `You are an expert AI playing the game Exploding Kittens. 
Your goal is to survive and eliminate other players.

IMPORTANT RULES:
- You must take your action phase, and then end your turn by drawing.
- To end your turn normally, choose the 'DRAW_CARD' action.
- If you have functional cards (Favor, See The Future, Shuffle) or Pairs, try to play them BEFORE you draw.
- If you choose 'PLAY_CARDS', you must provide an array of exactly 'cardIds' from your hand.
- If playing a FAVOR or a Pair (2 cards of same type), provide the 'targetId' of an opponent.

TACTICAL INSIGHTS:
- MEMORY OF TOP CARDS: Pay attention to the "Cards you know at the top of the draw pile" in the game state.
- If you know an Exploding Kitten is coming up in the range of cards you are forced to draw (based on 'Your turns to play'), you MUST play a defense card like SKIP, ATTACK, or SHUFFLE immediately to avoid drawing it and exploding!
- If you know the top card is safe, do NOT play SKIP, ATTACK, or SHUFFLE unless you have a strong tactical reason. Just DRAW_CARD to save your cards!
- SHUFFLING: Only play SHUFFLE if you know a bomb is on top, or if you suspect there is a bomb and have no other way to skip drawing. Don't shuffle if you know the top card is a good/safe card.
- DEFUSING: If 'Requires Defuse right now' is YES, choose 'action': 'DEFUSE'.
  - Choose 'insertIndex' carefully (0 means top of the deck, 1 means 1 card below top, etc.).
  - If the next player has no Defuse card, place the bomb at position 0 to eliminate them immediately!
  - If you want to delay drawing, place it deeper (e.g., index 2 or 3).

CURRENT GAME STATE:
${gameStateDescription}

YOUR HAND:
${JSON.stringify(handCards, null, 2)}

DECISION LOGIC:
1. Are you forced to defuse? -> Action: DEFUSE, provide insertIndex.
2. Do you have a good combo or action card to play? -> Action: PLAY_CARDS, provide cardIds and targetId.
3. Are you ready to risk drawing? -> Action: DRAW_CARD.

Provide your decision as a structured JSON object matching the following structure:
{
  "action": "DRAW_CARD" | "PLAY_CARDS" | "DEFUSE",
  "cardIds": ["string array of card IDs to play, empty if drawing"],
  "targetId": "string, ID of opponent to target (for Favor/Pairs)",
  "insertIndex": 0,
  "requestedCardType": "string, card type to ask for with 3-of-a-kind",
  "reasoning": "string, brief tactical explanation"
}
Only "action" and "reasoning" are required. Omit other fields if not relevant.`;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          action: {
            type: "STRING",
            enum: ["DRAW_CARD", "PLAY_CARDS", "DEFUSE"]
          },
          cardIds: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Array of card IDs to play. Empty if drawing."
          },
          targetId: {
            type: "STRING",
            description: "ID of the player to target, if required (e.g. Favor, Pairs)"
          },
          insertIndex: {
            type: "NUMBER",
            description: "Index to insert the kitten (0 = top), if action is DEFUSE"
          },
          requestedCardType: {
            type: "STRING",
            description: "The type of card to ask for if playing 3 of a kind."
          },
          reasoning: {
            type: "STRING",
            description: "Brief tactical explanation of why you chose this action"
          }
        },
        required: ["action", "reasoning"]
      }
    }
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`[AI Service] Gemini model ${modelName} returned HTTP ${response.status}: ${errorBody.substring(0, 300)}`);
      return null;
    }

    const data = await response.json();
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) {
      console.warn(`[AI Service] No text in response for ${modelName}:`, JSON.stringify(data, null, 2));
      return null;
    }

    const decision: BotDecision = JSON.parse(textResult);
    console.log(`[AI Service - ${modelName}] ${decision.action} - ${decision.reasoning}`);
    return decision;
  } catch (error: any) {
    console.warn(`[AI Service] Gemini error on model ${modelName}:`, error?.message || error);
    return null;
  }
}

// Unified call function - Gemini only with fallback strategy
export async function askAIForMove(gameStateDescription: string, handCards: any[]): Promise<BotDecision | null> {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (!geminiKey || geminiKey === 'your_key_here') {
    console.warn("[AI Service] Gemini API Key is missing. Set GEMINI_API_KEY in backend/.env");
    return null;
  }

  // Fallback chain to ensure we always get a decision, even if some models are rate-limited
  const models = [
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-2.5-flash'
  ];

  for (const model of models) {
    const decision = await askGemini(model, gameStateDescription, handCards, geminiKey);
    if (decision) {
      return decision;
    }
    console.warn(`[AI Service] Fallback model ${model} failed, trying next...`);
  }

  console.error("[AI Service] All fallback Gemini models failed.");
  return null;
}
