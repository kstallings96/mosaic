/// <reference types="vite/client" />

/** Only the two the app reads; anything else is a typo waiting to happen. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
