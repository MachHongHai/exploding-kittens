# Exploding Kittens Demo - Workspace Context

## 1. Project Overview
- **Type**: 2D Web Game (Turn-based Card Game)
- **Mode**: PvE (1 Human vs 3 Bots).
- **Core Goal**: Survive without drawing an Exploding Kitten, or defuse it if drawn.
- **Tech Stack**: 
  - Monorepo (pnpm/npm workspaces).
  - **Backend**: Node.js, Express, Socket.io, TypeScript.
  - **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4.
  - **AI Integration**: Google Gemini API (`@google/genai`) for the "Hard" bot logic.

## 2. Key Mechanics Implemented
- **Official Rules Setup**: Players start with 8 cards (7 random + 1 Defuse). The deck size and bomb count scale with player count.
- **Game Loop**: Players can play multiple cards per turn. Turn ends *only* by drawing a card (or playing Skip/Attack).
- **Advanced Combos**:
  - **Pair**: Play 2 matching cards to steal a random card from a targeted opponent.
  - **Three of a Kind**: Play 3 matching cards, target an opponent, and name a card type. If they have it, you get it. If not, the UI allows retrying without consuming the cards.
- **UI/UX**: 
  - High-end premium visual design with "Double-Bezel" glassmorphism cards.
  - Radial table layout: Draw/Discard in the center, Opponents at Top/Left/Right, Player Hand at the bottom.
  - Interactive multi-select for cards with a "Swipe up to Play" central hitbox dragging mechanic.

## 3. Bot System
- **Easy**: Random actions.
- **Medium**: Rule-based (defends against attacks, uses utility cards when deck is low).
- **Hard (AIBot)**: Feeds the serialized game state (deck size, discard pile, hand, opponent stats) to Gemini 2.5 Flash, which returns a structured JSON decision on what card to play or to draw.

## 4. Known Environment Quirks
- The frontend uses strict Vite TypeScript settings (`verbatimModuleSyntax`, `erasableSyntaxOnly`). Standard `enum` is not allowed; must use `typeof Object[keyof typeof Object]` pattern. Types must be imported using `import type`.
- Background processes for `npm run dev` in both frontend and backend were stopped per user request. The user runs the servers manually.