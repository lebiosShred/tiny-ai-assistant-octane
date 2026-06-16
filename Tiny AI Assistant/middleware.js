export const config = {
  matcher: [
    '/',
    '/index.html'
  ],
};

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

  return; // Proceed normally
}
