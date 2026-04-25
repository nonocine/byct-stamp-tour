/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // 카카오맵 타일 서버
      { protocol: 'https', hostname: '*.daumcdn.net' },
      { protocol: 'https', hostname: 'dapi.kakao.com' },
    ],
  },
}

module.exports = nextConfig
