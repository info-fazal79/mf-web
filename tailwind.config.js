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
        dark: {
          950: '#0D0F12', // Ultra dark background
          900: '#161920', // Card surface
          800: '#1F242D', // Elevated / border
          700: '#2A303C', // Hover state
          600: '#3D4655', // Muted text/border
        },
        cyber: {
          neon: '#00FF87',
          accent: '#00E599',
          glow: 'rgba(0, 229, 153, 0.35)',
          dim: 'rgba(0, 229, 153, 0.1)',
          emerald: '#10B981',
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'Inter', 'Outfit', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'neon-sm': '0 0 10px rgba(0, 229, 153, 0.25)',
        'neon': '0 0 20px rgba(0, 229, 153, 0.35)',
        'neon-lg': '0 0 35px rgba(0, 229, 153, 0.5)',
        'cyber-card': '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2.5s infinite ease-in-out',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(0, 229, 153, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(0, 229, 153, 0.5)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
};
