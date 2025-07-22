export default function handler(req, res) {
  const redirect_uri = 'https://your-vercel-domain.vercel.app/api/auth/callback';
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const scope = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly'
  ].join(' ');

  const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `response_type=code&client_id=${client_id}` +
    `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
    `&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

  res.redirect(url);
}
