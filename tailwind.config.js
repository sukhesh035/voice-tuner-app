/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './apps/mobile-app/src/**/*.{html,ts}',
    './libs/**/*.{html,ts}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        swara: {
          primary:    '#7C4DFF',
          secondary:  '#00E5C2',
          accent:     '#FF6B35',
          bg:         '#0A0A1B',
          surface:    '#12122A',
          text:       '#E8E4FF',
          muted:      '#8B85A8',
          success:    '#4CAF50',
          warning:    '#FFC107',
          error:      '#F44336',
        },
        raga: {
          yaman:      '#7C4DFF',
          bhairav:    '#FF6B35',
          kalyani:    '#00E5C2',
          hamsadhwani:'#FFD700',
          todi:       '#FF4081',
          bihag:      '#64B5F6',
          bhimpalasi: '#81C784',
        },
      },
      fontFamily: {
        display: ['Inter var', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'swara': '1.25rem',
        'swara-sm': '0.75rem',
        'swara-lg': '2rem',
      },
      boxShadow: {
        'glow':    '0 0 20px rgba(124,77,255,0.4), 0 0 60px rgba(124,77,255,0.1)',
        'glow-sm': '0 0 10px rgba(124,77,255,0.3)',
        'glass':   '0 8px 32px rgba(0,0,0,0.4)',
      },
      backdropBlur: {
        'swara': '20px',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'pitch-ring': 'pitch-ring 1s ease-out infinite',
        'float-up':   'float-up 3s ease-in-out infinite',
        'waveform':   'wave 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
