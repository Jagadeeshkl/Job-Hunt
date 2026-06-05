/** @type {import('tailwindcss').Config} */
const hsl = (v) => `hsl(var(--${v}) / <alpha-value>)`;

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: hsl('background'),
        foreground: hsl('foreground'),
        card: { DEFAULT: hsl('card'), foreground: hsl('card-foreground') },
        muted: { DEFAULT: hsl('muted'), foreground: hsl('muted-foreground') },
        primary: { DEFAULT: hsl('primary'), foreground: hsl('primary-foreground') },
        accent: { DEFAULT: hsl('accent'), foreground: hsl('accent-foreground') },
        success: hsl('success'),
        warning: hsl('warning'),
        danger: hsl('danger'),
        border: hsl('border'),
        input: hsl('input'),
        ring: hsl('ring'),
        sidebar: {
          DEFAULT: hsl('sidebar'),
          foreground: hsl('sidebar-foreground'),
          muted: hsl('sidebar-muted'),
          'active-bg': hsl('sidebar-active-bg'),
          'active-fg': hsl('sidebar-active-fg'),
          border: hsl('sidebar-border'),
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      boxShadow: {
        soft: '0 1px 2px hsl(222 40% 15% / 0.04), 0 1px 1px hsl(222 40% 15% / 0.03)',
        lift: '0 8px 30px hsl(222 40% 15% / 0.08)',
      },
    },
  },
  plugins: [],
};
