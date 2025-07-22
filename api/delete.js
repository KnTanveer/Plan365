import { google } from 'googleapis';
import cookie from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { googleId, deleteSeries } = req.body;
  const cookies = cookie.parse(req.headers.cookie || '');
  const access_token = cookies.access_token;

  if (!access_token) return res.status(401).send('Unauthorized');

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token });
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    let id = googleId;

    if (deleteSeries) {
      try {
        const event = await calendar.events.get({ calendarId: 'primary', eventId: googleId });
        if (event.data.recurringEventId) id = event.data.recurringEventId;
      } catch (e) {
        if (e.code !== 410) throw e;
      }
    }

    await calendar.events.delete({ calendarId: 'primary', eventId: id });
    res.status(200).end();
  } catch (err) {
    console.error('Delete failed:', err.message);
    res.status(500).json({ error: err.message });
  }
}
