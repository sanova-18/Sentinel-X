/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        industrial: {
          950: '#060B14',
          900: '#0B1120',
          800: '#0F172A',
          700: '#1E293B',
          600: '#334155',
          500: '#475569',
          teal: {
            400: '#2DD4BF',
            500: '#14B8A6',
            600: '#0D9488',
          },
          alert: {
            red: '#EF4444',
            orange: '#F97316',
            yellow: '#EAB308',
            green: '#10B981',
          }
        }
      }
    },
  },
  plugins: [],
};
