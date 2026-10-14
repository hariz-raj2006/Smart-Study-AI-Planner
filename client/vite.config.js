import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In development the browser talks to Vite (http://localhost:5173) and Vite forwards
// every /api request to the Express backend. Because the browser only ever sees ONE
// origin, the login cookie is a normal same-site cookie and CORS is not involved.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:5000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true, // the backend's CLIENT_URL expects exactly this port
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
      },
    },
  };
});