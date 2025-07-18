let accessToken = null;
let tokenClient = null;
let currentYear = new Date().getFullYear();
let calendarId = localStorage.getItem("plan365_calendar_id") || null;
let calendarData = {};
let selectedDate = null;
let editingEvent = null;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year-label").textContent = currentYear;
  createCalendar();
});

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


function handleSignIn() {
  tokenClient = google.accounts.oauth2.initTokenClient({
  client_id: '943003293805-j19ek1k66uvh8s2q7dd4hsvtimf516jv.apps.googleusercontent.com',
  scope: 'https://www.googleapis.com/auth/calendar',
  callback: async (tokenResponse) => {
    accessToken = tokenResponse.access_token;

    await gapiLoad(); // Wait until gapi client is ready

    await gapi.client.init({
      discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"]
    });

    gapi.client.setToken({ access_token: accessToken });

    await initCalendarId(); // Optional: create or fetch "Plan365"
    await initData(); // Load events
  }
});

  tokenClient.requestAccessToken();
}

function handleSignOut() {
  gapi.client.setToken(null);
  google.accounts.oauth2.revoke(accessToken, () => {
    accessToken = null;
    calendarId = null;
    localStorage.removeItem("plan365_calendar_id");
    calendarData = {};
    createCalendar();
    document.getElementById('signin-btn').style.display = 'inline-block';
    document.getElementById('signout-btn').style.display = 'none';
  });
}

async function initCalendarId() {
  const res = await gapi.client.calendar.calendarList.list();
  const existing = res.result.items.find(c => c.summary === "Plan365");
  if (existing) {
    calendarId = existing.id;
  } else {
    const newCal = await gapi.client.calendar.calendars.insert({ summary: "Plan365" });
    calendarId = newCal.result.id;
  }
  localStorage.setItem("plan365_calendar_id", calendarId);
}

async function initData() {
  if (!calendarId) return;
  calendarData = {};
  const timeMin = new Date(currentYear, 0, 1).toISOString();
  const timeMax = new Date(currentYear + 1, 0, 1).toISOString();
  const res = await gapi.client.calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime"
  });

  for (const ev of res.result.items) {
    const start = ev.start.date;
    const end = ev.end.date;
    let meta = {};
    try { if (ev.description) meta = JSON.parse(ev.description); } catch {}

    const newEvent = {
      text: ev.summary,
      color: meta.color || '#b6eeb6',
      range: { start, end },
      googleId: ev.id
    };
    addToRange(newEvent);
  }
  createCalendar();
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

function createCalendar() {
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";
  const todayStr = new Date().toISOString().split("T")[0];

  for (let m = 0; m < 12; m++) {
    const monthCol = document.createElement("div");
    monthCol.className = "month-column";

    const title = document.createElement("h3");
    title.textContent = MONTH_NAMES[m];
    monthCol.appendChild(title);

    const daysInMonth = new Date(currentYear, m + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cell = document.createElement("div");
      cell.className = "day-cell";
      if (dateStr === todayStr) cell.classList.add("today");
      cell.onclick = () => openModal(dateStr);

      const label = document.createElement("div");
      label.className = "day-label";
      label.textContent = d;
      cell.appendChild(label);

      if (calendarData[dateStr]) {
        for (const ev of calendarData[dateStr]) {
          const evDiv = document.createElement("div");
          evDiv.textContent = ev.text;
          evDiv.className = "note-text";
          evDiv.style.background = ev.color;
          evDiv.onclick = (e) => {
            e.stopPropagation();
            openModal(dateStr, ev);
          };
          cell.appendChild(evDiv);
        }
      }
      monthCol.appendChild(cell);
    }
    calendar.appendChild(monthCol);
  }
}

function addToRange(event) {
  const key = event.range.start;
  if (!calendarData[key]) calendarData[key] = [];
  calendarData[key].push(event);
}

function deleteFromRange(googleId) {
  for (const day in calendarData) {
    calendarData[day] = calendarData[day].filter(e => e.googleId !== googleId);
  }
}

function openModal(dateStr, event = null) {
  selectedDate = dateStr;
  editingEvent = event;
  document.getElementById("modal").style.display = "flex";
  document.getElementById("start-date").value = event?.range.start || dateStr;
  document.getElementById("end-date").value = event?.range.end || dateStr;
  document.getElementById("note-text").value = event?.text || "";
  document.getElementById("event-color").value = event?.color || "#b6eeb6";
  document.getElementById("delete-btn").style.display = event ? "inline-block" : "none";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
  selectedDate = null;
  editingEvent = null;
}

async function saveNote() {
  const start = document.getElementById("start-date").value;
  const end = document.getElementById("end-date").value;
  const text = document.getElementById("note-text").value;
  const color = document.getElementById("event-color").value;

  if (!text || !start || !end) return;

  const eventData = {
    summary: text,
    start: { date: start },
    end: { date: end },
    description: JSON.stringify({ color })
  };

  if (editingEvent?.googleId) {
    await gapi.client.calendar.events.update({
      calendarId,
      eventId: editingEvent.googleId,
      resource: eventData
    });
    deleteFromRange(editingEvent.googleId);
  } else {
    const res = await gapi.client.calendar.events.insert({
      calendarId,
      resource: eventData
    });
    editingEvent = { googleId: res.result.id };
  }

  const newEvent = {
    text,
    color,
    range: { start, end },
    googleId: editingEvent.googleId
  };

  addToRange(newEvent);
  createCalendar();
  closeModal();
}

async function deleteCurrentEvent() {
  if (!editingEvent?.googleId) return;
  await gapi.client.calendar.events.delete({
    calendarId,
    eventId: editingEvent.googleId
  });
  deleteFromRange(editingEvent.googleId);
  createCalendar();
  closeModal();
}

function toggleDarkMode() {
  document.body.classList.toggle("dark");
}

window.addEventListener("load", async () => {
  await gapiLoad();
});


