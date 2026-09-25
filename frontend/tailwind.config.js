/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F7F8F4",
        ink: "#14231C",
        moss: "#2F6B4F",
        sage: "#8B9A8C",
        amber: "#E2A73E",
        line: "#D8DED4",
        slate: "#3D4A40",
      },
    },
  },
  plugins: [],
};
