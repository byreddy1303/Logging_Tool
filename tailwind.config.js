/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#faf6ec',
          raised: '#ffffff',
          overlay: '#f2ecdd'
        },
        border: {
          DEFAULT: '#e8e0cc',
          hover: '#d6caad'
        },
        text: {
          DEFAULT: '#241e35',
          muted: '#665d7e',
          faint: '#9c94af'
        },
        accent: {
          DEFAULT: '#e14b32',
          hover: '#c73d26',
          faint: '#fbe7e2'
        },
        success: { DEFAULT: '#278c52', faint: '#e3f2e9' },
        danger: { DEFAULT: '#b3273e', faint: '#f8e4e8' },
        warn: { DEFAULT: '#c98a04', faint: '#faf0d8' },
        guess: { DEFAULT: '#7048b6', faint: '#eee7f9' },
        highlight: '#ffde59',
        ink: {
          cobalt: '#2e5eaa',
          teal: '#0e8a74',
          violet: '#7048b6',
          rose: '#c2366b',
          marigold: '#c98a04',
          slate: '#52627a'
        }
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Schibsted Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"Azeret Mono"', 'ui-monospace', 'monospace']
      },
      borderRadius: {
        none: '0',
        sm: '6px',
        DEFAULT: '10px',
        lg: '16px',
        full: '9999px'
      },
      boxShadow: {
        sm: '0 1px 2px rgba(36, 30, 53, 0.05)',
        card: '0 1px 2px rgba(36, 30, 53, 0.04), 0 3px 10px rgba(36, 30, 53, 0.07)',
        lift: '0 2px 4px rgba(36, 30, 53, 0.05), 0 10px 24px rgba(36, 30, 53, 0.10)',
        press: 'inset 0 1px 2px rgba(36, 30, 53, 0.08)'
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
