export default function handler(req, res) {
  const client_id = process.env.GOOGLE_CLIENT_ID;

  if (!client_id) {
    console.error("Missing GOOGLE_CLIENT_ID in environment");
    return res.status(500).send("Server misconfiguration: Missing Google Client ID");
  }

  const redirect_uri = 'https://plan365.vercel.app/api/auth/callback';
  const scope = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
  ].join(' ');

  const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  oauthUrl.searchParams.set('response_type', 'code');
  oauthUrl.searchParams.set('client_id', client_id);
  oauthUrl.searchParams.set('redirect_uri', redirect_uri);
  oauthUrl.searchParams.set('scope', scope);
  oauthUrl.searchParams.set('access_type', 'offline');
  oauthUrl.searchParams.set('prompt', 'consent');

  res.writeHead(302, { Location: oauthUrl.toString() });
  res.end();
}
