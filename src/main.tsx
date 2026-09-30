import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@sentry/react";
import App from "./App";
import { ErrorFallback } from "@/components/ErrorFallback";
import { initMonitoring, reportReactError } from "@/lib/monitoring";
import "./index.css";

initMonitoring();

const root = document.getElementById("root");
if (!root) throw new Error("Élément #root introuvable");

createRoot(root, {
  onUncaughtError: reportReactError,
  onRecoverableError: reportReactError,
}).render(
  <StrictMode>
    <ErrorBoundary fallback={({ resetError }) => <ErrorFallback resetError={resetError} />}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
