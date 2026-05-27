/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'aero-teal': '#0d9488',
        'warning-crimson': '#be123c',
        'audit-amber': '#fffbeb',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace'],
        pnr: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
