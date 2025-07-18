export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { event, calendarId } = req.body;
  const accessToken = process.env.GOOGLE_ACCESS_TOKEN;

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: event.text,
      start: { date: event.range.start },
      end: { date: event.range.end },
      description: 'Created by Plan365 – do not edit in Google Calendar.',
    })
  });

  const data = await response.json();
  if (!response.ok) return res.status(response.status).json(data);

  res.status(200).json(data);
}
