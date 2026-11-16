/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F0F5FA',
          100: '#E1EBF5',
          200: '#C3D7EB',
          300: '#94BBE0',
          400: '#5C98CF',
          500: '#357CBE',
          600: '#16345C',
          700: '#0F233E',
          800: '#0B1A2E',
          900: '#060E1A',
          DEFAULT: '#16345C',
        },
        navy: {
          DEFAULT: '#16345C',
          dark: '#0F233E',
          light: '#1F477D',
        },
        blue: {
          corporate: '#245A8D',
        },
        teal: {
          accent: '#1B998B',
          light: '#E6F6F4',
        },
        surface: {
          bg: '#F4F7FB',
          card: '#FFFFFF',
          sidebar: '#0F233E',
        },
        text: {
          main: '#1F2937',
          secondary: '#64748B',
          muted: '#94A3B8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
