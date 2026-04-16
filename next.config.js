/** @type {import('next').NextConfig} */
const nextConfig = {
    allowedDevOrigins: [
        'http://localhost',
        'http://192.168.140.130',
        'https://db-zoo.servbase.net',
    ]
};

module.exports = nextConfig;
