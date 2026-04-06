/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      colors: {
        orange: {
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
        },
      },
      backgroundOpacity: {
        8: '0.08',
      },
    },
  },
  plugins: [],
}
