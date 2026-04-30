import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// 운영 빌드는 sourcemap 을 노출하지 않는다 — 번들된 소스가 그대로 디버거에 표시되면
// 인증 흐름이나 내부 API 경로가 그대로 노출된다. 디버깅이 필요한 환경은 별도 빌드로.
export default defineConfig(({ command, mode }) => {
  // 운영 빌드(`vite build` + production)에서 VITE_API_URL이 비어 있으면
  // localhost 폴백을 가리키는 빌드가 만들어질 위험이 있어 빌드 타임에 즉시 실패시킨다.
  if (command === 'build' && mode === 'production') {
    const env = loadEnv(mode, process.cwd(), '')
    if (!env.VITE_API_URL) {
      throw new Error(
        '[vite] VITE_API_URL 환경변수가 비어 있습니다. 운영 빌드에는 반드시 설정해야 합니다 ' +
          '(예: .env.production 또는 CI 환경변수).'
      )
    }
  }

  return {
    plugins: [react()],
    server: { port: 3000 },
    build: {
      sourcemap: false,
    },
  }
})
