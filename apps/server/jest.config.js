module.exports = {
  testEnvironment: "node",
  collectCoverageFrom: ["src/**/*.{js,ts}", "!src/server.js", "!src/server.ts"],

  // Both extensions, because the server converts a layer at a time: src/ is
  // TypeScript before tests/ is, and the last stage of the migration renames
  // these files one by one. A pattern matching only `.test.js` would stop
  // finding a suite the moment it was converted — and a suite that is not
  // found is a suite that passes.
  testMatch: ["**/tests/**/*.test.{js,ts}"],

  // dist/ is a compiled copy of src/, so every module in it has a twin. Without
  // this, jest's module map reports a "Haste module naming collision" between
  // the two copies of the generated Prisma client's package.json on every run.
  // Nothing under tests/ loads dist/ — the smoke check does, and it runs under
  // plain node.
  modulePathIgnorePatterns: ["<rootDir>/dist/"],

  transform: {
    // The ROOT tsconfig, not apps/server/tsconfig.json. That one builds src/
    // and deliberately keeps the jest globals out of `types`; this is the
    // config that covers tests/ as well, so ts-jest and `checks.sh types`
    // check the suite against exactly the same options and cannot disagree
    // about it. Its `noEmit` does not apply — ts-jest overrides that, which is
    // also why that file has to name a `rootDir`.
    //
    // The emit is `node16` CommonJS, which is what lets jest load the result
    // without --experimental-vm-modules. Stage 9 of REFACTOR-PLAN.md replaces
    // this runner with Vitest, and the emit format changes with it.
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/../../tsconfig.json" }],
    // Naming any transform replaces jest's default map wholesale, so the
    // JavaScript half has to be restated or it would silently stop being
    // transformed at all.
    "^.+\\.js$": "babel-jest",
  },
};
