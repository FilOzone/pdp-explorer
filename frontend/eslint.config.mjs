import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.config({
    extends: ["next", "prettier"],
    ignorePatterns: [".next/**", "node_modules/**", "next-env.d.ts", "yarn.lock", "package-lock.json"],
  }),
];

export default eslintConfig;
