/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./popup.html",
    "./src/popup/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hubspot: {
          orange: '#ff7a59',
          dark: '#2d3e50',
          blue: '#00a4bd',
        }
      }
    },
  },
  plugins: [],
}
