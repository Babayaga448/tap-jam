"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { monadTestnet } from "viem/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
        config={{
          loginMethodsAndOrder: {
            primary: [`privy:${process.env.NEXT_PUBLIC_MON_ID || ""}`],
          },
          defaultChain: monadTestnet,
          supportedChains: [monadTestnet],
          appearance: {
            logo: "https://via.placeholder.com/40x40/836EF9/FFFFFF?text=TJ",
            landingHeader: "Tap Jam",
            loginMessage: "Fast-paced sound tile game!",
          },
        }}
      >
        {children}
      </PrivyProvider>
    </QueryClientProvider>
  );
}