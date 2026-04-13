import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/meeting-minute/', // GitHub 저장소 이름이 다를 경우 이 부분을 수정하세요.
})
