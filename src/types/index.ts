export interface Tile {
  id: string;
  column: number;
  position: number;
  isActive: boolean;
  isClicked: boolean;
  speed: number;
  sequence?: number; // Add sequence property for order tracking
}

export interface GameState {
  score: number;
  level: number;
  isPlaying: boolean;
  isGameOver: boolean;
  isPaused: boolean;
  tilesClicked: number;
  gameStarted: boolean;
  localScore: number;
  submittedScore: number;
  isSubmitting: boolean;
}

export interface GameStats {
  score: number;
  level: number;
  accuracy: number;
  tilesClicked: number;
}

export interface UserData {
  hasUsername: boolean;
  user: {
    id: number;
    username: string;
    walletAddress: string;
  };
}

export interface SessionData {
  player: string;
  sessionId: string;
  startTime: number;
  iat: number;
}

export interface StartGameSessionRequest {
  walletAddress: string;
}

export interface StartGameSessionResponse {
  sessionToken: string;
  sessionId: string;
}

export interface EndGameSessionRequest {
  sessionId: string;
}

export interface SubmitScoreRequest {
  player: string;
  transactionAmount: number;
  scoreAmount: number;
  sessionId: string;
}

export interface SubmitScoreResponse {
  success: true;
  transactionHash: string;
  player: `0x${string}`;
  scoreAmount: number;
  transactionAmount: number;
}

export interface UsernameResponse {
  hasUsername: boolean;
  user?: {
    username: string;
  };
  error?: string;
}

export interface PlayerScoreResponse {
  totalScore: number;
}

export interface LeaderBoardData {
  userId: number;
  rank: number;
  walletAddress: string;
  username: string;
  score: number;
}

export interface LeaderboardResponse {
  data: {
    data: LeaderBoardData[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}