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
const BASE_SPEED = 1.5; // Reduced for smoother movement
const LEVEL_THRESHOLD = 10;
const SPEED_INCREASE = 0.2;
const TILE_SPAWN_INTERVAL = 1200; // Reduced for better spacing
const GAME_WIDTH = 400; // Fixed game width
const MIN_COLUMN_GAP = 2; // Minimum gap between consecutive tiles in same column

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
  const [nextTileSequence, setNextTileSequence] = useState(0); // Track expected tile sequence
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
    
    // Prevent consecutive tiles in the same column
    do {
      column = Math.floor(Math.random() * COLUMNS);
    } while (
      lastColumnUsed === column && 
      consecutiveColumnCount >= 1 // Prevent any consecutive tiles in same column
    );

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
      position: -TILE_HEIGHT,
      isActive: true,
      isClicked: false,
      speed: BASE_SPEED + (gameStateRef.current.level - 1) * SPEED_INCREASE,
      sequence, // Add sequence number for order tracking
    };
  }, [lastColumnUsed, consecutiveColumnCount, nextTileSequence]);

  // Handle tile click with sequence validation
  const handleTileClick = useCallback((tileId: string) => {
    if (!gameStateRef.current.isPlaying || gameStateRef.current.isPaused) return;

    const clickedTile = tilesRef.current.find(tile => tile.id === tileId);
    
    if (!clickedTile) return;

    // Check if it's the correct sequence (must click tiles in order)
    const activeTiles = tilesRef.current
      .filter(tile => tile.isActive && !tile.isClicked)
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    const expectedTile = activeTiles[0];

    if (!expectedTile || clickedTile.id !== expectedTile.id) {
      // Wrong sequence or tile - Game Over!
      console.log('Wrong tile clicked! Expected:', expectedTile?.id, 'Got:', clickedTile.id);
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

    // Check if there's an active tile in this column at the click position
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
      // Clicked empty space in column - Game Over!
      console.log('Clicked empty space in column', column);
      updateGameState({ isPlaying: false, isGameOver: true });
    }
  }, [updateGameState]);

  // Improved game loop with better performance
  const gameLoop = useCallback((currentTime: number) => {
    if (!gameStateRef.current.isPlaying || gameStateRef.current.isPaused) return;

    // Spawn new tiles
    if (currentTime - lastTileSpawnRef.current > TILE_SPAWN_INTERVAL) {
      setTiles(prev => [...prev, generateTile()]);
      lastTileSpawnRef.current = currentTime;
    }

    // Update tile positions and check for game over
    setTiles(prevTiles => {
      const gameHeight = gameAreaRef.current?.getBoundingClientRect().height || window.innerHeight;
      
      return prevTiles.filter(tile => {
        // Remove tiles that are off screen
        if (tile.position > gameHeight + TILE_HEIGHT) {
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
        const shouldPause = document.hidden;
        updateGameState({ isPaused: shouldPause });
        
        if (!shouldPause) {
          // Resume game loop when window becomes visible
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
    <div className="min-h-screen bg-primary relative overflow-hidden flex items-center justify-center">
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

      {/* Responsive Game Container */}
      <div 
        className="relative bg-black/20 backdrop-blur-sm rounded-lg border-2 border-white/20 shadow-2xl overflow-hidden"
        style={{ 
          width: `min(${GAME_WIDTH}px, 90vw)`,
          height: `min(600px, 80vh)`,
        }}
      >
        <div
          ref={gameAreaRef}
          className="relative w-full h-full game-area"
        >
          {/* Game Start Screen */}
          {!gameState.gameStarted && usernameData?.hasUsername && (
            <div className="h-full flex flex-col items-center justify-center gap-6 z-40 p-4">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-white mb-4 font-orbitron">
                  TAP JAM
                </h1>
                <p className="text-lg text-white/80 mb-6 font-orbitron">
                  Fast-paced sound tile game
                </p>
              </div>

              <div className="text-center mb-6">
                <p className="text-white/90 mb-2 font-orbitron">
                  Tap the tiles in order as they fall!
                </p>
                <p className="text-white/70 font-orbitron text-sm">
                  Miss the sequence and its game over!
                </p>
              </div>

              <button
                onClick={startGame}
                className="px-8 py-3 btn-primary rounded-xl font-bold text-xl text-white shadow-lg transform transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white/30 font-orbitron game-start"
              >
                PLAY
              </button>
            </div>
          )}

          {/* Loading Username */}
          {isLoadingUserName && (
            <div className="absolute z-40 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="flex items-center justify-center gap-3 text-white">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span className="text-lg font-orbitron">Loading...</span>
              </div>
            </div>
          )}

          {/* Game Columns */}
          {gameState.gameStarted && (
            <div className="flex h-full relative">
              {/* Debug info */}
              <div className="absolute top-2 left-2 text-white text-xs bg-black/50 p-2 rounded z-50">
                <div>Tiles: {tiles.length}</div>
                <div>Active: {tiles.filter(t => t.isActive).length}</div>
                <div>Playing: {gameState.isPlaying ? 'Yes' : 'No'}</div>
                <div>Paused: {gameState.isPaused ? 'Yes' : 'No'}</div>
              </div>
              
              {Array.from({ length: COLUMNS }, (_, index) => (
                <div
                  key={index}
                  className="flex-1 border-r border-white/20 relative cursor-pointer hover:bg-white/5 transition-colors"
                  style={{ borderRightWidth: index === COLUMNS - 1 ? 0 : 1 }}
                  onClick={(e) => handleColumnClick(index, e)}
                >
                  {/* Column tiles */}
                  {tiles
                    .filter(tile => tile.column === index)
                    .map(tile => (
                      <div
                        key={tile.id}
                        className={`absolute w-full cursor-pointer transition-colors duration-150 border border-white/30 ${
                          tile.isClicked ? 'bg-tileActive' : 'bg-tile hover:bg-tile/80'
                        }`}
                        style={{
                          height: TILE_HEIGHT,
                          top: Math.max(0, tile.position), // Ensure tiles are visible
                          zIndex: 10,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Tile clicked:', tile.id, 'sequence:', tile.sequence);
                          handleTileClick(tile.id);
                        }}
                      />
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
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