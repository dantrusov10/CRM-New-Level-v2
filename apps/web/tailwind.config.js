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
        // More насыщенная / неоновая палитра (как в референсах)
        bg: '#040B1A',
        card: '#071A33',
        border: '#244B86',
        borderHover: '#2F66B5',
        text: '#ECF4FF',
        text2: '#B1C2DA',

        // neon-blue / cyan
        primary: '#33D7FF',
        primaryHover: '#1BBEFF',
        primaryDisabled: '#163659',

        danger: '#FF5B6B',
        dangerBg: '#2A0E18',
        infoBg: '#071B33',
        infoBorder: '#2C6AB6',
        rowHover: '#092448',
        rowSelected: '#0F3A74',
        tableHeader: '#06162C'
      }
    }
  },
  plugins: []
}
