import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',   // package.json의 homepage 경로와 일치시킴
  server: {
    port: 5174,
    strictPort: true
  }
})