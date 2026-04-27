/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        secondary: '#6366f1',
        dark: '#1e293b',
        darker: '#0f172a'
      }
    },
  },
  plugins: [],
}