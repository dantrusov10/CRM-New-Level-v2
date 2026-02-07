/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        'card': '12px'
      },
      colors: {
        // App background (Design System v1.1)
        bg: '#E9EEF8',
        card: 'rgba(255,255,255,0.86)',
        border: 'rgba(17,24,39,0.12)',
        borderHover: '#9CA3AF',
        text: '#0B1220',
        text2: '#5B6B86',
        primary: '#60A5FA',
        primaryHover: '#3B82F6',
        primaryDisabled: 'rgba(96,165,250,0.35)',
        danger: '#DC2626',
        dangerBg: '#FEF2F2',
        infoBg: '#EEF4FF',
        infoBorder: '#B6CCFF',
        rowHover: 'rgba(255,255,255,0.06)',
        rowSelected: 'rgba(96,165,250,0.12)',
        tableHeader: 'rgba(255,255,255,0.08)'
      }
    }
  },
  plugins: []
}
