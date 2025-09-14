"use client";

import axios from "axios";

// Create axios instance with base configuration
export const api = axios.create({
  // Use relative URLs - this will automatically use the current domain
  baseURL: "/",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth headers
api.interceptors.request.use(
  config => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  error => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  response => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  error => {
    console.error('API Response Error:', error.response?.status, error.config?.url, error.response?.data);
    // Handle common errors here
    if (error.response?.status === 401) {
      console.error("Unauthorized request");
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const apiEndpoints = {
  checkWallet: "/api/check-wallet",
  getPlayerTotalScore: "/api/get-player-total-score",
  startGameSession: "/api/start-game-session",
  endGameSession: "/api/end-game-session",
  submitScore: "/api/submit-score",
  leaderBoard: "/api/leaderboard",
} as const;