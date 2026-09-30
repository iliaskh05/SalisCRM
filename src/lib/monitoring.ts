import * as Sentry from "@sentry/react";

/**
 * Suivi des erreurs en production (Sentry). Inactif sans VITE_SENTRY_DSN : aucune
 * donnée ne sort alors du navigateur. Le SDK n’envoie pas de données personnelles par défaut.
 */
export function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE,
  });
}

export const reportReactError = Sentry.reactErrorHandler();
