"use client";

import { GameStats } from "../types";

interface GameOverModalProps {
  isGameOver: boolean;
  gameStats: GameStats;
  onRestart: () => void;
}

export default function GameOverModal({
  isGameOver,
  gameStats,
  onRestart,
}: GameOverModalProps) {
  const handleButtonClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onRestart();
  };

  if (!isGameOver) return null;

  return (
    <div
      className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onMouseDown={e => e.stopPropagation()}
      onMouseMove={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      <div className="bg-black/80 backdrop-blur-md rounded-2xl p-8 landscape:p-6 border-2 border-white/30 shadow-2xl text-center max-w-md w-full game-over-modal">
        {/* Header */}
        <div className="mb-6 landscape:mb-4">
          <h2 className="text-4xl landscape:text-3xl font-bold text-white mb-2 font-orbitron">
            GAME OVER
          </h2>
          <p className="text-white/80 font-orbitron">
            You missed a tile!
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8 landscape:mb-6">
          <div className="bg-white/10 rounded-lg p-4 landscape:p-3">
            <div className="text-2xl landscape:text-xl font-bold text-white font-orbitron">
              {gameStats.score}
            </div>
            <div className="text-xs text-white/60 font-orbitron font-medium">
              SCORE
            </div>
          </div>
          
          <div className="bg-white/10 rounded-lg p-4 landscape:p-3">
            <div className="text-2xl landscape:text-xl font-bold text-tileActive font-orbitron">
              {gameStats.level}
            </div>
            <div className="text-xs text-white/60 font-orbitron font-medium">
              LEVEL
            </div>
          </div>
          
          <div className="bg-white/10 rounded-lg p-4 landscape:p-3">
            <div className="text-2xl landscape:text-xl font-bold text-white font-orbitron">
              {gameStats.accuracy}%
            </div>
            <div className="text-xs text-white/60 font-orbitron font-medium">
              ACCURACY
            </div>
          </div>
        </div>

        {/* Restart Button */}
        <button
          onClick={handleButtonClick}
          onTouchEnd={handleButtonClick}
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          className="w-full py-4 landscape:py-3 btn-primary rounded-xl font-bold text-lg landscape:text-base text-white transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white/30 font-orbitron"
        >
          PLAY AGAIN
        </button>
      </div>
    </div>
  );
}