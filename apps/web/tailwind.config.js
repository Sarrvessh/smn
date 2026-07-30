/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f6f1e8',
          100: '#ede6da',
          200: '#d9cfc0',
          300: '#b8a992',
          400: '#8f7d68',
          500: '#6b5a48',
          600: '#4a3f34',
          700: '#352d25',
          800: '#221c17',
          900: '#14110e',
        },
        slate: {
          mist: '#e8eef2',
          soft: '#d4dde4',
        },
        accent: {
          DEFAULT: '#2d6a7a',
          hover: '#245662',
          light: '#e3f0f3',
        },
      },
      backgroundImage: {
        workspace: 'linear-gradient(135deg, #f6f1e8 0%, #e8eef2 100%)',
      },
    },
  },
  plugins: [],
};
