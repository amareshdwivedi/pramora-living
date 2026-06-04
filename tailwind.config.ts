import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: {
          50:  '#FDFCFB',
          100: '#FAF8F5',
          200: '#F5F0EA',
          300: '#EDE5D8',
          400: '#DDD0BC',
        },
        stone: {
          750: '#44403C',
          850: '#292524',
          950: '#0C0A09',
        },
        craft: {
          bg:      '#FAF8F5',
          'bg-2':  '#F3EDE4',
          text:    '#1C1916',
          'text-2':'#6B6560',
          border:  '#E2D9CC',
          accent:  '#1C1916',
        }
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans:  ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        widest2: '0.25em',
      },
      maxWidth: {
        '8xl': '88rem',
      },
    },
  },
  plugins: [],
}
export default config
