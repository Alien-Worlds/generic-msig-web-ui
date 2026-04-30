"use client";

import App from "./App";
import { SessionProvider } from "./contexts/SessionContext";

export default function AppShell() {
  return (
    <SessionProvider>
      <App />
    </SessionProvider>
  );
}
