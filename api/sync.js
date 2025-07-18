import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { tokens, event, calendarId } = req.body;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials(tokens);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  let plan365CalendarId = calendarId;

  try {
    if (!plan365CalendarId) {
      // Try to find an existing "Plan365" calendar
      const list = await calendar.calendarList.list();
      const existing = list.data.items.find(c => c.summary === 'Plan365');
      if (existing) {
        plan365CalendarId = existing.id;
      } else {
        // Create a new calendar
        const newCal = await calendar.calendars.insert({
          requestBody: {
            summary: 'Plan365',
            timeZone: 'UTC'
          }
        });
        plan365CalendarId = newCal.data.id;
      }
    }

    // Create or update the event in Plan365 calendar
    const newEvent = {
      summary: event.text,
      description: 'Do not edit this directly in Google Calendar. Edit in Plan365.',
      start: { date: event.start },
      end: { date: event.end },
      colorId: '5'
    };

    await calendar.events.insert({
      calendarId: plan365CalendarId,
      requestBody: newEvent
    });

    res.status(200).json({ success: true, calendarId: plan365CalendarId });

  } catch (error) {
    console.error('Google Calendar Sync Error:', error);
    res.status(500).json({ error: error.message });
  }
}
