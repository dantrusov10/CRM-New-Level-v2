/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      backgroundImage: {
        'nwl-cockpit': "linear-gradient(135deg, #1E3A8A 0%, #0E7490 45%, #111827 110%)",
      },
      borderRadius: {
        'card': '12px',
        'cockpit': '22px',
        'cockpit2': '18px'
      },
      colors: {
        cockpitTop: 'rgba(17,24,39,0.35)',
        cockpitStroke: 'rgba(255,255,255,0.14)',
        cockpitText: 'rgba(255,255,255,0.92)',
        cockpitText2: 'rgba(226,232,240,0.72)',
        
        // App background (Design System v1.1)
        bg: '#F4F6F9',
        card: '#FFFFFF',
        border: '#D1D5DB',
        borderHover: '#9CA3AF',
        text: '#111827',
        text2: '#6B7280',
        primary: '#004EEB',
        primaryHover: '#003FC4',
        primaryDisabled: '#C7D7FF',
        danger: '#DC2626',
        dangerBg: '#FEF2F2',
        infoBg: '#EEF4FF',
        infoBorder: '#B6CCFF',
        rowHover: '#F1F5F9',
        rowSelected: '#E1ECFF',
        tableHeader: '#EEF1F6'
      }
    }
  },
  plugins: []
}
