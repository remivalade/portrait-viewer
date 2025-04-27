// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'; // Import the Vite plugin

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Add the plugin here
  ],
  // Remove or comment out this entire css.postcss section if it exists:
  // css: {
  //   postcss: {
  //     plugins: [
  //       // You might have had @tailwindcss/postcss here before - remove it
  //       // autoprefixer might also be here - it's better handled automatically or via postcss.config.js if needed
  //     ],
  //   },
  // },
  // ... other config if any
});