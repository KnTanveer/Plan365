import fetch from 'node-fetch';
import cookie from 'cookie';

export default async function handler(req, res) {
  try {
    const { code } = req.query;
    if (!code) {
      console.error("No `code` found in query string");
      return res.status(400).json({ error: 'Missing code in callback' });
    }

    const client_id = process.env.GOOGLE_CLIENT_ID;
    const client_secret = process.env.GOOGLE_CLIENT_SECRET;
    const redirect_uri = 'https://plan365.vercel.app/api/auth/callback';

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id,
        client_secret,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenRes.status !== 200 || !tokenData.access_token) {
      console.error("Token fetch failed:", tokenData);
      return res.status(500).json({ error: 'Failed to fetch access token' });
    }

    const tokenPayload = JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || '',
    });

    res.setHeader('Set-Cookie', [
      cookie.serialize('tokens', tokenPayload, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      }),
    ]);

    res.redirect('/');
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).json({ error: 'OAuth callback failure' });
  }
}
