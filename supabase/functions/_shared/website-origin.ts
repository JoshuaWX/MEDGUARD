const WEBSITE_ORIGINS = new Set([
  'https://medguardng.me',
  'https://www.medguardng.me',
  'http://localhost:4321',
  'http://127.0.0.1:4321',
]);

// Vercel deployment URLs are deliberately narrow: only previews generated for
// the MedGuard project in JoshuaWX's team may use the public forms. This is
// not a wildcard for arbitrary vercel.app applications.
const MEDGUARD_PREVIEW = /^https:\/\/medguard-[a-z0-9-]+-joshuawxs-projects\.vercel\.app$/i;

export function allowedWebsiteOrigin(origin: string, configuredOrigins: string[] = []): boolean {
  return WEBSITE_ORIGINS.has(origin) || configuredOrigins.includes(origin) || MEDGUARD_PREVIEW.test(origin);
}

export function websiteCors(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
