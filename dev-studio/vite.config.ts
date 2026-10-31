import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Il dev-studio importa il codice reale del plugin (src/): nessun mock di Superset e' necessario,
// perche' transformProps e i componenti non importano moduli @superset-ui a runtime.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      echarts: path.resolve(__dirname, 'node_modules/echarts'),
    },
  },
  server: { port: 5174, host: true },
});
