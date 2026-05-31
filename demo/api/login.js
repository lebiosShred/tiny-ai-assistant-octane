export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'OctaneAdmin2026!';

  if (password === adminPassword) {
    // Issue secure cookie
    res.setHeader('Set-Cookie', 'admin_token=authorized; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400');
    // Redirect to secure dashboard
    res.redirect(302, '/admin_setup.html');
  } else {
    // Redirect back to login with error
    res.redirect(302, '/admin-login.html?error=1');
  }
}
