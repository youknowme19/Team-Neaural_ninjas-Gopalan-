/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgba(18, 18, 22, 0.75)',
        surface: 'rgba(255, 255, 255, 0.05)',
      }
    },
  },
  plugins: [],
}
