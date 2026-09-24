import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50:  '#FFFDF8',
          100: '#FAF7EF',
          200: '#F1E9DA',
          300: '#E6DCC9',
        },
        gold: {
          300: '#8BD3CA',
          400: '#43B9AD',
          500: '#087E78',
          600: '#076C67',
          700: '#075D59',
        },
        bark: {
          50:  '#F6F0E6',
          100: '#E9DDCA',
          200: '#C9B79F',
          300: '#A58C70',
          400: '#75685B',
          500: '#574536',
          600: '#30231B',
          700: '#211812',
        },
        charcoal: {
          800: '#20312D',
          900: '#172320',
          950: '#101916',
        }
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
        sans: ['Amazon Ember', 'Arial', 'Helvetica Neue', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
export default config
