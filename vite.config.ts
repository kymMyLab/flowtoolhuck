import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    cssInjectedByJsPlugin(),
  ],
  resolve: {
    alias: {
      // 内部コードの import { Flow } from 'flow-sdk' はすべて shim (window.Flow参照Proxy) に接続
      'flow-sdk': path.resolve(__dirname, './src/flow-sdk-shim.ts'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/index.tsx'),
      output: {
        entryFileNames: 'bundle.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        format: 'es',
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('ComicCreationWizardModal')) {
            return 'comic-wizard';
          }
          if (id.includes('CastManagerModal')) {
            return 'cast-manager';
          }
          if (id.includes('StudioSidebar')) {
            return 'studio-sidebar';
          }
          if (id.includes('directorService') || id.includes('productionPipelines')) {
            return 'production-engine';
          }
          if (id.includes('constants') || id.includes('studioDefinitions')) {
            return 'studio-constants';
          }
        },
      },
      external: [],
    },
  },
});
