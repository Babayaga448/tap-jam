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
import * as Tone from 'tone';

// Game Constants
const COLUMNS = 4;
const ROWS_ON_SCREEN = 6;
const TILE_SPEED = 8; // pixels per frame
const SPAWN_RATE = 30; // frames between spawns (1 tile per second at 60fps)

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

  // Audio State
  const [synth, setSynth] = useState<Tone.Synth | null>(null);
  const currentPatternRef = useRef<number>(0);
  const patternNoteIndexRef = useRef<number>(0);

  // Game refs
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const nextTileIdRef = useRef<number>(0);
  const gameStateRef = useRef(gameState);
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

  // Calculate tile dimensions based on screen
  const tileHeight = useMemo(() => {
    if (typeof window === 'undefined') return 120;
    return Math.floor(window.innerHeight / ROWS_ON_SCREEN);
  }, []);

  // Musical Patterns - Your selected 10 patterns
  const musicalPatterns = useMemo(() => [
    // Super Mario Bros Theme
    [
  'E5', 'E5', 'E5', 'C5', 'E5', 'G5', 'G4',
  'C5', 'G4', 'E4', 'A4', 'B4', 'Bb4', 'A4',
  'G4', 'E5', 'G5', 'A5', 'F5', 'G5', 'E5', 'C5', 'D5', 'B4',
  'C5', 'G4', 'E4', 'A4', 'B4', 'Bb4', 'A4',
  'G4', 'E5', 'G5', 'A5', 'F5', 'G5', 'E5', 'C5', 'D5', 'B4',
  'G5', 'F#5', 'F5', 'D#5', 'E5', 'G#4', 'A4', 'C5',
  'A4', 'C5', 'D5', 'G5', 'F#5', 'F5', 'D#5', 'E5',
  'C6', 'C6', 'C6', 'G5', 'F#5', 'F5', 'D#5', 'E5',
  'G#4', 'A4', 'C5', 'A4', 'C5', 'D5'
],
    
    // Tetris Theme (Korobeiniki)
    ['E5', 'B4', 'C5', 'D5', 'C5', 'B4', 'A4', 'A4', 'C5', 'E5', 'D5', 'C5', 'B4'],
    
    // Zelda Main Theme
    ['A4', 'A4', 'A4', 'A4', 'A4', 'A4', 'G4', 'A4', 'G4', 'G4', 'G4', 'G4', 'G4', 'F4', 'G4'],
    
    // Pac-Man Theme
    ['C4', 'C5', 'G4', 'E4', 'C5', 'G4', 'E4', 'C5', 'G4', 'E4', 'C4', 'C4', 'C4'],
    
    // Happy Birthday
    ['C4', 'C4', 'D4', 'C4', 'F4', 'E4', 'C4', 'C4', 'D4', 'C4', 'G4', 'F4'],
    
    // Frère Jacques
    ['C4', 'D4', 'E4', 'C4', 'C4', 'D4', 'E4', 'C4', 'E4', 'F4', 'G4', 'E4', 'F4', 'G4'],
    
    // London Bridge
    ['G4', 'A4', 'G4', 'F4', 'E4', 'F4', 'G4', 'D4', 'E4', 'F4', 'E4', 'F4', 'G4'],
    
    // Row Your Boat
    ['C4', 'C4', 'C4', 'D4', 'E4', 'E4', 'D4', 'E4', 'F4', 'G4'],
    
    // Blue Note Scale
    ['C4', 'Eb4', 'F4', 'F#4', 'G4', 'Bb4', 'C5'],
    
    // Jazz Standard Progression
    ['C4', 'E4', 'G4', 'C5', 'A4', 'F4', 'D4', 'G4', 'C4'],
  ], []);

  // Audio Functions
  const initializeSynth = useCallback(async () => {
    try {
      await Tone.start();
      const pianoSynth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 }
      }).toDestination();
      
      setSynth(pianoSynth);
      console.log('Piano synthesizer initialized successfully');
    } catch (error) {
      console.error('Error initializing synthesizer:', error);
    }
  }, []);

  const playPatternNote = useCallback(() => {
    if (!synth) return;
    
    try {
      // Get current pattern
      const currentPattern = musicalPatterns[currentPatternRef.current];
      
      // Get next note in the current pattern
      const noteToPlay = currentPattern[patternNoteIndexRef.current];
      
      // Play the note
      synth.triggerAttackRelease(noteToPlay, '8n');
      
      // Advance to next note
      patternNoteIndexRef.current += 1;
      
      // Check if current pattern is finished
      if (patternNoteIndexRef.current >= currentPattern.length) {
        // Move to next pattern
        currentPatternRef.current = (currentPatternRef.current + 1) % musicalPatterns.length;
        patternNoteIndexRef.current = 0;
        
        console.log(`Switching to pattern ${currentPatternRef.current + 1} of ${musicalPatterns.length}`);
      }
    } catch (error) {
      console.error('Error playing pattern note:', error);
    }
  }, [synth, musicalPatterns]);

  // Update refs
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);

  const updateGameState = useCallback((updates: Partial<GameState>) => {
    setGameState(prev => ({ ...prev, ...updates }));
  }, []);

  // Score submission
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
        console.error("Error submitting score:", error);
        updateGameState({ isSubmitting: false });
      }
    },
    [walletAddress, gameSessionId, submitScore, updateGameState]
  );

  const debouncedSubmit = useCallback(() => {
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }
    submitTimeoutRef.current = setTimeout(() => {
      submitScoreBatch();
    }, 2000);
  }, [submitScoreBatch]);

  // Create new tile
  const createTile = useCallback((column: number): Tile => {
    return {
      id: `tile-${nextTileIdRef.current++}`,
      column,
      position: -tileHeight, // Start just above screen
      isActive: true,
      isClicked: false,
      speed: TILE_SPEED + (gameStateRef.current.level * 2), // Increase speed with level
    };
  }, [tileHeight]);

  // Handle tile click
const handleTileClick = useCallback((tileId: string, event: React.MouseEvent | React.TouchEvent) => {
        event.stopPropagation();
        event.preventDefault();
    
    if (!gameStateRef.current.isPlaying || gameStateRef.current.isPaused) return;

    setTiles(prevTiles => {
      // Find the clicked tile
      const clickedTileIndex = prevTiles.findIndex(t => t.id === tileId);
      if (clickedTileIndex === -1) return prevTiles;

      const clickedTile = prevTiles[clickedTileIndex];
      
      // Check if tile is still active and not already clicked
      if (!clickedTile.isActive || clickedTile.isClicked) return prevTiles;

      // Find the bottommost active tile (the one player should click next)
      const activeTiles = prevTiles.filter(t => t.isActive && !t.isClicked);
      const bottomMostTile = activeTiles.reduce((bottom, current) => 
        current.position > bottom.position ? current : bottom
      );

      // Must click the bottommost tile
      if (clickedTile.id !== bottomMostTile.id) {
        // Wrong tile clicked - Game Over
        updateGameState({ isPlaying: false, isGameOver: true });
        return prevTiles;
      }

      // Correct tile clicked - PLAY MUSICAL PATTERN NOTE
      playPatternNote();

      const newTiles = [...prevTiles];
      newTiles[clickedTileIndex] = {
        ...clickedTile,
        isClicked: true,
        isActive: false
      };

      // Update score
      setGameState(prev => {
        const newScore = prev.score + 1;
        const newLocalScore = prev.localScore + 1;
        const newTilesClicked = prev.tilesClicked + 1;
        const newLevel = Math.floor(newTilesClicked / 10) + 1;

        if (newLevel > prev.level) {
        }

        debouncedSubmit();

        return {
          ...prev,
          score: newScore,
          localScore: newLocalScore,
          tilesClicked: newTilesClicked,
          level: newLevel,
        };
      });

      return newTiles;
    });
  }, [updateGameState, debouncedSubmit, playPatternNote]);

  // Handle empty space click
  const handleColumnClick = useCallback((column: number, event: React.MouseEvent) => {
    if (!gameStateRef.current.isPlaying || gameStateRef.current.isPaused) return;

    const rect = gameAreaRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickY = event.clientY - rect.top;
    
    // Check if there's a tile at this position
    const tileAtPosition = tilesRef.current.find(tile => 
      tile.column === column &&
      tile.isActive &&
      !tile.isClicked &&
      clickY >= tile.position &&
      clickY <= tile.position + tileHeight
    );

    if (!tileAtPosition) {
      // Clicked empty space - Game Over
      updateGameState({ isPlaying: false, isGameOver: true });
    }
  }, [tileHeight, updateGameState]);

  // Main game loop
  const gameLoop = useCallback(() => {
    if (!gameStateRef.current.isPlaying || gameStateRef.current.isPaused) {
      return;
    }

    frameCountRef.current++;

    setTiles(prevTiles => {
      let newTiles = [...prevTiles];

      // Spawn new tile every SPAWN_RATE frames
      if (frameCountRef.current % SPAWN_RATE === 0) {
        // Always ensure there's at least one active tile on screen
        const activeTiles = newTiles.filter(t => t.isActive);
        if (activeTiles.length < 3) { // Keep 2-3 tiles on screen
          const column = Math.floor(Math.random() * COLUMNS);
          newTiles.push(createTile(column));
        }
      }

      // Update tile positions
      newTiles = newTiles.map(tile => ({
        ...tile,
        position: tile.position + tile.speed,
      }));

      // Remove off-screen tiles and check for game over
      const screenHeight = window.innerHeight;
      newTiles = newTiles.filter(tile => {
        // Remove tiles that went off bottom
        if (tile.position > screenHeight + tileHeight) {
          // If active tile reached bottom without being clicked - Game Over
          if (tile.isActive && !tile.isClicked) {
            updateGameState({ isPlaying: false, isGameOver: true });
            return false;
          }
          return false;
        }
        return true;
      });

      return newTiles;
    });

    // Continue game loop
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [createTile, tileHeight, updateGameState]);

  // Start game
  const startGame = useCallback(() => {
    setTiles([]);
    frameCountRef.current = 0;
    nextTileIdRef.current = 0;

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

    // Reset musical pattern for new game
    currentPatternRef.current = 0;
    patternNoteIndexRef.current = 0;

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

    // Start the game loop
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [walletAddress, gameSessionId, startGameSession, gameLoop, updateGameState, initializeSynth, synth]);

  // Pause/Resume
  const togglePause = useCallback(() => {
    if (gameState.isPlaying && !gameState.isGameOver) {
      const newPausedState = !gameState.isPaused;
      updateGameState({ isPaused: newPausedState });
      
      if (!newPausedState) {
        // Resume game loop
        animationRef.current = requestAnimationFrame(gameLoop);
      } else {
        // Stop game loop
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
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
    frameCountRef.current = 0;
    nextTileIdRef.current = 0;
    
    // Reset musical pattern
    currentPatternRef.current = 0;
    patternNoteIndexRef.current = 0;
    
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
        
        if (!shouldPause && gameState.isPlaying) {
          animationRef.current = requestAnimationFrame(gameLoop);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [gameState.gameStarted, gameState.isGameOver, gameState.isPlaying, gameLoop, updateGameState]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
      // Clean up synthesizer
      if (synth) {
        synth.dispose();
      }
    };
  }, [synth]);

  useEffect(() => {
  if (walletAddress) { // Use walletAddress instead of authenticated
    initializeSynth();
  }
}, [walletAddress, initializeSynth]);

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
                Tap the bottom tile as it reaches the bottom!
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
            {Array.from({ length: COLUMNS }, (_, columnIndex) => (
              <div
                key={columnIndex}
                className="flex-1 border-r border-white/20 relative cursor-pointer"
                style={{ borderRightWidth: columnIndex === COLUMNS - 1 ? 0 : 1 }}
                onClick={(e) => handleColumnClick(columnIndex, e)}
              >
                {/* Tiles in this column */}
                {tiles
                  .filter(tile => tile.column === columnIndex)
                  .map(tile => (
                    <div
                      key={tile.id}
                      className="absolute w-full cursor-pointer"
                      style={{
                        height: tileHeight,
                        top: tile.position,
                        backgroundColor: tile.isClicked ? '#FFC5D3' : '#200052',
                        border: `2px solid ${tile.isClicked ? '#FF69B4' : '#CCCCCC'}`,
                        boxShadow: tile.isClicked 
                          ? '0 0 10px rgba(255, 197, 211, 0.8)' 
                          : '0 2px 4px rgba(0,0,0,0.2)',
                        zIndex: 10,
                      }}
                    {...('ontouchstart' in window 
                    ? { onTouchEnd: (e) => handleTileClick(tile.id, e) }
                    : { onClick: (e) => handleTileClick(tile.id, e) }
                    )}
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