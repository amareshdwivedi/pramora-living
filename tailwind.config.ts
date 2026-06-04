import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50:  '#FDFBF7',
          100: '#FAF7F0',
          200: '#F4EDD8',
          300: '#EAD9B8',
        },
        gold: {
          300: '#E8C46A',
          400: '#D4A843',
          500: '#C4962A',
          600: '#A67C22',
          700: '#8B6914',
        },
        bark: {
          50:  '#F5EDE4',
          100: '#E8D5C4',
          200: '#C4A882',
          300: '#A07850',
          400: '#6B5744',
          500: '#4A3728',
          600: '#2C1810',
          700: '#1A0E08',
        },
        charcoal: {
          800: '#1A1410',
          900: '#120E0A',
          950: '#0A0806',
        }
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
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
