import js from "@eslint/js"
import jsxA11y from "eslint-plugin-jsx-a11y"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import { defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"
import tseslint from "typescript-eslint"

// Project rules that a reviewer would otherwise repeat in every review. Each message says what to do instead.
const projectRules = {
  "no-restricted-syntax": [
    "error",
    {
      selector: "JSXText[value=/\\p{L}/u]",
      message:
        "UI text comes from the catalogs: `const t = useT()` and `{t.area.key}` (src/i18n).",
    },
    {
      selector:
        "JSXAttribute[name.name=/^(placeholder|title|alt|aria-label|label)$/] > Literal[value=/\\p{L}/u]",
      message: "UI text comes from the catalogs (src/i18n), attributes too.",
    },
    {
      selector:
        "JSXOpeningElement[name.name='Button'] > JSXAttribute[name.name='render'] JSXOpeningElement[name.name='Link']",
      message:
        "A link that looks like a button is `<Link className={buttonVariants({...})}>`: Base UI's Button gives it role=button, and screen readers then announce a navigation as a button.",
    },
    ...[
      "CallExpression[callee.name=/^(Number|parseFloat|parseInt)$/]",
      "CallExpression[callee.object.name='Number'][callee.property.name=/^(parseFloat|parseInt)$/]",
      "UnaryExpression[operator='+']",
    ].map((selector) => ({
      selector,
      message:
        "Money, quantities and prices are exact decimal strings from the API; never turn them into JS numbers. Format with `formatDecimal` (src/lib/decimal.ts). For a value that is not money, disable this line with a reason.",
    })),
  ],
  "no-restricted-globals": [
    "error",
    {
      name: "fetch",
      message:
        "Call the API through `api` (src/api/client.ts): typed paths, problem errors, one place for 401.",
    },
  ],
  "no-restricted-imports": [
    "error",
    {
      paths: [
        {
          name: "@tanstack/react-virtual",
          message:
            "Lists and tables use the shared DataTable (src/components/data-table).",
        },
      ],
    },
  ],
}

export default defineConfig([
  globalIgnores([
    ".claude",
    "dist",
    "coverage",
    "playwright-report",
    "test-results",
    "src/routeTree.gen.ts",
    "src/api/schema.d.ts",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.strict,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TanStack Router route files export `Route` next to their components by design.
      "react-refresh/only-export-components": "off",
      // Template literals with numbers are fine (`${count} rows`); other types still need a conversion.
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
      // TanStack Router stops a navigation by throwing its redirect, a Response.
      "@typescript-eslint/only-throw-error": [
        "error",
        {
          allow: [
            {
              from: "package",
              package: "@tanstack/router-core",
              name: "Redirect",
            },
          ],
        },
      ],
      ...projectRules,
    },
  },
  {
    // shadcn/ui sources as the CLI adds them. Rules that flag only upstream style, or generic wrappers that cannot
    // know their control (a Label used with htmlFor), are off here, so `shadcn add` updates stay plain diffs.
    // Accessibility of what a page builds from them is still checked in the page.
    files: ["src/components/ui/**"],
    rules: {
      "jsx-a11y/label-has-associated-control": "off",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },
  {
    files: ["src/components/data-table/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Tests and browser checks state literal texts and numbers on purpose.
    files: ["**/*.test.{ts,tsx}", "e2e/**", "src/test/**"],
    rules: { "no-restricted-syntax": "off", "no-restricted-globals": "off" },
  },
  {
    files: ["*.config.{js,ts}", "scripts/**"],
    languageOptions: { globals: globals.node },
  },
])
