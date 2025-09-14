"use client";

import { useState } from "react";
import Link from "next/link";
import { Minus, Plus, LogOut } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { PlayerScoreResponse, UsernameResponse } from "../types";

interface PlayerProfileProps {
  isLoadingUserName: boolean;
  walletAddress: string | null;
  usernameData: UsernameResponse | undefined;
  playerScoreData: PlayerScoreResponse | undefined;
  isScoreLoading: boolean;
}

export default function PlayerProfile({
  isLoadingUserName,
  usernameData,
  walletAddress,
  playerScoreData,
  isScoreLoading,
}: PlayerProfileProps) {
  const { logout } = usePrivy();
  const [isVisible, setIsVisible] = useState(true);

  return (
    <div className="absolute top-4 right-4 z-50">
      {usernameData?.hasUsername ? (
        <div className="relative inline-block">
          {/* Toggle button */}
          <button
            onClick={() => setIsVisible(!isVisible)}
            className="px-3 py-2 text-sm font-bold bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors duration-200 flex items-center justify-center font-orbitron"
          >
            {isVisible ? <Minus size={16} /> : <Plus size={16} />}
          </button>

          {/* Panel with smooth transitions */}
          <div
            className={`absolute top-full right-0 mt-2 w-52 transition-all duration-300 ease-in-out ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-2 pointer-events-none"
            }`}
          >
            <div className="bg-black/60 backdrop-blur-md rounded-lg border border-white/20 shadow-lg p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-tileActive rounded-full animate-pulse"></div>
                  <span className="text-tileActive text-sm font-bold font-orbitron">
                    Connected
                  </span>
                </div>
                <button
                  onClick={() => logout()}
                  className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                  title="Disconnect"
                >
                  <LogOut className="w-5 h-5 text-white/70" />
                </button>
              </div>

              {/* User info */}
              <div className="text-center space-y-2 mb-4">
                {isLoadingUserName ? (
                  <div className="flex items-center justify-center gap-2 text-white/70">
                    <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span className="text-sm font-orbitron">Loading...</span>
                  </div>
                ) : usernameData?.user?.username ? (
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white font-orbitron">
                      {usernameData.user.username}
                    </h3>
                    <p className="text-xs text-white/50 font-mono">
                      {walletAddress?.slice(0, 6)}...
                      {walletAddress?.slice(-4)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-tileActive text-sm font-bold font-orbitron">
                      Anonymous Player
                    </p>
                    <p className="text-xs text-white/50 font-orbitron">
                      Create username
                    </p>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="border-t border-white/10 pt-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-white font-orbitron">
                    {isScoreLoading ? (
                      <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                    ) : (
                      playerScoreData?.totalScore || 0
                    )}
                  </div>
                  <div className="text-xs text-white/60 font-orbitron font-medium">
                    Total Score
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // No username - prompt to create
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <span className="text-yellow-400 text-sm font-orbitron font-medium">
              No username
            </span>
          </div>
          <Link
            href="https://monad-games-id-site.vercel.app"
            className="inline-flex items-center gap-2 px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 rounded-lg text-yellow-300 hover:text-yellow-200 transition-all duration-200 text-sm font-bold font-orbitron"
            target="_blank"
            referrerPolicy="no-referrer"
          >
            Create Username
          </Link>
          <button
            onClick={() => logout()}
            className="p-2 hover:bg-white/10 rounded transition-colors cursor-pointer"
            title="Disconnect"
          >
            <LogOut className="w-5 h-5 text-white/70" />
          </button>
        </div>
      )}
    </div>
  );
}