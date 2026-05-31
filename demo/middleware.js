export default function middleware(req) {
  // We can access cookies from the headers
  const cookieHeader = req.headers.get('cookie') || '';
  const hasToken = cookieHeader.includes('admin_token=authorized');
  
  const url = new URL(req.url);

  // Protect /admin_setup and /admin_setup.html routes
  if (url.pathname.startsWith('/admin_setup')) {
    if (!hasToken) {
      // Redirect unauthenticated requests to login page
      url.pathname = '/admin-login.html';
      return Response.redirect(url, 302);
    }
  }

  // Pass through if authenticated or not protected
  return new Response(null, {
    headers: { 'x-middleware-next': '1' }
  });
}

export const config = {
  matcher: ['/admin_setup', '/admin_setup.html'],
};
