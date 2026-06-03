import React, { useState } from 'react';

interface LobbyProps {
  onJoin: (name: string, difficulty: 'HARD' | 'PLAY_WITH_GEMINI', botCount: number, deckType: 'ORIGINAL' | 'IMPLODING_KITTENS') => void;
}

export const Lobby: React.FC<LobbyProps> = ({ onJoin }) => {
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<'HARD' | 'PLAY_WITH_GEMINI'>('HARD');
  const [botCount, setBotCount] = useState(3);
  const [deckType, setDeckType] = useState<'ORIGINAL' | 'IMPLODING_KITTENS'>('ORIGINAL');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onJoin(name.trim(), difficulty, botCount, deckType);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-[#050505] flex flex-col items-center p-4 relative">
      {/* Premium Background Orbs */}
      <div className="absolute top-[10%] left-[20%] w-[30vw] h-[30vw] rounded-full bg-red-900/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[20%] w-[40vw] h-[40vw] rounded-full bg-orange-900/10 blur-[150px] pointer-events-none"></div>

      <div className="bg-white/[0.02] p-6 sm:p-8 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.8)] max-w-md w-full border border-white/10 backdrop-blur-2xl relative z-10 my-auto">
        <h1 className="text-4xl font-black mb-6 text-center text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 uppercase tracking-tighter drop-shadow-sm leading-none">
          Exploding Kittens
        </h1>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-[0.2em] ml-1">
              Player Name
            </label>
            <div className="relative group">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all text-white placeholder-slate-600"
                placeholder="Enter your alias"
                maxLength={15}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Opponents</label>
             <div className="flex justify-between items-center bg-black/40 border border-white/10 rounded-xl px-5 py-3">
                <button 
                  type="button" 
                  onClick={() => setBotCount(Math.max(1, botCount - 1))}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center font-bold transition-colors"
                >—</button>
                <span className="text-base font-black text-orange-500">{botCount} Bots</span>
                <button 
                  type="button" 
                  onClick={() => setBotCount(Math.min(4, botCount + 1))}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center font-bold transition-colors"
                >+</button>
             </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-[0.2em] ml-1">
              Bot Intelligence
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {(['HARD', 'PLAY_WITH_GEMINI'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  className={`py-3 px-4 rounded-xl font-bold text-[11px] tracking-wider uppercase transition-all duration-300 border flex justify-between items-center ${
                    difficulty === level 
                      ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.15)]' 
                      : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10 hover:border-white/10'
                  }`}
                >
                  <span>{level === 'PLAY_WITH_GEMINI' ? 'Gemini AI' : level}</span>
                  {difficulty === level && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,1)]"></span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-[0.2em] ml-1">
              Select Deck
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setDeckType('ORIGINAL')}
                className={`relative flex-1 rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
                  deckType === 'ORIGINAL' 
                    ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] scale-105' 
                    : 'border-white/10 hover:border-white/30 hover:scale-105 opacity-60'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-red-600/40 to-transparent"></div>
                <div className="p-4 flex flex-col items-center relative z-10">
                  <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-2">
                    <span className="text-2xl">💣</span>
                  </div>
                  <h3 className="font-black text-sm text-white uppercase tracking-wider mb-1">Original</h3>
                  <p className="text-[10px] text-slate-300 text-center leading-tight">56 Cards<br/>Up to 5 Players</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDeckType('IMPLODING_KITTENS')}
                className={`relative flex-1 rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
                  deckType === 'IMPLODING_KITTENS' 
                    ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-105' 
                    : 'border-white/10 hover:border-white/30 hover:scale-105 opacity-60'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/40 to-transparent"></div>
                <div className="p-4 flex flex-col items-center relative z-10">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mb-2">
                    <span className="text-2xl">💥</span>
                  </div>
                  <h3 className="font-black text-sm text-white uppercase tracking-wider mb-1 text-center leading-none">Imploding<br/>Expansion</h3>
                  <p className="text-[10px] text-slate-300 text-center leading-tight">76 Cards<br/>Up to 6 Players</p>
                </div>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="mt-2 relative group w-full p-0.5 rounded-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 shadow-[0_0_20px_rgba(220,38,38,0.2)] disabled:opacity-50 transition-all duration-500 active:scale-[0.98]"
          >
            <div className="bg-black/20 w-full h-full rounded-full py-3 flex items-center justify-center">
              <span className="text-white font-black uppercase tracking-[0.15em] text-xs">Enter Match</span>
            </div>
          </button>
        </form>

        <footer className="mt-6 text-center">
           <p className="text-[9px] text-slate-600 font-medium tracking-[0.2em] uppercase">Powered by Gemini AI 2.5</p>
        </footer>
      </div>
    </div>
  );
};
