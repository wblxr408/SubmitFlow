import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends(
    "next/core-web-vitals",
    "next/typescript",
    "prettier"
  ),
  {
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",

      // React rules
      "react/no-unknown-property": ["error", {
        ignoreProperties: ["jsx", "global"],
      }],
      "react/jsx-key": "error",

      // Import rules
      "import/order": ["error", {
        groups: [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index",
        ],
        "newlines-between": "always",
        alphabetize: {
          order: "asc",
          caseInsensitive: true,
        },
      }],
      "import/no-unresolved": "off",

      // Next.js specific
      "@next/next/no-img-element": "warn",

      // Disable rules that conflict with Prettier
      "indent": "off",
      "linebreak-style": "off",
      "quotes": "off",
      "semi": "off",
      "no-trailing-spaces": "off",
      "eol-last": "off",
      "max-len": "off",
      "comma-dangle": "off",
      "object-curly-spacing": "off",
      "array-bracket-spacing": "off",
      "arrow-parens": "off",
      "react/jsx-wrap-multilines": "off",
      "function-paren-newline": "off",
      "implicit-arrow-linebreak": "off",
    },
  },
  {
    // Test files
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
    },
  },
  {
    // Ignore patterns
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "*.config.js",
      "scripts/**",
      "public/**",
    ],
  },
];

export default eslintConfig;
