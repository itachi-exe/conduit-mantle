const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  {
    key: "Content-Security-Policy",
    // 'unsafe-inline' on script/style is required by Next.js's own hydration
    // bootstrap and this app's inline style={{}} usage. 'unsafe-eval' on
    // script-src is dev-only (React's dev-mode debugging uses eval(); it
    // never does in production, per React's own warning) so production
    // stays strict. Everything else is locked to same-origin plus the real
    // external hosts this app actually loads from: DefiLlama's icon CDN and
    // Google Fonts.
    value: [
      "default-src 'self'",
      "img-src 'self' https://icons.llamao.fi",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
