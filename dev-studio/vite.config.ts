import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// The dev studio imports the real plugin code (src/): no Superset mock is needed,
// because transformProps and the components do not import @superset-ui modules at runtime.
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
