/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kakao: {
          yellow: '#FEE500',
          brown: '#3C1E1E',
          blue: '#5B9BD5',
          gray: '#B7B7B7',
        }
      }
    },
  },
  plugins: [],
}