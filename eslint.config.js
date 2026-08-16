// ESLint flat configuration.
//
// ESLint 9 replaced the cascading `.eslintrc` files with a single exported
// array: each entry applies to the files its `files` glob matches, and later
// entries override earlier ones. There is no directory-based inheritance any
// more, so both workspaces are configured here rather than in their own files.
//
// The two workspaces need genuinely different settings — the server is
// CommonJS running on Node, the client is ES modules running in a browser — so
// they get one block each rather than a shared base with exceptions.

const js = require("@eslint/js");
const globals = require("globals");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const prettier = require("eslint-config-prettier");

module.exports = [
  {
    ignores: [
      "**/node_modules/**",
      "**/build/**",
      "**/dist/**",
      "**/coverage/**",
      // Prisma generates this on every `db:generate`; it is gitignored and not
      // ours to lint.
      "apps/server/src/generated/**",
    ],
  },

  js.configs.recommended,

  // Repository tooling: config files at the root and in each workspace.
  {
    files: ["*.js", "apps/*/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      globals: globals.node,
    },
  },

  // Server — CommonJS on Node.
  {
    files: ["apps/server/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      // Unused function arguments are meaningful here: Express identifies an
      // error handler by its arity, so `(err, req, res, next)` must keep the
      // fourth parameter whether or not the body calls it. Leading-underscore
      // names are the convention this codebase already uses for that.
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "all" },
      ],
    },
  },

  // Server tests — same as the server, plus the Jest globals.
  {
    files: ["apps/server/tests/**/*.js"],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },

  // Client — ES modules with JSX, in a browser.
  {
    files: ["apps/client/src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.browser,
        // Create React App substitutes `process.env.REACT_APP_*` at build time
        // through webpack, so the identifier is real here even though the code
        // runs in a browser. Vite replaces this with `import.meta.env`, at which
        // point this line goes away.
        process: "readonly",
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // The codebase uses no prop-types and is scheduled to move to TypeScript,
      // which is what will actually type these props. Turning the rule on now
      // would mean annotating 21 components twice.
      "react/prop-types": "off",

      // Fires on PostsPage and AllUsers, which fetch in an effect and then set
      // state. The rule is right, and the fix is not a local edit: those effects
      // are replaced wholesale by TanStack Query. Kept visible as a warning so
      // it is not silently lost, rather than errored on now and patched with
      // disable comments that would then have to be removed again.
      "react-hooks/set-state-in-effect": "warn",

      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "all" },
      ],
    },
  },

  // Last, so it wins: switches off every rule that would fight Prettier over
  // formatting. Prettier owns layout; ESLint owns correctness.
  prettier,
];
