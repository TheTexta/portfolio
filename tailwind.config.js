const alphaColor = (name) => `rgb(var(${name}) / <alpha-value>)`;
const solidColor = (name) => `rgb(var(${name}))`;


/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        accent: alphaColor("--color-accent"),
        canvas: alphaColor("--color-canvas"),
        ink: alphaColor("--color-ink"),
        "overlay-ink": alphaColor("--color-overlay-ink"),
        "overlay-border": solidColor("--color-overlay-border"),

        "overlay-fill": solidColor("--color-overlay-fill"),
        "overlay-fill-soft": solidColor("--color-overlay-fill-soft"),
        "overlay-panel": solidColor("--color-overlay-panel"),
        "overlay-button": solidColor("--color-overlay-button"),
        "overlay-button-hover": solidColor("--color-overlay-button-hover"),
        "overlay-control": solidColor("--color-overlay-control"),
        "overlay-control-hover": solidColor("--color-overlay-control-hover"),
        "overlay-control-active": solidColor("--color-overlay-control-active"),
        "overlay-item": solidColor("--color-overlay-item"),
        "overlay-item": solidColor("--color-overlay-item"),
        "overlay-rule": solidColor("--color-overlay-rule"),
      },
    },
  },
};
