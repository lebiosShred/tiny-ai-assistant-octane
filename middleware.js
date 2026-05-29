export const config = {
  matcher: ['/admin_setup.html', '/admin_setup', '/demo/admin_setup.html', '/admin-login', '/demo/admin-login.html'],
};

// SHA-256 of 'authonly'
const EXPECTED_HASH_HEX = '02dccf3473f324adffb11fc2e8dae48ff2675661386bb02cfb6f9d273760ea8b';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function middleware(req) {
  const url = new URL(req.url);

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
  if (url.pathname.includes('admin_setup')) {
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
