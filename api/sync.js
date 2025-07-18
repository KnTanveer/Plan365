// /api/sync.js

import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { event, calendarId: storedId } = req.body;

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  auth.setCredentials({ access_token: req.body.tokens.access_token });

  const calendar = google.calendar({ version: 'v3', auth });

  let calendarId = storedId;

  // Step 1: Create Plan365 calendar if needed
  if (!calendarId) {
    const calendars = await calendar.calendarList.list();
    const existing = calendars.data.items.find(c => c.summary === 'Plan365');
    if (existing) {
      calendarId = existing.id;
    } else {
      const created = await calendar.calendars.insert({ requestBody: { summary: 'Plan365' } });
      calendarId = created.data.id;
    }
  }

  // Step 2: Insert Event
  await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: event.title || 'Plan365 Event',
      description: event.note || '',
      start: { date: event.start },
      end: { date: event.end },
    }
  });

  res.status(200).json({ calendarId });
}
