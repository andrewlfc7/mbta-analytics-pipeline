/** @type {import('next').NextConfig} */
const apiServerUrl =
  process.env.API_SERVER_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://34.30.107.174:8000/api/v1";

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${apiServerUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
