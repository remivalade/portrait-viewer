// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'; // Import the Vite plugin

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Add the plugin here
  ],

  // --- ADD THIS SECTION ---
  server: {
    proxy: {
      // Proxy requests starting with /api to your local backend server
      '/api': {
        target: 'http://localhost:3001', // Default backend port
        changeOrigin: true, // Recommended for virtual hosted sites
        // No rewrite needed usually if backend expects /api path
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
  // --- END OF ADDED SECTION ---

  // Remove or comment out this entire css.postcss section if it exists
  // (already looks commented/removed in the version you provided):
  // css: {
  //   postcss: {
  //     plugins: [
  //       // ...
  //     ],
  //   },
  // },

});