// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", // Include if you use classes directly in index.html
    "./src/**/*.{js,ts,jsx,tsx}", // Essential for scanning React components
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}