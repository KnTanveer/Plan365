// plan365.js (modified version with recurring support and toggle)

let currentYear = new Date().getFullYear();
let calendarData = {};
let calendarId = null;
let accessToken = null;
let tokenClient;
let currentEditingEvent = null;
let showRecurringEvents = true; // toggle state

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
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
}

function changeYear(offset) {
  currentYear += offset;
  document.getElementById("year-label").textContent = currentYear;
  initData();
}

function goToToday() {
  currentYear = new Date().getFullYear();
  document.getElementById("year-label").textContent = currentYear;
  initData();
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

function repeatEventInstances(ev, count = 5, freq = "YEARLY") {
  const start = new Date(ev.start.date);
  const end = new Date(ev.end.date);
  end.setDate(end.getDate() - 1);
  const color = ev.description ? JSON.parse(ev.description)?.color || "#ffd3d3" : "#ffd3d3";

  const result = [];

  for (let i = 0; i < count; i++) {
    const newStart = new Date(start);
    const newEnd = new Date(end);

    if (freq === "YEARLY") {
      newStart.setFullYear(start.getFullYear() + i);
      newEnd.setFullYear(end.getFullYear() + i);
    } else if (freq === "MONTHLY") {
      newStart.setMonth(start.getMonth() + i);
      newEnd.setMonth(end.getMonth() + i);
    } else if (freq === "WEEKLY") {
      newStart.setDate(start.getDate() + i * 7);
      newEnd.setDate(end.getDate() + i * 7);
    }

    result.push({
      text: ev.summary,
      color,
      range: {
        start: newStart.toISOString().split("T")[0],
        end: newEnd.toISOString().split("T")[0]
      },
      googleId: `${ev.id}_repeat_${i}`
    });
  }

  return result;
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
    let skipped = 0;

    response.result.items.forEach(ev => {
      const start = ev.start?.date;
      const endRaw = ev.end?.date;
      if (!start || !endRaw) return skipped++;

      // Handle recurrence conversions
      if (showRecurringEvents && ev.recurrence?.[0]) {
        const rule = ev.recurrence[0];
        if (rule.includes("FREQ=YEARLY")) {
          repeatEventInstances(ev, 5, "YEARLY").forEach(addToRange);
          return;
        } else if (rule.includes("FREQ=MONTHLY")) {
          repeatEventInstances(ev, 6, "MONTHLY").forEach(addToRange);
          return;
        } else if (rule.includes("FREQ=WEEKLY")) {
          repeatEventInstances(ev, 8, "WEEKLY").forEach(addToRange);
          return;
        }
        return skipped++;
      }

      const endDateObj = new Date(endRaw);
      if (isNaN(endDateObj.getTime())) return skipped++;
      endDateObj.setDate(endDateObj.getDate() - 1);
      const end = endDateObj.toISOString().split("T")[0];

      const metadata = ev.description ? JSON.parse(ev.description) : {};
      const color = metadata.color || '#b6eeb6';
      const newEvent = {
        text: ev.summary,
        color,
        range: { start, end },
        googleId: ev.id
      };
      addToRange(newEvent);
    });

    console.info(`Skipped ${skipped} unsupported or timed events.`);
    createCalendar();
  } catch (e) {
    console.error("Failed to fetch events:", e);
    if (e.status === 401) {
      alert("Session expired. Please sign in again.");
      handleSignOut();
    }
  }
}

function toggleRecurring() {
  showRecurringEvents = !showRecurringEvents;
  document.getElementById("toggle-recurring-btn").textContent = showRecurringEvents ? "Hide Recurring" : "Show Recurring";
  initData();
}

// addToRange, createCalendar, modal, saveNote, deleteCurrentEvent stay unchanged for brevity...

window.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") document.body.classList.add("dark");

  document.getElementById("toggle-recurring-btn")?.addEventListener("click", toggleRecurring);
});
