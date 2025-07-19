// --- Constants and State ---
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let calendarData = new Map(); // ✅ Use Map
let calendarId = null;
let accessToken = null;
let tokenClient;
let currentEditingEvent = null;
let showRecurringEvents = true;
let lastScroll = 0;

function showSpinner(show) {
  const spinner = document.getElementById("spinner");
  if (spinner) spinner.style.display = show ? "block" : "none";
}

function smoothScrollCalendar(delta) {
  const container = document.getElementById("calendar");
  if (!container) return;
  container.scrollBy({ left: delta, behavior: "smooth" });
}

function throttledScroll(delta) {
  const now = Date.now();
  if (now - lastScroll > 100) {
    smoothScrollCalendar(delta);
    lastScroll = now;
  }
}

function addToRange(event) {
  if (!showRecurringEvents && event.recurrenceType) return;
  const start = new Date(event.range.start);
  const end = new Date(event.range.end);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    if (!calendarData.has(key)) calendarData.set(key, []);
    calendarData.get(key).push(event);
  }
}

function renderDaysForMonth(wrapper, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().split("T")[0];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = document.createElement("div");
    cell.className = "day-cell";
    if (dateStr === todayStr) cell.classList.add("today");
    cell.innerHTML = `<div class='day-label'>${day}</div>`;
    const events = calendarData.get(dateStr);
    if (events) {
      events.forEach(e => {
        const n = document.createElement("div");
        n.className = "note-text";
        n.style.background = e.color;
        n.textContent = e.text;
        n.onclick = event => { event.stopPropagation(); openModal(dateStr, e); };
        cell.appendChild(n);
      });
    }
    cell.onclick = () => openModal(dateStr);
    wrapper.appendChild(cell);
  }
}

function createCalendar() {
  const container = document.getElementById("calendar");
  if (!container) return;
  container.innerHTML = "";
  document.getElementById("year-label").textContent = `${currentYear}`;
  const calendarFragment = document.createDocumentFragment();

  for (let month = 0; month < 12; month++) {
    const col = document.createElement("div");
    col.className = "month-column";

    const header = document.createElement("h3");
    header.textContent = new Date(currentYear, month).toLocaleString("default", { month: "long" });
    header.style.cursor = "pointer";

    const daysWrapper = document.createElement("div");
    daysWrapper.className = "days-wrapper";
    daysWrapper.style.display = "none";

    header.onclick = () => {
      if (daysWrapper.children.length === 0) {
        renderDaysForMonth(daysWrapper, currentYear, month); // ✅ Lazy rendering
      }
      daysWrapper.style.display = daysWrapper.style.display === "none" ? "block" : "none";
    };

    col.appendChild(header);
    col.appendChild(daysWrapper);
    calendarFragment.appendChild(col);
  }

  container.appendChild(calendarFragment);
}

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") throttledScroll(100);
  if (e.key === "ArrowLeft") throttledScroll(-100);
});

window.addEventListener("DOMContentLoaded", async () => {
  const config = {
    theme: localStorage.getItem("theme"),
    accessToken: localStorage.getItem("accessToken"),
    lastColor: localStorage.getItem("lastColor")
  };

  if (config.theme === "dark") document.body.classList.add("dark");

  const btn = document.createElement("button");
  btn.id = "toggle-recurring-btn";
  btn.textContent = showRecurringEvents ? "Hide Recurring" : "Show Recurring";
  btn.onclick = toggleRecurringEvents;
  document.body.insertBefore(btn, document.body.firstChild);

  if (config.accessToken) {
    accessToken = config.accessToken;
    await gapiLoad();
    gapi.client.setToken({ access_token: accessToken });
    document.getElementById('signin-btn').style.display = 'none';
    document.getElementById('signout-btn').style.display = 'inline-block';
    setInterval(() => tokenClient?.requestAccessToken({ prompt: '' }), 55 * 60 * 1000);
    await initCalendarId();
    await initData();
  }
});
