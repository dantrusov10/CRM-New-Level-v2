/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        'card': '12px'
      },
      colors: {
        // NewLevel CRM — Dark Enterprise (ref-style)
        bg: '#060F21',
        card: '#0B1B35',
        border: '#1F3356',
        borderHover: '#2B4470',
        text: '#EAF2FF',
        text2: '#A8B3C7',
        primary: '#57B7FF',
        primaryHover: '#2C9EFF',
        primaryDisabled: '#22415F',
        danger: '#EF5350',
        dangerBg: '#2A0F16',
        infoBg: '#0B2036',
        infoBorder: '#244C7A',
        rowHover: '#0E2440',
        rowSelected: '#123A66',
        tableHeader: '#0A1A33'
      }
    }
  },
  plugins: []
}
