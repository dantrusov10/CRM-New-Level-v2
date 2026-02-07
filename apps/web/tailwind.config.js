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
