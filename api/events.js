export default async function handler(req, res) {
  const tokens = getTokensFromCookies(req, res);

  if (!tokens?.access_token) {
    return res.status(401).json({ error: "No access_token found" });
  }

  let auth;
  try {
    auth = getSessionClient(tokens);
  } catch (err) {
    return res.status(500).json({ error: "Failed to initialize OAuth client", detail: err.message });
  }

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
        singleEvents: true,
        showDeleted: false,
        maxResults: 2500,
        orderBy: "startTime",
      });

      return res.status(200).json({ items: result.data.items || [] });
    }

    if (req.method === "POST") {
      const { summary, description, start, end, recurrence, color } = req.body;

      const newEvent = {
        summary,
        description,
        start: { date: start },
        end: { date: end },
        recurrence,
        description: JSON.stringify({ color, recurrence }), // Store metadata here
      };

      const result = await calendar.events.insert({
        calendarId,
        requestBody: newEvent,
      });

      return res.status(201).json({ event: result.data });
    }

    if (req.method === "PUT") {
      const { eventId, updates } = req.body;
      if (!eventId) return res.status(400).json({ error: "Missing eventId for update" });

      // 2. When updating a recurring event's type, delete all events with the same base event ID
      const baseId = eventId.split('_repeat_')[0];
      // Delete all matching events (faked recurrences)
      const listResult = await calendar.events.list({
        calendarId,
        showDeleted: false,
        maxResults: 2500,
        orderBy: "startTime",
        singleEvents: true,
      });
      const toDelete = (listResult.data.items || []).filter(ev => ev.id === baseId || ev.id.startsWith(baseId + '_repeat_'));
      for (const ev of toDelete) {
        await calendar.events.delete({ calendarId, eventId: ev.id });
      }

      // Now create the new event (series or single)
      const newEvent = {
        ...updates,
        start: { date: updates.start },
        end: { date: updates.end },
        recurrence: updates.recurrence,
        description: JSON.stringify({ color: updates.color, recurrence: updates.recurrence }),
      };
      const result = await calendar.events.insert({
        calendarId,
        requestBody: newEvent,
      });
      return res.status(200).json({ updated: result.data });
    }

    if (req.method === "DELETE") {
      const { eventId, deleteAll } = req.body;
      if (!eventId) return res.status(400).json({ error: "Missing eventId" });

      try {
        if (deleteAll) {
          // Always delete all events with the base event ID and all _repeat_ variants
          const baseId = eventId.split('_repeat_')[0];
          const listResult = await calendar.events.list({
            calendarId,
            showDeleted: false,
            maxResults: 2500,
            orderBy: "startTime",
            singleEvents: true,
          });
          const toDelete = (listResult.data.items || []).filter(ev => ev.id === baseId || ev.id.startsWith(baseId + '_repeat_'));
          for (const ev of toDelete) {
            try {
              await calendar.events.delete({ calendarId, eventId: ev.id });
            } catch (deleteError) {
              if (deleteError.code === 410) {
                // Event already deleted, ignore
                console.log(`Event ${ev.id} already deleted`);
              } else {
                throw deleteError;
              }
            }
          }
        } else {
          // Delete the single event
          try {
            await calendar.events.delete({
              calendarId,
              eventId,
            });
          } catch (deleteError) {
            if (deleteError.code === 410) {
              // Event already deleted, ignore the error
              console.log(`Event ${eventId} already deleted`);
            } else {
              throw deleteError;
            }
          }
        }
        return res.status(204).end();
      } catch (err) {
        console.error("Delete event error:", err);
        return res.status(500).json({ error: "Failed to delete event", detail: err.message });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Calendar operation error:", err);
    return res.status(500).json({ error: "Calendar operation failed", detail: err.message });
  }
}
