import { google } from 'googleapis';
import cookie from 'cookie';
 
export default async function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token ? JSON.parse(cookies.token) : null;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials(token);

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    const result = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime'
    });

    res.status(200).json(result.data);
  } catch (err) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}
