import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves this project at https://<user>.github.io/SKCT/, not at
// the domain root, so every asset URL needs the /SKCT/ prefix baked in.
// Building straight into docs/ (instead of dist/) so GitHub Pages can be set
// to "Deploy from a branch" -> main -> /docs, no Actions workflow needed.
export default defineConfig({
  base: '/SKCT/',
  build: {
    outDir: 'docs',
  },
  plugins: [react()],
})
