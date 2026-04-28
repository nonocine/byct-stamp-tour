/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // 카카오맵 SDK 더블 마운트 충돌 방지
  images: {
    remotePatterns: [
      // 카카오맵 타일 서버
      { protocol: 'https', hostname: '*.daumcdn.net' },
      { protocol: 'https', hostname: 'dapi.kakao.com' },
    ],
  },
}

module.exports = nextConfig
