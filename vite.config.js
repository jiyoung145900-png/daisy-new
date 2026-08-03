import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 새 버전이 나오면 자동 업데이트
      registerType: 'autoUpdate',

      // Service Worker 자동 등록
      injectRegister: 'auto',

      // 이미 만든 public/manifest.json 그대로 사용
      manifest: false,

      // 캐싱 전략
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff2}'],

        // 최대 파일 크기 (기본 2MB → 5MB로 상향)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,

        runtimeCaching: [
          {
            // Cloudinary 이미지: 캐시 우선 (한번 로드하면 재사용)
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cloudinary-images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30일
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Firebase Firestore: 네트워크만 (실시간 데이터)
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly'
          },
          {
            // Firebase Auth: 네트워크만
            urlPattern: /^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly'
          },
          {
            // IP 조회 API들: 네트워크 우선 (실패시 캐시)
            urlPattern: /^https:\/\/(ipinfo\.io|ipapi\.co|api\.ipify\.org)\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ip-lookup',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 // 1시간
              }
            }
          }
        ]
      },

      // 개발 중에는 PWA 캐시 비활성화 (새로고침 안 되는 문제 방지)
      // 실제 배포된 사이트에서만 PWA 작동
      devOptions: {
        enabled: false
      }
    })
  ],
  base: '/',   // package.json의 homepage 경로와 일치시킴
  server: {
    port: 5174,
    strictPort: true
  }
})