/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_EMAIL_PROVIDER?: string;
  readonly VITE_DEMO_MODE?: string;
  /** Suivi des erreurs (Sentry). Vide = désactivé. */
  readonly VITE_SENTRY_DSN?: string;
  /** production | staging | development — étiquette les erreurs Sentry. */
  readonly VITE_APP_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
