import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Jest config uses CommonJS
    "jest.config.cjs",
  ]),
  // Custom rules
  {
    rules: {
      // Allow underscore-prefixed unused vars (intentional ignores)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Disable set-state-in-effect: we have legitimate patterns for:
      // - Syncing form state from server data (settings/page.tsx)
      // - Initializing dialog form state (edit-collection-dialog.tsx)
      // - Handling URL params to expand/scroll to chunks (documents/[id]/page.tsx)
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
