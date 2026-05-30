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
- If playing a FAVOR, a Pair (2 identical cards), or Three of a Kind (3 identical cards), provide the 'targetId' of an opponent.

ADVANCED TACTICAL INSIGHTS & TRICKS:
1. SAFE DRAW (SAVE YOUR CARDS): Pay extreme attention to the "Cards you know at the top of the draw pile". If you KNOW the top card is safe (not an Exploding Kitten), NEVER play Skip, Attack, or Shuffle. Simply choose DRAW_CARD to hoard your valuable defense cards.
2. BOMB DANGER AVOIDANCE: If you know an Exploding Kitten is within your draw range (e.g. you have 1 turn to play and the bomb is at index 0, or 2 turns and it's at index 0 or 1), you MUST play defense:
   - Priority 1: ATTACK (ends turn, forces next player to take 2 turns). Best if the next player has no Defuse!
   - Priority 2: SKIP (ends 1 turn without drawing).
   - Priority 3: SHUFFLE (randomizes the deck to hopefully move the bomb).
3. STEALING (FAVOR, PAIRS & THREE OF A KIND):
   - Pairs (2 cards of exactly the same type): Play to steal a random card from a target opponent.
   - Three of a Kind (3 cards of exactly the same type): Play to request a SPECIFIC card type from a target opponent. You MUST set "requestedCardType" to the card type you want (e.g. "DEFUSE" to steal a player's Defuse card, which is highly recommended).
4. REVENGE & TARGET SELECTION:
   - Look at the "Hostility & Revenge" list. If an opponent recently attacked you (stole your card, played Favor, or Noped your card), prioritize targeting them for your steals (Pairs, Triplets, Favors) to retaliate and disable their strategy.
   - Otherwise, target players with large hands or players holding a Defuse card.
5. STRICT CONSERVATION OF DEFUSE & NOPE CARDS:
   - NEVER play DEFUSE or NOPE cards in a 2-card (Pair) or 3-card (Three of a Kind) combo under normal conditions. They are far too valuable as survival tools.
   - EXCEPTION (DESPERATION MODE): If you are about to draw a known bomb (or if the draw pile has exactly 1 card left), have NO Defuse card left to save you, and have NO individual escape cards (Skip/Attack), you are in desperation. NOTE: If the draw pile has exactly 1 card left, NEVER play 'Shuffle' or 'See The Future' as single cards (they are completely useless). Instead, you MUST use any combination of cards (including pairs of Shuffles, pairs of See The Futures, or even Defuses/Nopes) as a Pair or 3-of-a-kind combo as a desperate attempt to steal an escape card from an opponent!
6. SMART DEFUSING: If you draw a bomb, you must choose 'action': 'DEFUSE'.
   - Check the next player's status! If the next player HAS NO DEFUSE card, insert the bomb at index 0 (top of the deck) to eliminate them instantly.
   - If the next player HAS a Defuse card, insert the bomb deeper (e.g., index 2 or 3) to stall for time and keep yourself safe on your next turns.

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
