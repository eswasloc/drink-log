import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig(({ mode }) => ({
  base: "/drink-log/",
  plugins: [react(), ...(mode === "https" ? [basicSsl()] : [])],
  server: {
    host: true,
    port: 5173,
  },
}));
