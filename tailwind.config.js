/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#fffaf0',
          raised: '#fffefd',
          overlay: '#fff1d6'
        },
        border: {
          DEFAULT: '#ead8b6',
          hover: '#d9bd87'
        },
        text: {
          DEFAULT: '#241735',
          muted: '#675276',
          faint: '#9885a2'
        },
        accent: {
          DEFAULT: '#f04b2f',
          hover: '#d83b22',
          faint: '#ffe5dc'
        },
        success: { DEFAULT: '#168653', faint: '#ddf6e8' },
        danger: { DEFAULT: '#bd2844', faint: '#ffe1e7' },
        warn: { DEFAULT: '#b87800', faint: '#fff0c7' },
        guess: { DEFAULT: '#7048c4', faint: '#eee5ff' },
        highlight: '#ffe16a',
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
        card: '0 1px 2px rgba(66, 36, 12, 0.04), 0 6px 18px rgba(83, 49, 14, 0.07)',
        lift: '0 2px 4px rgba(66, 36, 12, 0.05), 0 14px 34px rgba(83, 49, 14, 0.12)',
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
