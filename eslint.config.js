import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'playwright-report/', 'test-results/', 'public/firebase-config.js'] },
  js.configs.recommended,
  {
    files: ['public/assets/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: globals.browser }
  },
  {
    files: ['public/firebase-config*.js', '*.config.js', 'tests/**/*.js', 'scripts/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node }
  }
];
