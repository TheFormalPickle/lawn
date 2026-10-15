import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";
import { initializeBrowserAuth } from "@/lib/auth";

async function start() {
  try {
    await initializeBrowserAuth();
  } catch {
    // Render the normal unavailable/retry surface if discovery is unavailable.
    // Never substitute a preview identity or bypass the backend's token checks.
  }
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
  });
}

void start();
