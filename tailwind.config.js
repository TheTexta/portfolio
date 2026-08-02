const alphaColor = (name) => `rgb(var(${name}) / <alpha-value>)`;
const solidColor = (name) => `rgb(var(${name}))`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: alphaColor("--color-canvas"),
        surface: alphaColor("--color-surface"),
        ink: alphaColor("--color-ink"),
        muted: alphaColor("--color-muted"),
        rule: solidColor("--color-rule"),
        danger: alphaColor("--color-danger"),
        warning: alphaColor("--color-warning"),
        success: alphaColor("--color-success"),
      },
    },
  },
};
