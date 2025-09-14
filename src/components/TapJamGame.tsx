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
const BASE_SPEED = 1.5;
const LEVEL_THRESHOLD = 10;
const SPEED_INCREASE = 0.2;
const TILE_SPAWN_INTERVAL = 1200;

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
  const [nextTileSequence, setNextTileSequence] = useState(0);
  const [lastColumnUsed, setLastColumnUsed] = useState<number | null>(null);
  const [consecutiveColumnCount, setConsecutiveColumnCount] = useState(0);

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

  // Generate new tile with anti-consecutive logic
  const generateTile = useCallback((): Tile => {
    let column: number;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      column = Math.floor(Math.random() * COLUMNS);
      attempts++;
    } while (
      attempts < maxAttempts &&
      lastColumnUsed === column && 
      consecutiveColumnCount >= 1
    );

    if (attempts >= maxAttempts) {
      column = Math.floor(Math.random() * COLUMNS);
    }

    // Update column tracking
    if (column === lastColumnUsed) {
      setConsecutiveColumnCount(prev => prev + 1);
    } else {
      setConsecutiveColumnCount(0);
      setLastColumnUsed(column);
    }

    const tileId = `tile-${Date.now()}-${Math.random()}`;
    const sequence = nextTileSequence;
    setNextTileSequence(prev => prev + 1);

    return {
      id: tileId,
      column,
      position: -TILE_HEIGHT * 2, // Spawn well above visible area
      isActive: true,
      isClicked: false,
      speed: BASE_SPEED + (gameStateRef.current.level - 1) * SPEED_INCREASE,
      sequence,
    };
  }, [lastColumnUsed, consecutiveColumnCount, nextTileSequence]);

  // Handle tile click with sequence validation
  const handleTileClick = useCallback((tileId: string) => {
    if (!gameStateRef.current.isPlaying || gameStateRef.current.isPaused) return;

    const clickedTile = tilesRef.current.find(tile => tile.id === tileId);
    if (!clickedTile) return;

    // Check if it's the correct sequence
    const activeTiles = tilesRef.current
      .filter(tile => tile.isActive && !tile.isClicked)
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    const expectedTile = activeTiles[0];

    if (!expectedTile || clickedTile.id !== expectedTile.id) {
      console.log('Wrong tile clicked - Game Over!');
      updateGameState({ isPlaying: false, isGameOver: true });
      return;
    }

    // Correct tile clicked
    setTiles(prevTiles => {
      return prevTiles.map(tile => {
        if (tile.id === tileId && tile.isActive && !tile.isClicked) {
          updateScore(1);
          return { ...tile, isClicked: true, isActive: false };
        }
        return tile;
      });
    });
  }, [updateScore, updateGameState]);

  // Handle column click (fail if clicking empty space)
  const handleColumnClick = useCallback((column: number, event: React.MouseEvent) => {
    if (!gameStateRef.current.isPlaying || gameStateRef.current.isPaused) return;

    const rect = gameAreaRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickY = event.clientY - rect.top;
    const activeTileInColumn = tilesRef.current.find(tile => 
      tile.column === column && 
      tile.isActive && 
      !tile.isClicked &&
      clickY >= tile.position && 
      clickY <= tile.position + TILE_HEIGHT
    );

    if (!activeTileInColumn) {
      console.log('Clicked empty space in column', column);
      updateGameState({ isPlaying: false, isGameOver: true });
    }
  }, [updateGameState]);

  // Game loop
  const gameLoop = useCallback((currentTime: number) => {
    if (!gameStateRef.current.isPlaying || gameStateRef.current.isPaused) return;

    // Spawn new tiles
    if (currentTime - lastTileSpawnRef.current > TILE_SPAWN_INTERVAL) {
      const newTile = generateTile();
      setTiles(prev => [...prev, newTile]);
      lastTileSpawnRef.current = currentTime;
    }

    // Update tile positions and check for game over
    setTiles(prevTiles => {
      const gameHeight = gameAreaRef.current?.getBoundingClientRect().height || window.innerHeight;
      
      return prevTiles.filter(tile => {
        if (tile.position > gameHeight + TILE_HEIGHT) {
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
    });

    if (gameStateRef.current.isPlaying && !gameStateRef.current.isPaused) {
      animationRef.current = requestAnimationFrame(gameLoop);
    }
  }, [generateTile, updateGameState]);

  // Start game
  const startGame = useCallback(() => {
    setTiles([]);
    setNextTileSequence(0);
    setLastColumnUsed(null);
    setConsecutiveColumnCount(0);
    
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
      const newPausedState = !gameState.isPaused;
      updateGameState({ isPaused: newPausedState });
      
      if (!newPausedState) {
        lastTileSpawnRef.current = performance.now();
        animationRef.current = requestAnimationFrame(gameLoop);
      } else {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
      }
    }
  }, [gameState.isPlaying, gameState.isGameOver, gameState.isPaused, gameLoop, updateGameState]);

  // Reset game
  const resetGame = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    setTiles([]);
    setNextTileSequence(0);
    setLastColumnUsed(null);
    setConsecutiveColumnCount(0);
    
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
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
      submitScoreBatch(gameState.localScore);

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
        const shouldPause = document.hidden;
        updateGameState({ isPaused: shouldPause });
        
        if (!shouldPause) {
          lastTileSpawnRef.current = performance.now();
          animationRef.current = requestAnimationFrame(gameLoop);
        }
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
        lastTileSpawnRef.current = performance.now();
        animationRef.current = requestAnimationFrame(gameLoop);
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
  }, [gameState.gameStarted, gameState.isGameOver, gameState.isPaused, gameLoop, updateGameState]);

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
                Tap the tiles in order as they fall!
              </p>
              <p className="text-white/70 font-orbitron">
                Miss the sequence and its game over!
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

        {/* Game Columns - Optimized rendering */}
        {gameState.gameStarted && (
          <div className="flex h-full">
            {Array.from({ length: COLUMNS }, (_, columnIndex) => {
              // Pre-filter tiles for this column to avoid filtering on every render
              const columnTiles = tiles.filter(tile => tile.column === columnIndex);
              
              return (
                <div
                  key={columnIndex}
                  className="flex-1 border-r border-white/20 relative cursor-pointer hover:bg-white/5 transition-colors"
                  style={{ borderRightWidth: columnIndex === COLUMNS - 1 ? 0 : 1 }}
                  onClick={(e) => handleColumnClick(columnIndex, e)}
                >
                  {/* Pre-filtered column tiles */}
                  {columnTiles.map(tile => (
                    <div
                      key={tile.id}
                      className="absolute w-full cursor-pointer"
                      style={{
                        height: TILE_HEIGHT,
                        top: Math.max(0, tile.position),
                        zIndex: 10,
                        backgroundColor: tile.isClicked ? '#FFC5D3' : '#FFFFFF',
                        border: `2px solid ${tile.isClicked ? '#FF69B4' : '#CCCCCC'}`,
                        boxShadow: tile.isClicked 
                          ? '0 0 10px rgba(255, 197, 211, 0.8)' 
                          : '0 2px 4px rgba(0,0,0,0.1)',
                        // Add transform3d for hardware acceleration
                        transform: 'translate3d(0, 0, 0)',
                        willChange: 'top',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTileClick(tile.id);
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation();
                        handleTileClick(tile.id);
                      }}
                    />
                  ))}
                </div>
              );
            })}
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
        onResume={togglePause}
      />

      <GameOverModal
        isGameOver={gameState.isGameOver}
        gameStats={gameStats}
        onRestart={resetGame}
      />
    </div>
  );
}