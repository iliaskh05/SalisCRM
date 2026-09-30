import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  // Le mode démo contourne l'authentification : interdit dans un build de production.
  if (command === "build" && env.VITE_DEMO_MODE === "true" && env.VITE_APP_ENV === "production") {
    throw new Error("VITE_DEMO_MODE=true est interdit quand VITE_APP_ENV=production.");
  }

  return {
    plugins: [react(), tailwindcss(), tsconfigPaths()],
    server: {
      port: 5174,
    },
  };
});
