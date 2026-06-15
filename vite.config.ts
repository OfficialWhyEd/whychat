import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages project site → served from /whychat/
export default defineConfig({
  base: "/whychat/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
