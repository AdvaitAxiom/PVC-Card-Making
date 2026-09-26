import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e5ff",
          200: "#bcd1ff",
          300: "#8eb3ff",
          400: "#5a8bff",
          500: "#3462f6",
          600: "#2148db",
          700: "#1b39b0",
          800: "#1b328c",
          900: "#1c2f6f",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
