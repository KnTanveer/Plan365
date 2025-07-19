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

function toggleDarkMode() {
  document.body.classList.toggle("dark");
  if (document.body.classList.contains("dark")) {
    localStorage.setItem("theme", "dark");
  } else {
    localStorage.setItem("theme", "light");
  }
}

function toggleRecurringEvents() {
  showRecurringEvents = !showRecurringEvents;
  document.getElementById("toggle-recurring-btn").textContent = showRecurringEvents ? "Hide Recurring" : "Show Recurring";
  initData();
}

async function initCalendarId() {
  const result = await gapi.client.calendar.calendarList.list();
  const exists = result.result.items.find(c => c.summary === "Plan365");
  if (exists) {
    calendarId = exists.id;
  } else {
    const res = await gapi.client.calendar.calendars.insert({ summary: "Plan365" });
    calendarId = res.result.id;
  }
}

function handleSignIn() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: '943003293805-j19ek1k66uvh8s2q7dd4hsvtimf516jv.apps.googleusercontent.com',
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
    callback: async (tokenResponse) => {
      accessToken = tokenResponse.access_token;
      localStorage.setItem("accessToken", accessToken);
      await gapiLoad();
      gapi.client.setToken({ access_token: accessToken });

      document.getElementById('signin-btn').style.display = 'none';
      document.getElementById('signout-btn').style.display = 'inline-block';

      setInterval(() => {
        tokenClient.requestAccessToken({ prompt: '' });
      }, 55 * 60 * 1000);

      await initCalendarId();
      await initData();
    }
  });
  tokenClient.requestAccessToken();
}

function handleSignOut() {
  if (accessToken) {
    gapi.client.setToken(null);
    google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
      calendarId = null;
      localStorage.removeItem("accessToken");
      document.getElementById('signin-btn').style.display = 'inline-block';
      document.getElementById('signout-btn').style.display = 'none';
      calendarData = {};
      createCalendar();
    });
  }
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
      singleEvents: true,
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

window.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  const savedToken = localStorage.getItem("accessToken");
  if (savedToken) {
    accessToken = savedToken;
    await gapiLoad();
    gapi.client.setToken({ access_token: accessToken });
    document.getElementById('signin-btn').style.display = 'none';
    document.getElementById('signout-btn').style.display = 'inline-block';

    setInterval(() => {
      tokenClient?.requestAccessToken({ prompt: '' });
    }, 55 * 60 * 1000);

    await initCalendarId();
    await initData();
  }
});
