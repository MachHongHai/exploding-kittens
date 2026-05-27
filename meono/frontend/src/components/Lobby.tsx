import React, { useState } from 'react';

interface LobbyProps {
  onJoin: (name: string, difficulty: 'EASY' | 'MEDIUM' | 'HARD', botCount: number) => void;
}

export const Lobby: React.FC<LobbyProps> = ({ onJoin }) => {
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [botCount, setBotCount] = useState(3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onJoin(name.trim(), difficulty, botCount);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-[#050505] text-white font-sans p-4 relative overflow-hidden">
      {/* Premium Background Orbs */}
      <div className="absolute top-[10%] left-[20%] w-[30vw] h-[30vw] rounded-full bg-red-900/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[20%] w-[40vw] h-[40vw] rounded-full bg-orange-900/10 blur-[150px] pointer-events-none"></div>

      <div className="bg-white/[0.02] p-8 sm:p-12 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.8)] max-w-md w-full border border-white/10 backdrop-blur-2xl relative z-10">
        <h1 className="text-5xl font-black mb-8 text-center text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 uppercase tracking-tighter drop-shadow-sm leading-tight">
          Exploding <br /> Kittens
        </h1>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-[0.2em] ml-1">
              Player Name
            </label>
            <div className="relative group">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-lg focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all text-white placeholder-slate-600"
                placeholder="Enter your alias"
                maxLength={15}
                required
              />
            </div>
          </div>

          <div className="space-y-3">
             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Opponents</label>
             <div className="flex justify-between items-center bg-black/40 border border-white/10 rounded-2xl px-6 py-4">
                <button 
                  type="button" 
                  onClick={() => setBotCount(Math.max(1, botCount - 1))}
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center font-bold transition-colors"
                >—</button>
                <span className="text-xl font-black text-orange-500">{botCount} Bots</span>
                <button 
                  type="button" 
                  onClick={() => setBotCount(Math.min(4, botCount + 1))}
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center font-bold transition-colors"
                >+</button>
             </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-[0.2em] ml-1">
              Bot Intelligence
            </label>
            <div className="flex flex-col gap-3">
              {(['EASY', 'MEDIUM', 'HARD'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  className={`py-4 px-6 rounded-2xl font-bold text-sm tracking-widest uppercase transition-all duration-300 border flex justify-between items-center ${
                    difficulty === level 
                      ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.15)]' 
                      : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10 hover:border-white/10'
                  }`}
                >
                  <span>{level}</span>
                  {difficulty === level && <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,1)]"></span>}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="mt-4 relative group w-full p-1 rounded-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 shadow-[0_0_30px_rgba(220,38,38,0.3)] disabled:opacity-50 transition-all duration-500 active:scale-[0.98]"
          >
            <div className="bg-black/20 w-full h-full rounded-full py-4 flex items-center justify-center">
              <span className="text-white font-black uppercase tracking-[0.2em] text-sm">Enter Match</span>
            </div>
          </button>
        </form>

        <footer className="mt-8 text-center">
           <p className="text-[10px] text-slate-600 font-medium tracking-[0.2em] uppercase">Powered by Gemini AI 2.5</p>
        </footer>
      </div>
    </div>
  );
};
