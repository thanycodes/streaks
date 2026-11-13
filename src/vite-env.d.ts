/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the sync Worker, e.g. https://streaks-sync.you.workers.dev. Unset = no sync. */
  readonly VITE_SYNC_URL?: string;
}
