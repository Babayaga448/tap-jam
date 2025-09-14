"use client";

interface GameStatsProps {
  score: number;
  level: number;
  isPlaying: boolean;
}

export default function GameStats({ score, level, isPlaying }: GameStatsProps) {
  if (!isPlaying) return null;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 flex gap-6 landscape:gap-4">
      {/* Score */}
      <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-white/20 px-6 py-3 landscape:px-4 landscape:py-2 shadow-lg">
        <div className="text-center">
          <div className="text-2xl landscape:text-xl font-bold text-white font-orbitron score-animate">
            {score}
          </div>
          <div className="text-xs landscape:text-xs text-white/60 font-orbitron font-medium">
            SCORE
          </div>
        </div>
      </div>

      {/* Level */}
      <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-tileActive/30 px-6 py-3 landscape:px-4 landscape:py-2 shadow-lg">
        <div className="text-center">
          <div className="text-2xl landscape:text-xl font-bold text-tileActive font-orbitron">
            {level}
          </div>
          <div className="text-xs landscape:text-xs text-white/60 font-orbitron font-medium">
            LEVEL
          </div>
        </div>
      </div>
    </div>
  );
}