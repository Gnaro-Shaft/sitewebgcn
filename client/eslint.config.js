import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // `ignoreRestSiblings` : « const { _id, createdAt, ...payload } = x » sert
      // à retirer des champs, pas à les lire. Ce n'est pas une variable morte.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', ignoreRestSiblings: true }],
      // DETTE, notée le 5 septembre 2026. La règle est arrivée avec
      // eslint-plugin-react-hooks 6 : quinze widgets et pages mettent l'état
      // à jour de façon synchrone dans un effet, un motif à réécrire un par
      // un (état dérivé ou chargement asynchrone). En avertissement pour que
      // la CI reste lisible ; à repasser en erreur quand la dette est réglée.
      'react-hooks/set-state-in-effect': 'warn',
      // Même dette : deux contextes exportent un hook à côté du fournisseur.
      'react-refresh/only-export-components': 'warn',
    },
  },
])
