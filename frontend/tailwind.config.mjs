/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          500: '#3b5fe0',
          600: '#2f4bc4',
          700: '#263ca0',
          900: '#1b2a70',
        },
      },
    },
  },
  plugins: [],
};
