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
        cssConfigPath: "./app/globals.css",
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
  {
    files: [
      "app/admin/photo-graph/upload/upload-client.tsx",
      "app/components/projects/photo-graph/PhotoGraphInspectOverlay.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["app/components/projects/photo-graph/usePhotoGraphImages.ts"],
    rules: {
      "react-hooks/immutability": "off",
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
