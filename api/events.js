import { google } from "googleapis";
import { getSessionClient } from "./_google"; 
import { getTokensFromCookies } from "./_session"; 

export default async function handler(req, res) {
  try {
    console.log("Request headers:", req.headers);

    const tokens = getTokensFromCookies(req, res);
    console.log("Parsed tokens:", tokens);

    if (!tokens?.access_token) {
      return res.status(401).json({ error: "Not authenticated", tokens });
    }

    const auth = getSessionClient(tokens);
    const calendar = google.calendar({ version: "v3", auth });

    const calendarId = await getOrCreatePlan365Calendar(calendar);

    if (req.method === "GET") {
      const timeMin = new Date(new Date().getFullYear(), 0, 1).toISOString();
      const timeMax = new Date(new Date().getFullYear() + 1, 0, 1).toISOString();

      try {
        const result = await calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          showDeleted: false,
          singleEvents: true,
          orderBy: 'startTime'
        });

        return res.status(200).json(result.data.items || []);
      } catch (apiErr) {
        console.error("Google API Error:", apiErr);
        return res.status(502).json({ error: "Failed to list events", detail: apiErr.message });
      }
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (err) {
    console.error("Internal Server Error:", err);
    res.status(500).json({ error: "Unexpected server error" });
  }
}

// Dummy placeholder — ensure this exists or is imported
async function getOrCreatePlan365Calendar(calendar) {
  // Placeholder logic for now:
  const calendarList = await calendar.calendarList.list();
  const existing = calendarList.data.items.find(c => c.summary === "Plan365");

  if (existing) return existing.id;

  const newCalendar = await calendar.calendars.insert({
    requestBody: { summary: "Plan365" }
  });

  return newCalendar.data.id;
}
