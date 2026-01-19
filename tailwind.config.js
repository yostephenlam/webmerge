/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['Fira Code', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        diff: {
          added: {
            bg: '#1e3a1e',
            line: '#22863a',
            text: '#85e89d',
          },
          deleted: {
            bg: '#3d1f1f',
            line: '#cb2431',
            text: '#f97583',
          },
          modified: {
            bg: '#3d3d1f',
            line: '#b08800',
            text: '#ffea7f',
          },
          unchanged: {
            bg: '#1e1e1e',
            text: '#d4d4d4',
          }
        }
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
      }
    },
  },
  plugins: [],
}
