"use client";

import { useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import TapJamGame from "./TapJamGame";

export default function TapJamAuth() {
  const { authenticated, ready, login } = usePrivy();

  // Memoized button handlers
  const handleLogin = useCallback(() => {
    login();
  }, [login]);

  // Loading state
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-2xl">
          <h2 className="text-3xl font-bold text-center mb-6 text-white font-orbitron">
            Tap Jam
          </h2>
          <div className="text-center text-white">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-white/30 border-t-white mb-4"></div>
            <p className="text-lg font-medium font-orbitron">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated state
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 landscape:p-2 bg-primary">
        <div className="bg-black/20 backdrop-blur-md p-8 landscape:p-6 rounded-3xl border border-white/20 shadow-2xl max-w-md landscape:max-w-lg w-full text-center landscape:max-h-[90vh] landscape:overflow-y-auto">
          <div className="mb-8 landscape:mb-6">
            <h1 className="text-4xl landscape:text-3xl font-bold text-white mb-4 landscape:mb-2 font-orbitron">
              TAP JAM
            </h1>
            <p className="text-white/80 text-lg landscape:text-base font-orbitron font-medium">
              Fast-paced sound tile game
            </p>
          </div>

          <div className="mb-8 landscape:mb-6">
            {/* Game Preview */}
            <div className="flex justify-center space-x-2 mb-6 landscape:mb-4">
              <div className="w-12 h-16 landscape:w-8 landscape:h-12 bg-tile rounded shadow-lg animate-pulse"></div>
              <div className="w-12 h-16 landscape:w-8 landscape:h-12 bg-tile rounded shadow-lg animate-pulse" style={{ animationDelay: "0.2s" }}></div>
              <div className="w-12 h-16 landscape:w-8 landscape:h-12 bg-tile rounded shadow-lg animate-pulse" style={{ animationDelay: "0.4s" }}></div>
              <div className="w-12 h-16 landscape:w-8 landscape:h-12 bg-tile rounded shadow-lg animate-pulse" style={{ animationDelay: "0.6s" }}></div>
            </div>
            <p className="text-white/70 landscape:text-sm font-orbitron">
              Connect your Monad Games ID to start playing and compete on the leaderboard!
            </p>
          </div>

          <button
            onClick={handleLogin}
            className="w-full px-6 py-4 landscape:px-4 landscape:py-3 btn-primary rounded-2xl font-bold text-lg landscape:text-base text-white shadow-lg hover:shadow-xl transform transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-white/30 font-orbitron"
          >
            Connect & Play
          </button>
        </div>
      </div>
    );
  }

  // Authenticated state
  return (
    <div className="min-h-screen relative overflow-hidden bg-primary">
      <TapJamGame />
    </div>
  );
}