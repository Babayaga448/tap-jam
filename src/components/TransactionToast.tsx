"use client";

import Link from "next/link";
import { SubmitScoreResponse } from "../types";
import { ExternalLink, CheckCircle } from "lucide-react";

interface TransactionToastProps {
  transactionsInfo: SubmitScoreResponse;
}

export default function TransactionToast({
  transactionsInfo,
}: TransactionToastProps) {
  return (
    <div className="flex items-center gap-3 p-3 font-orbitron">
      {/* Success icon */}
      <CheckCircle className="w-5 h-5 text-tileActive flex-shrink-0" />

      {/* Message */}
      <div className="flex-1">
        <span className="text-sm text-white font-bold">
          Score submitted successfully!
        </span>
      </div>

      {/* Explorer link */}
      <Link
        referrerPolicy="no-referrer"
        target="_blank"
        href={`https://testnet.monadexplorer.com/tx/${transactionsInfo.transactionHash}`}
        className="flex items-center gap-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-white hover:text-tileActive transition-colors text-xs font-bold"
        onClick={e => e.stopPropagation()}
      >
        <ExternalLink className="w-3 h-3" />
        <span>View Transaction</span>
      </Link>
    </div>
  );
}