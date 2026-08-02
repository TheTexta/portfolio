import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tailwindcss from "eslint-plugin-tailwindcss";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      tailwindcss,
    },
    settings: {
      tailwindcss: {
        callees: ["cn", "cva", "clsx"],
        config: {},
      },
    },
    rules: {
      "tailwindcss/classnames-order": "warn",
      "tailwindcss/enforces-shorthand": "warn",
      "tailwindcss/migration-from-tailwind-2": "off",
      "tailwindcss/no-contradicting-classname": "warn",
      "tailwindcss/no-custom-classname": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    ".agents/docs/**",
    ".tmp/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
