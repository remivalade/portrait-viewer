/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Add font family definition
      fontFamily: {
        script: ['Pacifico', 'cursive'], // Use 'Pacifico', fallback to cursive
      }
    },
  },
  plugins: [],
}