import { Orbitron } from "next/font/google";
import "./globals.css";
import { Metadata } from "next";
import Providers from "./providers";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tap Jam - Fast-paced Sound Tile Game",
  description:
    "Tap Jam is a fast-paced piano tiles inspired game. Test your reflexes and rhythm by tapping the correct tiles as they fall down the screen. Connect with Monad Games ID to compete on the leaderboard!",
  creator: "Tap Jam Team",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${orbitron.variable} font-orbitron antialiased relative w-full h-screen overflow-hidden select-none bg-primary`}
      >
        <Providers>{children}</Providers>
        <ToastContainer position="bottom-right" />
      </body>
    </html>
  );
}