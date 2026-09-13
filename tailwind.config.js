/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0F1A30",
          900: "#14213D",
          800: "#1D2E52",
          700: "#3A4A63",
        },
        gold: {
          600: "#9A7423",
          500: "#B98B2A",
          400: "#D1A64C",
          100: "#F2E6C9",
        },
        paper: "#F5F3EE",
        ink: "#211F1C",
        confirmed: "#2F6F4E",
        rejected: "#8C2F2F",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "4px",
      },
    },
  },
  plugins: [],
};
