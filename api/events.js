import { google } from "googleapis";
import { getSessionClient } from "./google.js";
import { getTokensFromCookies } from "./session.js";

export default async function handler(req, res) {
  const tokens = getTokensFromCookies(req, res);

  if (!tokens?.access_token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const auth = getSessionClient(tokens);
  const calendar = google.calendar({ version: "v3", auth });

  let calendarId;

  try {
    calendarId = await getOrCreatePlan365Calendar(calendar);
  } catch (err) {
    console.error("Calendar access error:", err);
    return res.status(500).json({ error: "Failed to access calendar", detail: err.message });
  }

  try {
    if (req.method === "GET") {
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), 0, 1).toISOString();
      const timeMax = new Date(now.getFullYear() + 1, 0, 1).toISOString();

      const result = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: false,
        showDeleted: false,
        maxResults: 2500,
        orderBy: "startTime",
      });

      return res.status(200).json({ items: result.data.items || [] });
    }

    if (req.method === "POST") {
      const { summary, description, start, end, recurrence } = req.body;

      const newEvent = {
        summary,
        description,
        start: { date: start },
        end: { date: end },
        recurrence,
      };

      const result = await calendar.events.insert({
        calendarId,
        requestBody: newEvent,
      });

      return res.status(201).json({ event: result.data });
    }

    if (req.method === "DELETE") {
      const { eventId } = req.body;

      if (!eventId) {
        return res.status(400).json({ error: "Missing eventId" });
      }

      await calendar.events.delete({
        calendarId,
        eventId,
      });

      return res.status(204).end();
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error("API Error:", err);
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
}

async function getOrCreatePlan365Calendar(calendar) {
  const calendars = await calendar.calendarList.list();
  const existing = calendars.data.items.find(c => c.summary === "Plan365");
  if (existing) return existing.id;

  const newCal = await calendar.calendars.insert({
    requestBody: { summary: "Plan365" },
  });

  return newCal.data.id;
}
