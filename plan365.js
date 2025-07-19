let currentYear = new Date().getFullYear();
let calendarData = {};
let calendarId = null;
let accessToken = null;
let tokenClient;
let currentEditingEvent = null;
let showRecurringEvents = true;

function addToRange(event) {
  const start = new Date(event.range.start);
  const end = new Date(event.range.end);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    if (!calendarData[key]) calendarData[key] = [];
    calendarData[key].push(event);
  }
}

function gapiLoad() {
  return new Promise((resolve) => {
    gapi.load("client", async () => {
      await gapi.client.init({
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"]
      });
      resolve();
    });
  });
}

function toggleRecurringEvents() {
  showRecurringEvents = !showRecurringEvents;
  document.getElementById("toggle-recurring-btn").textContent = showRecurringEvents ? "Hide Recurring" : "Show Recurring";
  initData();
}

async function initData() {
  if (!calendarId) return;
  const timeMin = new Date(currentYear, 0, 1).toISOString();
  const timeMax = new Date(currentYear + 1, 0, 1).toISOString();

  try {
    const response = await gapi.client.calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      showDeleted: false,
      singleEvents: false,
      orderBy: "startTime"
    });

    calendarData = {};
    let skippedCount = 0;

    response.result.items.forEach(ev => {
      const start = ev.start?.date;
      const endRaw = ev.end?.date;

      if (!start || !endRaw) {
        skippedCount++;
        return;
      }

      const rrule = ev.recurrence?.[0] || "";

      if (!showRecurringEvents && rrule) return;

      const metadata = ev.description ? JSON.parse(ev.description) : {};
      const color = metadata.color || '#b6eeb6';

      const staticize = (count, adjustFunc) => {
        for (let i = 0; i < count; i++) {
          const startDate = new Date(start);
          const endDate = new Date(endRaw);
          adjustFunc(startDate, i);
          adjustFunc(endDate, i);
          endDate.setDate(endDate.getDate() - 1);

          const eventCopy = {
            text: ev.summary,
            color,
            range: {
              start: startDate.toISOString().split("T")[0],
              end: endDate.toISOString().split("T")[0]
            },
            googleId: ev.id + `_repeat_${i}`
          };
          addToRange(eventCopy);
        }
      };

      if (rrule.startsWith("RRULE:FREQ=YEARLY")) {
        staticize(5, (d, i) => d.setFullYear(d.getFullYear() + i));
        return;
      } else if (rrule.startsWith("RRULE:FREQ=MONTHLY")) {
        staticize(6, (d, i) => d.setMonth(d.getMonth() + i));
        return;
      } else if (rrule.startsWith("RRULE:FREQ=WEEKLY")) {
        staticize(8, (d, i) => d.setDate(d.getDate() + 7 * i));
        return;
      } else if (rrule) {
        skippedCount++;
        return;
      }

      const endDateObj = new Date(endRaw);
      if (isNaN(endDateObj.getTime())) {
        skippedCount++;
        return;
      }

      endDateObj.setDate(endDateObj.getDate() - 1);
      const end = endDateObj.toISOString().split("T")[0];

      const newEvent = {
        text: ev.summary,
        color,
        range: { start, end },
        googleId: ev.id
      };
      addToRange(newEvent);
    });

    if (skippedCount > 0) {
      console.info(`Skipped ${skippedCount} unsupported or timed events.`);
    }

    createCalendar();
  } catch (e) {
    console.error("Failed to fetch events:", e);
    if (e.status === 401) {
      alert("Session expired. Please sign in again.");
      handleSignOut();
    }
  }
}
