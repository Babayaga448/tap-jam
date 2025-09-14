"use client";

interface PauseModalProps {
  isPaused: boolean;
  gameStarted: boolean;
  isGameOver: boolean;
  score: number;
  level: number;
  onResume?: () => void; // Add resume callback
}

export default function PauseModal({
  isPaused,
  gameStarted,
  isGameOver,
  score,
  level,
  onResume,
}: PauseModalProps) {
  const handleResume = () => {
    if (onResume) {
      onResume();
    }
  };

  if (!isPaused || !gameStarted || isGameOver) return null;

  return (
    <div 
      className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[99999] p-4"
      onClick={handleResume} // Allow clicking anywhere to resume
    >
      <div 
        className="bg-black/80 backdrop-blur-md rounded-2xl p-8 landscape:p-6 border-2 border-white/30 shadow-2xl text-center max-w-md w-full"
        onClick={e => e.stopPropagation()} // Prevent event bubbling
      >
        {/* Header */}
        <div className="mb-6 landscape:mb-4">
          <h2 className="text-4xl landscape:text-3xl font-bold text-white mb-2 font-orbitron">
            PAUSED
          </h2>
          <p className="text-white/80 font-orbitron">
            Game paused
          </p>
        </div>

        {/* Current Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6 landscape:mb-4">
          <div className="bg-white/10 rounded-lg p-4 landscape:p-3">
            <div className="text-2xl landscape:text-xl font-bold text-white font-orbitron">
              {score}
            </div>
            <div className="text-xs text-white/60 font-orbitron font-medium">
              CURRENT SCORE
            </div>
          </div>
          
          <div className="bg-white/10 rounded-lg p-4 landscape:p-3">
            <div className="text-2xl landscape:text-xl font-bold text-tileActive font-orbitron">
              {level}
            </div>
            <div className="text-xs text-white/60 font-orbitron font-medium">
              CURRENT LEVEL
            </div>
          </div>
        </div>

        {/* Resume Button */}
        <button
          onClick={handleResume}
          className="w-full py-4 landscape:py-3 btn-primary rounded-xl font-bold text-lg landscape:text-base text-white transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white/30 font-orbitron mb-4"
        >
          RESUME GAME
        </button>

        {/* Resume Instructions */}
        <p className="text-white/60 font-orbitron text-sm">
          Or click anywhere to resume
        </p>
      </div>
    </div>
  );
}