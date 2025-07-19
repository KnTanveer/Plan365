// --- Constants and State ---
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let calendarData = {};
let calendarId = null;
let accessToken = null;
let tokenClient;
let currentEditingEvent = null;
let showRecurringEvents = true;

function showSpinner(show) {
  const spinner = document.getElementById("spinner");
  if (spinner) spinner.style.display = show ? "block" : "none";
}

function addToRange(event) {
  const start = new Date(event.range.start);
  const end = new Date(event.range.end);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    if (!calendarData[key]) calendarData[key] = [];
    calendarData[key].push(event);
  }
}

function openModal(dateStr, event = null) {
  document.getElementById("start-date").value = event ? event.range.start : dateStr;
  document.getElementById("end-date").value = event ? event.range.end : dateStr;
  document.getElementById("note-text").value = event ? event.text : "";
  document.getElementById("event-color").value = event ? event.color : "#b6eeb6";
  document.getElementById("repeat-select").value = event?.recurrenceType || "";
  document.getElementById("duration-display").textContent = "";
  document.getElementById("delete-btn").style.display = event ? "inline-block" : "none";
  currentEditingEvent = event;
  document.getElementById("modal").style.display = "flex";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
  currentEditingEvent = null;
}

async function saveNote() {
  const start = document.getElementById("start-date").value;
  const end = document.getElementById("end-date").value;
  const text = document.getElementById("note-text").value;
  const color = document.getElementById("event-color").value;
  const recurrence = document.getElementById("repeat-select").value;

  if (!start || !end || !text) return alert("Please fill all fields");
  const metadata = JSON.stringify({ color });
  const recurrenceRule = recurrence ? [`RRULE:FREQ=${recurrence}`] : undefined;

  if (currentEditingEvent) {
    await gapi.client.calendar.events.update({
      calendarId,
      eventId: currentEditingEvent.googleId.replace(/_repeat_\d+$/, ""),
      resource: {
        summary: text,
        description: metadata,
        start: { date: start },
        end: { date: new Date(new Date(end).getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0] },
        recurrence: recurrenceRule
      }
    });
  } else {
    await gapi.client.calendar.events.insert({
      calendarId,
      resource: {
        summary: text,
        description: metadata,
        start: { date: start },
        end: { date: new Date(new Date(end).getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0] },
        recurrence: recurrenceRule
      }
    });
  }

  closeModal();
  await initData();
}

async function deleteCurrentEvent() {
  if (!currentEditingEvent) return;
  const confirmDelete = confirm("Delete this event?");
  if (!confirmDelete) return;

  await gapi.client.calendar.events.delete({
    calendarId,
    eventId: currentEditingEvent.googleId.replace(/_repeat_\d+$/, "")
  });

  closeModal();
  await initData();
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
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
}

function toggleRecurringEvents() {
  showRecurringEvents = !showRecurringEvents;
  document.getElementById("toggle-recurring-btn").textContent = showRecurringEvents ? "Hide Recurring" : "Show Recurring";
  initData();
}

async function initCalendarId() {
  const result = await gapi.client.calendar.calendarList.list();
  const exists = result.result.items.find(c => c.summary === "Plan365");
  calendarId = exists ? exists.id : (await gapi.client.calendar.calendars.insert({ summary: "Plan365" })).result.id;
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

      setInterval(() => tokenClient.requestAccessToken({ prompt: '' }), 55 * 60 * 1000);
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

// ... (rest of createCalendar, initData, etc. remain unchanged)
