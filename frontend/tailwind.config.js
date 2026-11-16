/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta base oscura configurada con #151515 como base absoluta
        slate: {
          950: '#151515', // Base background oscuro
          900: '#1c1c1c', // Superficie / Tarjetas / Header oscuro
          800: '#262626', // Superficie secundaria / Inputs / Controles
          700: '#333333', // Bordes oscuros
        },
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#e2e8f0', // En dark reemplaza verdes tenues por gris perla de alto contraste
          300: '#f8fafc', // En dark títulos y textos de máximo contraste y nitidez (WCAG AAA)
          400: '#cbd5e1',
          500: '#14b8a6',
          700: '#0f766e',
          800: '#115e59',
          900: '#0f5c4d', // Teal corporativo de referencia en light mode
          950: '#1e2925',
        },
      },
    },
  },
  plugins: [],
}
