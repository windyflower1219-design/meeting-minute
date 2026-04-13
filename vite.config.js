import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vercel 배포를 위해 base 경로를 루트('/')로 설정하거나 제거합니다.
})
