import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Necessário para carregar arquivos locais com protocolo file:// no Electron
  server: {
    port: 5173
  }
});
