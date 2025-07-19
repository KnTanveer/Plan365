let currentYear = new Date().getFullYear();
let calendarData = {};
let calendarId = null;
let accessToken = null;
let tokenClient;
let currentEditingEvent = null;

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

    response.result.items.forEach(ev => {
      const start = ev.start.date;

      const endDateObj = new Date(ev.end.date);
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

    createCalendar();
  } catch (e) {
    console.error("Failed to fetch events:", e);
    if (e.status === 401) {
      alert("Session expired. Please sign in again.");
      handleSignOut();
    }
  }
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

function createCalendar() {
  const calendarEl = document.getElementById("calendar");
  calendarEl.innerHTML = "";
  document.getElementById("year-label").textContent = currentYear;

  for (let month = 0; month < 12; month++) {
    const col = document.createElement("div");
    col.className = "month-column";
    const label = document.createElement("h3");
    label.textContent = new Date(currentYear, month).toLocaleString("default", { month: "long" });
    col.appendChild(label);

    const daysInMonth = new Date(currentYear, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const cell = document.createElement("div");
      cell.className = "day-cell";
      if (dateStr === new Date().toISOString().split("T")[0]) {
        cell.classList.add("today");
      }
      cell.innerHTML = `<div class='day-label'>${day}</div>`;
      if (calendarData[dateStr]) {
        calendarData[dateStr].forEach(e => {
          const n = document.createElement("div");
          n.className = "note-text";
          n.style.background = e.color;
          n.textContent = e.text;

          n.onclick = (event) => {
            event.stopPropagation();
            openModal(dateStr, e);
          };

          cell.appendChild(n);
        });
      }
      cell.onclick = () => openModal(dateStr);
      col.appendChild(cell);
    }

    calendarEl.appendChild(col);
  }
}

function openModal(dateStr, event = null) {
  if (event) {
    currentEditingEvent = event;
    document.getElementById("start-date").value = event.range.start;
    document.getElementById("end-date").value = event.range.end;
    document.getElementById("note-text").value = event.text;
    document.getElementById("event-color").value = event.color;
    document.getElementById("delete-btn").style.display = "inline-block";
  } else {
    currentEditingEvent = null;
    document.getElementById("start-date").value = dateStr;
    document.getElementById("end-date").value = dateStr;
    document.getElementById("note-text").value = "";
    document.getElementById("event-color").value = "#b6eeb6";
    document.getElementById("delete-btn").style.display = "none";
  }

  document.getElementById("modal").style.display = "flex";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}

function saveNote() {
  const start = document.getElementById("start-date").value;
  const end = document.getElementById("end-date").value;
  const text = document.getElementById("note-text").value;
  const color = document.getElementById("event-color").value;

  const event = {
    summary: text,
    start: { date: start },
    end: { date: (new Date(new Date(end).getTime() + 86400000)).toISOString().split("T")[0] },
    description: JSON.stringify({ color })
  };

  if (currentEditingEvent && currentEditingEvent.googleId) {
    gapi.client.calendar.events.update({
      calendarId,
      eventId: currentEditingEvent.googleId,
      resource: event
    }).then(() => initData());
  } else {
    gapi.client.calendar.events.insert({
      calendarId,
      resource: event
    }).then(() => initData());
  }

  closeModal();
}

function deleteCurrentEvent() {
  if (currentEditingEvent && currentEditingEvent.googleId) {
    gapi.client.calendar.events.delete({
      calendarId,
      eventId: currentEditingEvent.googleId
    }).then(() => initData());
  }
  closeModal();
}

window.addEventListener("DOMContentLoaded", async () => {
  const savedToken = localStorage.getItem("accessToken");
  if (savedToken) {
    accessToken = savedToken;
    await gapiLoad();
    gapi.client.setToken({ access_token: accessToken });
    document.getElementById('signin-btn').style.display = 'none';
    document.getElementById('signout-btn').style.display = 'inline-block';
    await initCalendarId();
    await initData();
  }
});
