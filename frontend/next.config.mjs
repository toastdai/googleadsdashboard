/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        // Warning: This allows production builds to successfully complete even if
        // your project has ESLint errors.
        ignoreDuringBuilds: true,
    },
    // Allow ngrok and other dev origins for cross-origin CSS/JS
    allowedDevOrigins: [
        '*.ngrok-free.app',
        '*.ngrok.io',
        'localhost',
        '127.0.0.1',
    ],
};

export default nextConfig;
