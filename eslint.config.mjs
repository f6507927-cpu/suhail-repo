import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import formatting from "./scripts/eslint-formatting.mjs";

const jobsRestriction = {
  group: ["@/jobs", "@/jobs/**", "**/jobs", "**/jobs/**"],
  message: "Job entry points may only be imported by jobs and admin code.",
};

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      ".local/**",
      ".agents/**",
      "attached_assets/**",
      "coverage/**",
      "dist/**",
      "playwright-report/**",
      "test-results/**",
      "generated-artifacts/**",
    ],
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    ignores: ["src/jobs/**", "src/app/\\[locale\\]/\\(private\\)/admin/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [jobsRestriction],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: ["src/lib/format.ts"],
    plugins: { formatting },
    rules: { "formatting/shared": "error" },
  },
  {
    files: ["src/engine/**/*.ts"],
    ignores: ["src/engine/**/*.test.ts", "src/engine/__fixtures__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex: "^(?!node:crypto$|zod$|\\.)", message: "The pure engine only imports local modules, Zod and node:crypto." },
            { group: ["**/db/**", "**/jobs/**", "**/env/**", "**/__fixtures__/**", "**/*.test"], message: "No application, environment or test coupling in the pure engine." },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message: "Pass asOf explicitly; the engine never reads the current time." },
        { selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']", message: "No randomness in the deterministic engine." },
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: "Date construction needs a supplied date." },
        { selector: "CallExpression[callee.name='Date']", message: "Do not read the current time through Date()." },
        { selector: "Identifier[name=/^(fetch|process|setTimeout|setInterval|performance)$/]", message: "No IO, environment, clocks or scheduling in the pure engine." },
        { selector: "ImportDeclaration[source.value='node:crypto'] ImportSpecifier[imported.name!='createHash']", message: "node:crypto is allowed only for SHA-256." },
        { selector: "CallExpression[callee.name='createHash'] > Literal.arguments[value!='sha256']", message: "Only SHA-256 is permitted." },
      ],
    },
  },
  {
    files: ["src/app/\\[locale\\]/\\(public\\)/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            jobsRestriction,
            {
              group: ["@/db/app", "@/db/app/**", "**/db/app", "**/db/app/**"],
              message: "Public routes must not import the app database client.",
            },
          ],
        },
      ],
    },
  },
];

export default config;
