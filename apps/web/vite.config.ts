import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'USE_']);

  return {
    plugins: [react()],
    envPrefix: ['VITE_', 'USE_'],
    define: {
      'import.meta.env.USE_MOCK': JSON.stringify(env.USE_MOCK === 'true' || env.VITE_USE_MOCK === 'true'),
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8001',
          changeOrigin: true,
        },
      },
    },
  };
});
