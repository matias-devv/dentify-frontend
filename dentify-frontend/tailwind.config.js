/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "inverse-on-surface": "#f3f0f2",
        "secondary-container": "#5498ff",
        "error-container": "#ffdad6",
        "surface-dim": "#dcd9db",
        "on-primary-container": "#79849b",
        "on-secondary-fixed": "#001b3e",
        "on-tertiary-container": "#2e89d1",
        "surface-variant": "#e4e2e3",
        "secondary": "#005db9",
        "on-primary": "#ffffff",
        "error": "#ba1a1a",
        "background": "#fbf8fa",
        "surface-container": "#f0edef",
        "on-secondary-container": "#003065",
        "secondary-fixed": "#d6e3ff",
        "surface-container-highest": "#e4e2e3",
        "on-secondary": "#ffffff",
        "on-tertiary-fixed": "#001d34",
        "tertiary-fixed-dim": "#9acbff",
        "surface-tint": "#535f74",
        "outline": "#75777d",
        "primary-container": "#101c2e",
        "on-secondary-fixed-variant": "#00458d",
        "on-error-container": "#93000a",
        "on-primary-fixed": "#101c2e",
        "on-primary-fixed-variant": "#3c475b",
        "inverse-primary": "#bbc7df",
        "primary": "#000000",
        "on-error": "#ffffff",
        "primary-fixed-dim": "#bbc7df",
        "surface-container-low": "#f5f3f5",
        "inverse-surface": "#303032",
        "on-tertiary-fixed-variant": "#004a79",
        "tertiary": "#000000",
        "surface-bright": "#fbf8fa",
        "tertiary-container": "#001d34",
        "surface": "#fbf8fa",
        "secondary-fixed-dim": "#aac7ff",
        "tertiary-fixed": "#d0e4ff",
        "surface-container-high": "#eae7e9",
        "on-tertiary": "#ffffff",
        "on-surface": "#1b1b1d",
        "outline-variant": "#c5c6cd",
        "surface-container-lowest": "#ffffff",
        "on-background": "#1b1b1d",
        "on-surface-variant": "#45474c",
        "primary-fixed": "#d7e3fc"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      },
      spacing: {
        "stack-sm": "8px",
        "sidebar-width": "240px",
        "margin-page": "40px",
        "container-max": "1440px",
        "gutter": "24px",
        "stack-md": "16px",
        "stack-lg": "32px"
      },
      fontFamily: {
        "headline-md": ["Playfair Display", "serif"],
        "headline-lg": ["Playfair Display", "serif"],
        "data-mono": ["DM Sans", "sans-serif"],
        "body-md": ["DM Sans", "sans-serif"],
        "label-eyebrow": ["DM Sans", "sans-serif"],
        "body-sm": ["DM Sans", "sans-serif"],
        "headline-sm": ["Playfair Display", "serif"],
        "body-lg": ["DM Sans", "sans-serif"],
        "display-lg": ["Playfair Display", "serif"],
        "headline-lg-mobile": ["Playfair Display", "serif"]
      },
      fontSize: {
        "headline-md": [
          "24px",
          {
            lineHeight: "1.3",
            fontWeight: "600"
          }
        ],
        "headline-lg": [
          "32px",
          {
            lineHeight: "1.2",
            fontWeight: "600"
          }
        ],
        "data-mono": [
          "14px",
          {
            lineHeight: "1",
            letterSpacing: "-0.01em",
            fontWeight: "500"
          }
        ],
        "body-md": [
          "14px",
          {
            lineHeight: "1.5",
            fontWeight: "400"
          }
        ],
        "label-eyebrow": [
          "10px",
          {
            lineHeight: "1",
            letterSpacing: "3px",
            fontWeight: "700"
          }
        ],
        "body-sm": [
          "13px",
          {
            lineHeight: "1.5",
            fontWeight: "400"
          }
        ],
        "headline-sm": [
          "20px",
          {
            lineHeight: "1.4",
            fontWeight: "500"
          }
        ],
        "body-lg": [
          "16px",
          {
            lineHeight: "1.6",
            fontWeight: "400"
          }
        ],
        "display-lg": [
          "48px",
          {
            lineHeight: "1.1",
            letterSpacing: "-0.02em",
            fontWeight: "700"
          }
        ],
        "headline-lg-mobile": [
          "28px",
          {
            lineHeight: "1.2",
            fontWeight: "600"
          }
        ]
      }
    }
  },
  plugins: [],
}
