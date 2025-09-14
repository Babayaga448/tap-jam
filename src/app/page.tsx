import TapJamAuth from "../components/TapJamAuth";

export default function Home() {
  return (
    <div className="min-h-screen bg-primary">
      {/* Mobile Portrait Rotate Message */}
      <div className="lg:hidden portrait:flex landscape:hidden min-h-screen bg-primary flex-col items-center justify-center p-6 text-center">
        <div className="bg-black/40 backdrop-blur-sm rounded-3xl p-8 border-2 border-white/30 max-w-sm w-full shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-4 drop-shadow-lg font-orbitron">
            Tap Jam
          </h1>

          <p className="text-white/90 mb-6 leading-relaxed font-orbitron">
            For the best gaming experience, please rotate your phone to
            <span className="text-tileActive font-semibold">
              {" "}
              landscape mode
            </span>
            .
          </p>

          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="text-3xl opacity-50">📱</div>
            <div className="text-tileActive text-xl animate-bounce">→</div>
            <div className="text-3xl transform rotate-90">📱</div>
          </div>

          <p className="text-sm text-white/70 font-medium font-orbitron">
            Turn your phone sideways to continue
          </p>
        </div>
      </div>

      {/* Desktop and Mobile Landscape Content */}
      <div className="lg:block portrait:hidden landscape:block">
        <TapJamAuth />
      </div>
    </div>
  );
}