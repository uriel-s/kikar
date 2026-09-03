module.exports = {
  testEnvironment: "node",
  collectCoverageFrom: ["src/**/*.ts", "!src/server.ts"],

  // `.ts` only. src/ and the suite are both TypeScript now, and the one
  // JavaScript file left under apps/server — tests/startup.smoke.js — is not a
  // jest test at all; it runs under plain node. The `.js` half was migration
  // scaffolding and would now match nothing. The danger this pattern guards
  // against runs the other way: a suite that is not found is a suite that
  // passes.
  testMatch: ["**/tests/**/*.test.ts"],

  // dist/ is a compiled copy of src/, so every module in it has a twin. Without
  // this, jest's module map reports a "Haste module naming collision" between
  // the two copies of the generated Prisma client's package.json on every run.
  // Nothing under tests/ loads dist/ — the smoke check does, and it runs under
  // plain node.
  modulePathIgnorePatterns: ["<rootDir>/dist/"],

  transform: {
    // tsconfig.jest.json, not the root tsconfig.json directly — it extends
    // that file (same include/exclude, so the suite is still the same
    // program `checks.sh types` checks) but turns isolatedModules back off.
    //
    // Why that override exists at all: ts-jest reads `isolatedModules: true`
    // from whatever tsconfig it is pointed at as a signal to switch into its
    // own deprecated transpile-only mode, which skips type-checking outright
    // rather than merely enforcing the compiler flag's usual meaning. The
    // root tsconfig.json needs isolatedModules on for tsc's own program-wide
    // check; ts-jest needs it off to actually type-check at all. Confirmed
    // both ways: with it on, ts-jest ran a suite containing a real type error
    // and reported all tests passing; with it off, the same error failed the
    // run. `diagnostics.ignoreCodes` mutes the one warning ts-jest prints in
    // that mode (TS151002, "you may want isolatedModules") that the flag was
    // otherwise being used to silence — see tsconfig.jest.json's comment.
    //
    // The emit is `node16` CommonJS, which is what lets jest load the result
    // without --experimental-vm-modules. Stage 9 of REFACTOR-PLAN.md replaces
    // this runner with Vitest, and the emit format changes with it.
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.jest.json",
        diagnostics: { ignoreCodes: [151002] },
      },
    ],
    // Kept after the suite's conversion, and not leftover scaffolding: the
    // controllers import the generated Prisma client for its error classes, and
    // that client is JavaScript living under src/ rather than in node_modules,
    // so transformIgnorePatterns does not cover it. Naming any transform
    // replaces jest's default map wholesale, so this half has to be restated or
    // it would silently stop being transformed at all.
    "^.+\\.js$": "babel-jest",
  },
};
