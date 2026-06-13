import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
    // Railway serves this behind nearpast.com / *.up.railway.app. Vite 5+ preview
    // blocks unknown Host headers by default, which fails Railway's "/" healthcheck.
    // Allow all hosts so the healthcheck and custom domain reach the app.
    allowedHosts: true,
  },
});
