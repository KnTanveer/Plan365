import { google } from 'googleapis';
import cookie from 'cookie';
import axios from 'axios';

export default async function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  let access_token = cookies.access_token;

  if (!access_token) {
    const refresh_token = cookies.refresh_token;
    if (!refresh_token) return res.status(401).send('Unauthorized');

    try {
      const { data } = await axios.post('https://oauth2.googleapis.com/token', null, {
        params: {
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token
        }
      });
      access_token = data.access_token;
      res.setHeader('Set-Cookie', cookie.serialize('access_token', access_token, {
        httpOnly: true, secure: true, maxAge: 3600, path: '/',
      }));
    } catch {
      return res.status(401).json({ error: 'Token refresh failed' });
    }
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token });

  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const events = await calendar.events.list({
      calendarId: 'primary', timeMin: new Date().toISOString(),
      singleEvents: true, orderBy: 'startTime'
    });
    res.json(events.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
