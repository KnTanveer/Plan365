import { google } from 'googleapis';
import cookie from 'cookie';

export default async function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const access_token = cookies.access_token;

  if (!access_token) return res.status(401).send('Unauthorized');

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token });
  const calendar = google.calendar({ version: 'v3', auth });

  const currentYear = new Date().getFullYear();
  const timeMin = new Date(currentYear, 0, 1).toISOString();
  const timeMax = new Date(currentYear + 1, 0, 1).toISOString();

  try {
    const result = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: false,
      showDeleted: false,
      orderBy: 'startTime'
    });

    res.status(200).json({ items: result.data.items });
  } catch (err) {
    console.error('Fetch events failed:', err.message);
    res.status(500).json({ error: err.message });
  }
}
