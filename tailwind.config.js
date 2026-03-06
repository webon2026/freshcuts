/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        black:    '#0a0a0a',
        dark:     '#111111',
        card:     '#1a1a1a',
        gold: {
          DEFAULT: '#C9A84C',
          light:   '#E8C97A',
          dim:     'rgba(201,168,76,0.15)',
        },
        cream:    '#F5F0E8',
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body:    ['var(--font-body)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
