/**
 * Pre-commit pipeline: format and lint only the files being committed.
 *
 * `--no-error-on-unmatched-pattern` is required on both tools. lint-staged
 * hands over every staged path, including deleted files (which no longer
 * exist) and vendored files under src/components/ui (which both tools
 * ignore). Without it, prettier exits 2 on a deleted path and oxlint exits 1
 * when handed only ignored paths, failing an otherwise fine commit.
 *
 * `--deny-warnings` is what makes the hook actually enforce linting: oxlint
 * reports correctness rules like no-debugger as warnings and still exits 0.
 *
 * src/components/ui is skipped automatically — prettier honours
 * .prettierignore and oxlint honours ignorePatterns in .oxlintrc.json.
 */
export default {
  "*.{js,jsx,ts,tsx,mjs,cjs}": [
    "prettier --write --no-error-on-unmatched-pattern",
    "oxlint --fix --deny-warnings --no-error-on-unmatched-pattern",
  ],
  "*.{css,json,md,html,yml,yaml}":
    "prettier --write --no-error-on-unmatched-pattern",
};
