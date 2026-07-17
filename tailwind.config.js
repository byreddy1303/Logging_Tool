/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0a0a',
          raised: '#141414',
          overlay: '#1c1c1c'
        },
        border: {
          DEFAULT: '#252525',
          hover: '#333333'
        },
        text: {
          DEFAULT: '#e8e8e8',
          muted: '#8a8a8a',
          faint: '#5a5a5a'
        },
        accent: {
          DEFAULT: '#d97706',
          hover: '#f59e0b',
          faint: '#78350f'
        },
        success: '#16a34a',
        danger: '#dc2626',
        warn: '#ca8a04'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      },
      borderRadius: {
        none: '0',
        sm: '4px',
        DEFAULT: '8px',
        full: '9999px'
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        6: '24px',
        8: '32px',
        12: '48px',
        16: '64px'
      },
      transitionDuration: { DEFAULT: '150ms' }
    }
  },
  plugins: []
};
