"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Tile, GameState, GameStats, SubmitScoreResponse } from "../types";
import { useCrossAppAccount } from "../hooks/useCrossAppAccount";
import { usePlayerTotalScore } from "../hooks/usePlayerTotalScore";
import { useUsername } from "../hooks/useUsername";
import { useGameSession } from "../hooks/useGameSession";
import { toast } from "react-toastify";
import TransactionToast from "./TransactionToast";
import PlayerProfile from "./PlayerProfile";
import GameOverModal from "./GameOverModal";
import PauseModal from "./PauseModal";
import GameStatsComponent from "./GameStats";
import { Play, Pause } from "lucide-react";

const TILE_HEIGHT = 120;
const COLUMNS = 4;
const BASE_SPEED = 2;
const LEVEL_THRESHOLD = 10;
const SPEED_INCREASE = 0.3;
const TILE_SPAWN_INTERVAL = 800;

export default function TapJamGame() {
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    level: 1,
    isPlaying: false,
    isGameOver: false,
    isPaused: false,
    tilesClicked: 0,
    gameStarted: false,
    localScore: 0,
    submittedScore: 0,
    isSubmitting: false,
  });

  const [tiles, setTiles] = useState<Tile[]>([]);
  const [gameSessionToken, setGameSessionToken] = useState<string | null>(null);
  const [gameSessionId, setGameSessionId] = useState<string | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);

  // Refs
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTileSpawnRef = useRef<number>(0);
  const gameStateRef = useRef<GameState>(gameState);
  const tilesRef = useRef<Tile[]>([]);
  const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hooks
  const { walletAddress } = useCrossAppAccount();
  const { data: playerScoreData, isLoading: isScoreLoading } = usePlayerTotalScore({
    walletAddress,
    gameStarted: gameState.gameStarted,
    gameOver: gameState.isGameOver,
  });
  const { data: usernameData, isLoading: isLoadingUserName } = useUsername(walletAddress);
  const { startGameSession, endGameSession, submitScore } = useGameSession(gameSessionToken);

  // Update refs when state changes
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);

  // Optimized state update functions
  const updateGameState = useCallback((updates: Partial<GameState>) => {
    setGameState(prev => ({ ...prev, ...updates }));
  }, []);

  // Batch score submission with debouncing
  const submitScoreBatch = useCallback(
    async (finalScore?: number) => {
      const scoreToSubmit = finalScore || gameStateRef.current.localScore;
      const scoreDifference = scoreToSubmit - gameStateRef.current.submittedScore;

      if (scoreDifference <= 0 || gameStateRef.current.isSubmitting) return;

      updateGameState({ isSubmitting: true });

      try {
        const data: SubmitScoreResponse = await new Promise((resolve, reject) => {
          submitScore.mutate(
            {
              player: walletAddress!,
              transactionAmount: 1,
              scoreAmount: scoreDifference,
              sessionId: gameSessionId!,
            },
            { onSuccess: resolve, onError: reject }
          );
        });

        updateGameState({
          submittedScore: scoreToSubmit,
          isSubmitting: false,
        });

        toast(<TransactionToast transactionsInfo={data} />, {
          autoClose: 4000,
          closeOnClick: false,
          pauseOnHover: true,
          draggable: false,
        });
      } catch (error) {
        console.error("Error submitting score batch:", error);
        updateGameState({ isSubmitting: false });
      }
    },
    [walletAddress, gameSessionId, submitScore, updateGameState]
  );

  // Debounced score submission
  const debouncedSubmit = useCallback(() => {
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }
    submitTimeoutRef.current = setTimeout(() => {
      submitScoreBatch();
    }, 2000);
  }, [submitScoreBatch]);

  // Update score
  const updateScore = useCallback(
    (points: number) => {
      setGameState(prev => {
        const newLocalScore = prev.localScore + points;
        const newScore = prev.score + points;
        const newTilesClicked = prev.tilesClicked + 1;
        const newLevel = Math.floor(newTilesClicked / LEVEL_THRESHOLD) + 1;
        
        // Check for level up
        if (newLevel > prev.level) {
          setShowLevelUp(true);
          setTimeout(() => setShowLevelUp(false), 2000);
        }

        debouncedSubmit();
        return { 
          ...prev, 
          localScore: newLocalScore, 
          score: newScore,
          tilesClicked: newTilesClicked,
          level: newLevel
        };
      });
    },
    [debouncedSubmit]
  );

  // Generate new tile
  const generateTile = useCallback((): Tile => {
    return {
      id: Date.now() + Math.random().toString(),
      column: Math.floor(Math.random() * COLUMNS),
      position: -TILE_HEIGHT,
      isActive: true,
      isClicked: false,
      speed: BASE_SPEED + (gameStateRef.current.level - 1) * SPEED_INCREASE,
    };
  }, []);

  // Handle tile click
  const handleTileClick = useCallback((tileId: string) => {
    if (!gameStateRef.current.isPlaying || gameStateRef.current.isPaused) return;

    setTiles(prevTiles => {
      const newTiles = prevTiles.map(tile => {
        if (tile.id === tileId && tile.isActive && !tile.isClicked) {
          updateScore(1);
          return { ...tile, isClicked: true, isActive: false };
        }
        return tile;
      });
      return newTiles;
    });
  }, [updateScore]);

  // Game loop
  const gameLoop = useCallback((currentTime: number) => {
    if (!gameStateRef.current.isPlaying || gameStateRef.current.isPaused) return;

    // Spawn new tiles
    if (currentTime - lastTileSpawnRef.current > TILE_SPAWN_INTERVAL) {
      setTiles(prev => [...prev, generateTile()]);
      lastTileSpawnRef.current = currentTime;
    }

    // Update tile positions and check for game over
    setTiles(prevTiles => {
      const newTiles = prevTiles.filter(tile => {
        // Remove tiles that are off screen
        if (tile.position > window.innerHeight + TILE_HEIGHT) {
          // If tile was not clicked and reached bottom, game over
          if (tile.isActive && !tile.isClicked) {
            updateGameState({ isPlaying: false, isGameOver: true });
            return false;
          }
          return false;
        }
        return true;
      }).map(tile => ({
        ...tile,
        position: tile.position + tile.speed,
      }));
      
      return newTiles;
    });

    if (gameStateRef.current.isPlaying && !gameStateRef.current.isPaused) {
      animationRef.current = requestAnimationFrame(gameLoop);
    }
  }, [generateTile, updateGameState]);

  // Start game
  const startGame = useCallback(() => {
    setTiles([]);
    updateGameState({
      score: 0,
      localScore: 0,
      level: 1,
      isPlaying: true,
      isGameOver: false,
      isPaused: false,
      tilesClicked: 0,
      gameStarted: true,
    });
    lastTileSpawnRef.current = 0;
    
    // Start game session
    if (walletAddress && !gameSessionId) {
      startGameSession.mutate(
        { walletAddress },
        {
          onSuccess: data => {
            setGameSessionToken(data.sessionToken);
            setGameSessionId(data.sessionId);
          },
          onError: error => {
            console.error("Error starting game session:", error);
          },
        }
      );
    }

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [walletAddress, gameSessionId, startGameSession, gameLoop, updateGameState]);

  // Pause/Resume game
  const togglePause = useCallback(() => {
    if (gameState.isPlaying && !gameState.isGameOver) {
      updateGameState({ isPaused: !gameState.isPaused });
      if (!gameState.isPaused) {
        animationRef.current = requestAnimationFrame(gameLoop);
      }
    }
  }, [gameState.isPlaying, gameState.isGameOver, gameState.isPaused, gameLoop, updateGameState]);

  // Reset game
  const resetGame = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    setTiles([]);
    updateGameState({
      score: 0,
      localScore: 0,
      level: 1,
      isPlaying: false,
      isGameOver: false,
      isPaused: false,
      tilesClicked: 0,
      gameStarted: false,
      submittedScore: 0,
      isSubmitting: false,
    });

    // End game session
    if (gameSessionId) {
      endGameSession.mutate(
        { sessionId: gameSessionId },
        {
          onSuccess: () => {
            setGameSessionToken(null);
            setGameSessionId(null);
          },
          onError: error => {
            console.error("Error ending game session:", error);
            setGameSessionToken(null);
            setGameSessionId(null);
          },
        }
      );
    }
  }, [gameSessionId, endGameSession, updateGameState]);

  // Handle game over
  useEffect(() => {
    if (gameState.isGameOver && gameState.gameStarted) {
      // Submit final score
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
      submitScoreBatch(gameState.localScore);

      // End game session
      if (gameSessionId) {
        endGameSession.mutate(
          { sessionId: gameSessionId },
          {
            onSuccess: () => {
              setGameSessionToken(null);
              setGameSessionId(null);
            },
            onError: error => {
              console.error("Error ending game session:", error);
              setGameSessionToken(null);
              setGameSessionId(null);
            },
          }
        );
      }
    }
  }, [gameState.isGameOver, gameState.gameStarted, gameState.localScore, gameSessionId, endGameSession, submitScoreBatch]);

  // Window visibility handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (gameState.gameStarted && !gameState.isGameOver) {
        updateGameState({ isPaused: document.hidden });
      }
    };

    const handleWindowBlur = () => {
      if (gameState.gameStarted && !gameState.isGameOver) {
        updateGameState({ isPaused: true });
      }
    };

    const handleWindowFocus = () => {
      if (gameState.gameStarted && !gameState.isGameOver && gameState.isPaused) {
        updateGameState({ isPaused: false });
        if (gameState.isPlaying) {
          animationRef.current = requestAnimationFrame(gameLoop);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [gameState.gameStarted, gameState.isGameOver, gameState.isPaused, gameState.isPlaying, gameLoop, updateGameState]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
    };
  }, []);

  // Memoized game stats
  const gameStats: GameStats = useMemo(
    () => ({
      score: gameState.score,
      level: gameState.level,
      accuracy: gameState.tilesClicked > 0 ? Math.round((gameState.score / gameState.tilesClicked) * 100) : 100,
      tilesClicked: gameState.tilesClicked,
    }),
    [gameState.score, gameState.level, gameState.tilesClicked]
  );

  return (
    <div className="min-h-screen bg-primary relative overflow-hidden">
      {/* Player Profile */}
      <PlayerProfile
        isLoadingUserName={isLoadingUserName}
        usernameData={usernameData}
        walletAddress={walletAddress}
        playerScoreData={playerScoreData}
        isScoreLoading={isScoreLoading}
      />

      {/* Game Stats */}
      {gameState.gameStarted && (
                <GameStatsComponent
        score={gameState.score}
        level={gameState.level}
        isPlaying={gameState.isPlaying}
        />
      )}

      {/* Pause Button */}
      {gameState.gameStarted && !gameState.isGameOver && (
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={togglePause}
            className="w-12 h-12 bg-black/60 backdrop-blur-sm rounded-full border border-white/20 shadow-lg hover:bg-black/80 transition-all duration-200 flex items-center justify-center"
          >
            {gameState.isPaused ? (
              <Play className="w-6 h-6 text-white ml-1" />
            ) : (
              <Pause className="w-6 h-6 text-white" />
            )}
          </button>
        </div>
      )}

      {/* Level Up Notification */}
      {showLevelUp && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 level-notification">
          <div className="bg-black/80 backdrop-blur-sm rounded-2xl px-8 py-4 border border-tileActive shadow-2xl">
            <h2 className="text-3xl font-bold text-tileActive text-center font-orbitron">
              LEVEL {gameState.level}
            </h2>
          </div>
        </div>
      )}

      {/* Game Area */}
      <div
        ref={gameAreaRef}
        className="relative w-full h-screen overflow-hidden game-area"
      >
        {/* Game Start Screen */}
        {!gameState.gameStarted && usernameData?.hasUsername && (
          <div className="h-screen flex flex-col items-center justify-center gap-8 z-40">
            <div className="text-center">
              <h1 className="text-6xl landscape:text-4xl font-bold text-white mb-4 font-orbitron">
                TAP JAM
              </h1>
              <p className="text-xl landscape:text-lg text-white/80 mb-8 font-orbitron">
                Fast-paced sound tile game
              </p>
            </div>

            <div className="text-center mb-8">
              <p className="text-white/90 mb-4 font-orbitron text-lg landscape:text-base">
                Tap the falling tiles to score points!
              </p>
              <p className="text-white/70 font-orbitron">
                Miss a tile and its game over!
              </p>
            </div>

            <button
              onClick={startGame}
              className="px-12 py-4 btn-primary rounded-2xl font-bold text-2xl landscape:text-xl text-white shadow-lg transform transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white/30 font-orbitron game-start"
            >
              PLAY
            </button>
          </div>
        )}

        {/* Loading Username */}
        {isLoadingUserName && (
          <div className="absolute z-40 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="flex items-center justify-center gap-3 text-white">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span className="text-xl font-orbitron">Loading...</span>
            </div>
          </div>
        )}

        {/* Game Columns */}
        {gameState.gameStarted && (
          <div className="flex h-full">
            {Array.from({ length: COLUMNS }, (_, index) => (
              <div
                key={index}
                className="flex-1 border-r border-white/20 relative"
                style={{ borderRightWidth: index === COLUMNS - 1 ? 0 : 1 }}
              >
                {/* Column tiles */}
                {tiles
                  .filter(tile => tile.column === index)
                  .map(tile => (
                    <div
                      key={tile.id}
                      className={`absolute w-full tile cursor-pointer ${
                        tile.isClicked ? 'clicked' : ''
                      }`}
                      style={{
                        height: TILE_HEIGHT,
                        top: tile.position,
                        backgroundColor: tile.isClicked ? '#FFC5D3' : '#200052',
                      }}
                      onClick={() => handleTileClick(tile.id)}
                      onTouchEnd={() => handleTileClick(tile.id)}
                    />
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <PauseModal
        isPaused={gameState.isPaused}
        gameStarted={gameState.gameStarted}
        isGameOver={gameState.isGameOver}
        score={gameState.score}
        level={gameState.level}
      />

      <GameOverModal
        isGameOver={gameState.isGameOver}
        gameStats={gameStats}
        onRestart={resetGame}
      />
    </div>
  );
}