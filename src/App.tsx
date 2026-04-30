import React from "react";
import { useSession } from "./contexts/SessionContext";
import MsigDashboard from "./screens/MsigDashboard";

const App: React.FC = () => {
  const { session, loading, login, logout } = useSession();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <span>Loading…</span>
      </div>
    );
  }

  if (session) {
    return <MsigDashboard session={session} onLogout={logout} />;
  }

  return (
    <div className="h-screen bg-black overflow-hidden">
      <div className="max-w-7xl w-full mx-auto px-4 flex h-full">
        <div className="flex-1 flex flex-col justify-center pr-8 lg:pr-16">
          <img
            src="/assets/logo/alienworlds-db-logo_full_color.svg"
            alt="Alien Worlds"
            className="w-[120px] mb-6"
          />
          <h1
            className="text-[32px] font-orbitron font-bold mb-4 bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, #FFFFFF 50%, #8F8E8E 100%)",
            }}
          >
            Generic MSIGs
          </h1>
          <p className="text-sm text-[#8F8E8E] font-titillium max-w-md mb-8 leading-relaxed">
            Trilium (token symbol TLM) is the Alien Worlds in-game currency,
            designe (token symbol TLM) is the Alien Worlds in-game currency,
            designed
          </p>
          <button onClick={login} className="login-gradient-btn" type="button">
            Connect Wallet
          </button>
        </div>
        <div className="hidden md:flex items-center justify-center w-[45%] py-6">
          <img
            src="/assets/hero/login-hero.png"
            alt=""
            className="w-full h-full object-cover rounded-2xl"
          />
        </div>
      </div>
    </div>
  );
};

export default App;
