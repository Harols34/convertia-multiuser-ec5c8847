import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api/browser-engine": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
    // Permitimos requests desde el host de producción para evitar el error
    // "Blocked request. This host (...) is not allowed"
    allowedHosts: ["usuarios.testbot.click"],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
