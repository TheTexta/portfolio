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
        "overlay-border-strong": solidColor("--color-overlay-border-strong"),
        "overlay-fill": solidColor("--color-overlay-fill"),
        "overlay-fill-soft": solidColor("--color-overlay-fill-soft"),
        "overlay-fill-strong": solidColor("--color-overlay-fill-strong"),
        "overlay-panel": solidColor("--color-overlay-panel"),
        "overlay-panel-strong": solidColor("--color-overlay-panel-strong"),
        "overlay-button": solidColor("--color-overlay-button"),
        "overlay-button-hover": solidColor("--color-overlay-button-hover"),
        "overlay-button-strong": solidColor("--color-overlay-button-strong"),
        "overlay-button-strong-hover": solidColor(
          "--color-overlay-button-strong-hover",
        ),
        "overlay-control": solidColor("--color-overlay-control"),
        "overlay-control-hover": solidColor("--color-overlay-control-hover"),
        "overlay-control-active": solidColor("--color-overlay-control-active"),
        "overlay-item": solidColor("--color-overlay-item"),
        "overlay-item-strong": solidColor("--color-overlay-item-strong"),
        "overlay-modal": solidColor("--color-overlay-modal"),
        "overlay-chip": solidColor("--color-overlay-chip"),
        "overlay-rule": solidColor("--color-overlay-rule"),
      },
    },
  },
};
