import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const t = process.env.VITE_API || "http://localhost:8000";
export default defineConfig({ plugins: [react()], server: { proxy: { "/api": t, "/files": t } } });
