import { google } from 'googleapis';
import cookie from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { start, end, text, color, recurrence, editId } = req.body;
  const cookies = cookie.parse(req.headers.cookie || '');
  const access_token = cookies.access_token;

  if (!access_token) return res.status(401).send('Unauthorized');

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token });
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    if (editId) {
      try {
        await calendar.events.delete({ calendarId: 'primary', eventId: editId.split('_repeat_')[0] });
      } catch (e) {
        console.warn('Edit deletion failed:', e.message);
      }
    }

    const event = {
      summary: text,
      description: JSON.stringify({ color, recurrence }),
      start: { date: start },
      end: { date: new Date(new Date(end).getTime() + 86400000).toISOString().split('T')[0] },
      recurrence: recurrence ? [`RRULE:FREQ=${recurrence}`] : []
    };

    await calendar.events.insert({ calendarId: 'primary', resource: event });
    res.status(200).end();
  } catch (err) {
    console.error('Save failed:', err.message);
    res.status(500).json({ error: err.message });
  }
}
