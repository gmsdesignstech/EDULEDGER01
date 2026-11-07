import nextConfig from "eslint-config-next";

const config = [
  {
    ignores: ["node_modules/**", ".next/**", ".next-*/**", "data/**", "dist/**", "coverage/**"],
  },
  ...nextConfig,
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
];

export default config;
