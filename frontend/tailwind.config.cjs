// frontend/tailwind.config.cjs
module.exports = {
  // ... darkMode, content ...
  theme: {
    extend: {
      boxShadow: { // Keep existing extends if any
        'glow-dark': '0 0 15px rgba(255 255 255 / .5)',
        'glow-light': '0 0 15px rgba(192 132 252 / .4)',
      },
      // REMOVED animation and keyframes for 'gradient-sweep'
    },
  },
  plugins: [],
};