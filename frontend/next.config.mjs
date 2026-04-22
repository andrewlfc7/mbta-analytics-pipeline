/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: "http://34.30.107.174:8000/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;