import { google } from "googleapis";
import { getSessionClient } from "./_google"; 
import { getTokensFromCookies } from "./_session"; 

export default async function handler(req, res) {
  try {
    console.log("headers:", req.headers);
    console.log("raw cookies:", req.headers.cookie);

    const tokens = getTokensFromCookies(req, res);
    console.log("parsed tokens:", tokens);

    if (!tokens?.access_token) {
      return res.status(401).json({ error: "Not authenticated", tokens });
    }

    const auth = getSessionClient(tokens);
    const calendar = google.calendar({ version: "v3", auth });
    const calendarId = await getOrCreatePlan365Calendar(calendar);

    if (req.method === "GET") {
      const timeMin = new Date(new Date().getFullYear(), 0, 1).toISOString();
      const timeMax = new Date(new Date().getFullYear() + 1, 0, 1).toISOString();

      const result = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        showDeleted: false,
        singleEvents: false,
        orderBy: "startTime"
      });

      // Optional: return single event if ?id=... is provided
      if (req.query.id) {
        const match = result.data.items.find(ev => ev.id === req.query.id);
        if (match) return res.json(match);
        return res.status(404).json({ error: "Event not found" });
      }

      return res.json(result.data);
    }

    if (req.method === "POST") {
      const { summary, description, start, end, recurrence } = req.body;

      const response = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary,
          description,
          start: { date: start },
          end: { date: end },
          recurrence: recurrence || []
        }
      });

      return res.status(200).json(response.data);
    }

    if (req.method === "DELETE") {
      const { eventId } = req.body;
      if (!eventId) return res.status(400).json({ error: "Missing eventId" });

      await calendar.events.delete({ calendarId, eventId });
      return res.status(204).end();
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("API error in /api/events.js:", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getOrCreatePlan365Calendar(calendar) {
  const list = await calendar.calendarList.list();
  const existing = list.data.items.find(c => c.summary === "Plan365");
  if (existing) return existing.id;

  const created = await calendar.calendars.insert({ requestBody: { summary: "Plan365" } });
  return created.data.id;
}
