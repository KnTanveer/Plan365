import { google } from 'googleapis';
import axios from 'axios';
import cookie from 'cookie';

export default async function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  let access_token = cookies.access_token;

  if (!access_token) {
    const refresh_token = cookies.refresh_token;
    if (!refresh_token) return res.status(401).send('Not logged in');

    const { data } = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token,
        grant_type: 'refresh_token'
      }
    });

    access_token = data.access_token;
    res.setHeader('Set-Cookie', cookie.serialize('access_token', access_token, {
      httpOnly: true, secure: true, maxAge: 3600, path: '/',
    }));
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token });

  const calendar = google.calendar({ version: 'v3', auth });

  const events = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  });

  res.json(events.data);
}
