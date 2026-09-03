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
const jsxA11y = require("eslint-plugin-jsx-a11y");
const prettier = require("eslint-config-prettier");
const tseslint = require("typescript-eslint");

module.exports = [
  {
    ignores: [
      "**/node_modules/**",
      "**/build/**",
      "**/dist/**",
      "**/coverage/**",
      // git worktrees live here. Each one is a full checkout of this same
      // repository, so without this every file is linted twice and the warning
      // count pinned in checks.sh doubles for a reason that has nothing to do
      // with the code.
      "**/.claude/worktrees/**",
      // Prisma generates this on every `db:generate`; it is gitignored and not
      // ours to lint.
      "apps/server/src/generated/**",
    ],
  },

  js.configs.recommended,

  // Repository tooling: config files at the root and in each workspace.
  // `api/**/*.js` is kept deliberately — api/ holds only index.mjs today, but a
  // CommonJS helper added there should get Node globals rather than none.
  {
    files: ["*.js", "apps/*/*.js", "api/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      globals: globals.node,
    },
  },

  // The Vercel entry point, which sits at the repository root because that is
  // where the platform looks for functions. It is ESM on purpose: a CommonJS
  // entry is loaded through Vercel's own loader, which cannot require() an ES
  // module, and firebase-admin's dependency chain reaches one. See the header
  // of api/index.mjs.
  {
    files: ["api/**/*.mjs", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
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

  // Server TypeScript. Wired up with the toolchain rather than with the first
  // .ts file, because ESLint 9 does not lint TypeScript at all without a
  // parser — `eslint .` would simply stop seeing the server as it converts, and
  // this gate would go greener each stage by looking at less code.
  //
  // Deliberately the plain preset and not the type-aware one: that variant
  // loads the whole program on every lint run, and `checks.sh types` already
  // runs tsc. One tool owns types.
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["apps/server/**/*.ts"],
  })),
  {
    files: ["apps/server/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2024,
      // ESM syntax on the way in; tsc emits CommonJS. See tsconfig.base.json.
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      // The TypeScript rule replaces the core one, so the exception has to be
      // restated: Express identifies an error handler by its arity, and
      // `(err, req, res, next)` keeps its fourth parameter whether the body
      // uses it or not.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "all" },
      ],
    },
  },

  // Server tests — same as the server, plus the Jest globals. Both extensions,
  // because the suite converts to TypeScript one file at a time.
  {
    files: ["apps/server/tests/**/*.{js,ts}"],
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
      // No `process` global. Under CRA it had to be declared, because webpack
      // substituted `process.env.REACT_APP_*` at build time and the identifier
      // was genuinely real. Vite uses `import.meta.env` instead, so declaring it
      // now would only hide a leftover `process.env` from no-undef — and a
      // leftover is exactly what would be silently undefined in the browser.
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // Accessibility. These were already enforced before this config existed —
      // Create React App's `eslintConfig: { extends: ["react-app"] }` pulled them
      // in, and CI=true made the build fail on them. Dropping that block without
      // reinstating these here would have quietly ended a11y linting: a form
      // control with no associated label would start passing review.
      ...jsxA11y.flatConfigs.recommended.rules,

      // Both fire on the same node: Navbar's hamburger is a `<div onClick>`.
      // The correct fix is a real `<button>`, and that is a behaviour change —
      // keyboard focus and activation where there is none today — which this
      // stage promised not to make, with no client tests to catch a regression.
      // Stage 7 rewrites all 21 components; that is where it becomes a button.
      // Left as warnings rather than disable comments because the warning count
      // is pinned in checks.sh: a second `<div onClick>` anywhere pushes the
      // total past the pin and fails the gate, so this cannot quietly spread.
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",

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
