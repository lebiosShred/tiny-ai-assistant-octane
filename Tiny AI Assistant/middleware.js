export const config = {
  matcher: [
    '/',
    '/index.html',
    '/admin_setup.html',
    '/admin_setup',
    '/admin',
    '/audit',
    '/audit_log.html',
    '/analytics',
    '/analytics_dashboard.html',
    '/admin-login',
    '/admin-login.html'
  ],
};

// SHA-256 of 'authonly'
const EXPECTED_HASH_HEX = '5827c79d9e801e1f748aa638543c78b06ecce21f27fd449268e706d00204c92f';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function middleware(req) {
  const url = new URL(req.url);

  // Bypass cache-busting redirects for localhost/127.0.0.1
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  // Strip cache-busting telemetry parameters at the Edge
  if (!isLocalhost && (url.searchParams.has('cb') || url.searchParams.has('v'))) {
    const cleanUrl = new URL(req.url);
    cleanUrl.searchParams.delete('cb');
    cleanUrl.searchParams.delete('v');
    
    if (cleanUrl.toString() !== url.toString()) {
      return new Response(null, {
        status: 301,
        headers: { 'Location': cleanUrl.toString() }
      });
    }
  }

  // 1. Handle Login form submission
  if (req.method === 'POST' && url.pathname.includes('/admin-login')) {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const password = params.get('password');
    
    if (password) {
      const hash = await hashPassword(password);
      if (hash === EXPECTED_HASH_HEX) {
        // Issue secure cookie (Simplified stateless auth for demo)
        // In true enterprise, this would be a signed JWT.
        const response = new Response(null, {
          status: 302,
          headers: {
            'Location': '/admin_setup.html',
            'Set-Cookie': `admin_session=${EXPECTED_HASH_HEX}; HttpOnly; Secure; Path=/; Max-Age=3600; SameSite=Strict`
          }
        });
        return response;
      }
    }
    // Failed login
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/admin-login.html?error=1' }
    });
  }

  // 2. Protect Admin Routes
  if (
    url.pathname.includes('admin_setup') ||
    url.pathname === '/admin' ||
    url.pathname === '/audit' ||
    url.pathname.includes('audit_log') ||
    url.pathname === '/analytics' ||
    url.pathname.includes('analytics_dashboard')
  ) {
    const cookieHeader = req.headers.get('cookie') || '';
    const hasValidSession = cookieHeader.includes(`admin_session=${EXPECTED_HASH_HEX}`);
    
    if (!hasValidSession) {
      return new Response(null, {
        status: 302,
        headers: { 'Location': '/admin-login.html' }
      });
    }
  }

  return; // Proceed normally
}
