export default function handler(req, res) {
  const client_id = process.env.GOOGLE_CLIENT_ID;

  if (!client_id) {
    console.error("Missing GOOGLE_CLIENT_ID in environment");
    return res.status(500).send("Missing Google credentials");
  }

  const redirect_uri = 'https://plan365.vercel.app/api/auth/callback';
  const scope = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly'
  ].join(' ');

  const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

  res.redirect(url);
}
