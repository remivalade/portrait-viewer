# frontend/tailwind.config.cjs
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: { script: ['Pacifico', 'cursive'] },
      boxShadow: {
        'glow-dark': '0 0 15px rgba(255 255 255 / .5)',
        'glow-light': '0 0 15px rgba(192 132 252 / .4)',
      },
    },
  },
  plugins: [],
};
