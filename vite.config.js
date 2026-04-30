import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 운영 빌드는 sourcemap 을 노출하지 않는다 — 번들된 소스가 그대로 디버거에 표시되면
// 인증 흐름이나 내부 API 경로가 그대로 노출된다. 디버깅이 필요한 환경은 별도 빌드로.
export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  build: {
    sourcemap: false,
  },
})
