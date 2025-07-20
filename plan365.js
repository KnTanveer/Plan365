// --- Constants and State ---
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
const calendarData = new Map();
let calendarId = null;
let accessToken = null;
let tokenClient;
let currentEditingEvent = null;
let showRecurringEvents = true;

function toggleDarkMode() {
  const isDark = document.body.classList.toggle("dark");
  const icon = document.getElementById("theme-toggle-icon");
  if (icon) icon.className = isDark ? "fas fa-moon" : "fas fa-sun";
  localStorage.setItem("theme", isDark ? "dark" : "light");
}

function changeTodayColor(color) {
  document.documentElement.style.setProperty('--today-color', color);
  localStorage.setItem('todayColor', color);

  const colorPicker = document.getElementById('today-color-input');
  if (colorPicker) {
    colorPicker.value = color;
  }
}

function showSpinner(show) {
  const spinner = document.getElementById("spinner");
  if (spinner) spinner.style.display = show ? "block" : "none";
}

function smoothScrollCalendar(delta) {
  const container = document.getElementById("calendar");
  if (!container) return;
  container.scrollBy({ left: delta, behavior: "smooth" });
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

//font selector 
const fontSearchInput = document.getElementById("font-search");
const fontDropdown = document.getElementById("font-dropdown");
const fontList = [
  // System fonts
  "Arial", "Verdana", "Tahoma", "Trebuchet MS", "Times New Roman", "Georgia",
  "Courier New", "Lucida Console", "Impact", "Palatino Linotype", "Segoe UI",
  "Franklin Gothic Medium", "Comic Sans MS", "Calibri", "Helvetica", "Optima",
  "Candara", "Century Gothic", "Geneva",
  // Popular Google Fonts
  "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Oswald", "Raleway",
  "Merriweather", "Nunito", "Playfair Display", "Rubik", "Inter", "Work Sans",
  "Noto Sans", "Fira Sans", "DM Sans", "PT Sans", "Quicksand", "Source Sans Pro",
  "Titillium Web", "Cabin", "Ubuntu", "Arimo", "Space Grotesk", "Manrope",
  "Teko", "Anton", "Archivo", "Lexend", "Prompt", "Dosis", "Josefin Sans",
  "Zilla Slab", "Chakra Petch", "Sora", "Cairo", "Barlow", "Bitter", "Exo",
  "Mukta", "Heebo", "Asap", "Catamaran", "Crimson Text", "Overpass", "Muli",
  "Bebas Neue", "Signika", "Kanit", "Tajawal", "Assistant"
];

const googleFontsSet = new Set(fontList.slice(20)); // Google Fonts only from index 20 onward

function loadGoogleFont(font) {
  if (!googleFontsSet.has(font)) return;
  const id = "dynamic-font";
  let existing = document.getElementById(id);
  if (existing) existing.remove();

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, "+")}&display=swap`;
  document.head.appendChild(link);
}

function applyFont(font) {
  if (!fontList.includes(font)) return;
  loadGoogleFont(font);
  document.body.style.fontFamily = `'${font}', sans-serif`;
  localStorage.setItem("preferredFont", font);
}

function updateDropdown(query = "") {
  fontDropdown.innerHTML = "";
  const filtered = fontList.filter(f => f.toLowerCase().includes(query.toLowerCase()));
  filtered.forEach(font => {
    const item = document.createElement("div");
    item.textContent = font;
    item.style.fontFamily = `'${font}', sans-serif`;
    item.onclick = () => {
      fontSearchInput.value = font;
      applyFont(font);
      fontDropdown.classList.add("hidden");
    };
    fontDropdown.appendChild(item);
  });
  fontDropdown.classList.toggle("hidden", filtered.length === 0);
}

fontSearchInput.addEventListener("input", () => {
  updateDropdown(fontSearchInput.value);
});

fontSearchInput.addEventListener("focus", () => {
  updateDropdown(fontSearchInput.value);
});

document.addEventListener("click", (e) => {
  if (!document.getElementById("font-picker-container").contains(e.target)) {
    fontDropdown.classList.add("hidden");
  }
});

window.addEventListener("load", () => {
  const saved = localStorage.getItem("preferredFont");
  if (saved && fontList.includes(saved)) {
    fontSearchInput.value = saved;
    applyFont(saved);
  }
});

function openModal(dateStr, event = null) {
  document.getElementById("start-date").value = event ? event.range.start : dateStr;
  document.getElementById("end-date").value = event ? event.range.end : dateStr;
  document.getElementById("note-text").value = event ? event.text.replace(/↻$/, '').trim() : "";
  document.getElementById("event-color").value = event ? event.color : (localStorage.getItem("lastColor") || "#b6eeb6");
  document.getElementById("repeat-select").value = event?.recurrenceType || "";
  document.getElementById("duration-display").textContent = "";
  document.getElementById("delete-btn").style.display = event ? "inline-block" : "none";
  currentEditingEvent = event;
  document.getElementById("modal").style.display = "flex";
}

function closeModal() {
  const modal = document.getElementById("modal");
  const content = document.getElementById("modal-content"); // Ensure modal-content exists
  if (modal && content) {
    content.classList.add("fade-out");
    modal.classList.add("fade-out");
    content.addEventListener("animationend", () => {
      content.classList.remove("fade-out");
      modal.classList.remove("fade-out");
      modal.style.display = "none";
      currentEditingEvent = null;
    }, { once: true });
  } else {
    modal.style.display = "none";
    currentEditingEvent = null;
  }
}

function closeSettings() {
  const panel = document.getElementById("settings-panel");
  const overlay = document.getElementById("settings-overlay");
  if (panel && overlay) {
    panel.classList.add("fade-out");
    overlay.classList.add("fade-out");
    panel.addEventListener("animationend", () => {
      panel.classList.remove("fade-out");
      overlay.classList.remove("fade-out");
      overlay.style.display = "none";
    }, { once: true });
  }
}

async function saveNote() {
  const start = document.getElementById("start-date").value;
  const end = document.getElementById("end-date").value;
  const text = document.getElementById("note-text").value;
  const color = document.getElementById("event-color").value;
  const recurrence = document.getElementById("repeat-select").value;

  if (!start || !end || !text) return alert("Please fill all fields");

  const metadata = JSON.stringify({ color, recurrence });
  const recurrenceRule = recurrence ? [`RRULE:FREQ=${recurrence}`] : undefined;
  localStorage.setItem("lastColor", color);

  const cleanText = text.replace(/↻/g, "").trim();
  const displayText = recurrence ? `${cleanText} ↻` : cleanText;

  if (currentEditingEvent) {
    try {
      const fullEvent = await gapi.client.calendar.events.get({ calendarId, eventId: currentEditingEvent.googleId });
      const masterId = fullEvent.result.recurringEventId || fullEvent.result.id;
      await gapi.client.calendar.events.delete({ calendarId, eventId: masterId });
    } catch (e) {
      console.error("Failed to delete previous event:", e);
    }
  }

  await gapi.client.calendar.events.insert({
    calendarId,
    resource: {
      summary: displayText,
      description: metadata,
      start: { date: start },
      end: { date: new Date(new Date(end).getTime() + 86400000).toISOString().split("T")[0] },
      recurrence: recurrenceRule || []
    }
  });

  closeModal();
  await initData();
}

async function deleteCurrentEvent() {
  if (!currentEditingEvent) return;
  const isRecurring = currentEditingEvent.recurrenceType != null;
  const deleteWholeSeries = isRecurring ? await showDeleteChoiceModal() : false;
  try {
    let eventIdToDelete = currentEditingEvent.googleId;
    if (deleteWholeSeries) {
      const fullEvent = await gapi.client.calendar.events.get({ calendarId, eventId: eventIdToDelete });
      if (fullEvent.result.recurringEventId) {
        eventIdToDelete = fullEvent.result.recurringEventId;
      }
    }
    await gapi.client.calendar.events.delete({ calendarId, eventId: eventIdToDelete });
  } catch (e) {
    console.error("Failed to delete event:", e);
    alert("Could not delete event.");
  }
  closeModal();
  await initData();
}

function createCalendar() {
  const container = document.getElementById("calendar");
  if (!container) return;
  container.innerHTML = "";
  document.getElementById("year-label").textContent = `${currentYear}`;

  for (let month = 0; month < 12; month++) {
    const col = document.createElement("div");
    col.className = "month-column";

    const header = document.createElement("h3");
    header.textContent = new Date(currentYear, month).toLocaleString("default", { month: "long" });
    header.style.cursor = "pointer";

    const daysWrapper = document.createElement("div");
    daysWrapper.className = "days-wrapper";

    header.onclick = () => {
      daysWrapper.style.display = daysWrapper.style.display === "none" ? "block" : "none";
    };

    const daysInMonth = new Date(currentYear, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const cell = document.createElement("div");
      cell.className = "day-cell";
      if (dateStr === new Date().toISOString().split("T")[0]) cell.classList.add("today");
      cell.innerHTML = `<div class='day-label'>${day}</div>`;
      if (calendarData.has(dateStr)) {
        calendarData.get(dateStr).forEach(e => {
          const n = document.createElement("div");
          n.className = "note-text";
          n.style.background = e.color;
          n.textContent = e.text;
          n.onclick = event => { event.stopPropagation(); openModal(dateStr, e); };
          cell.appendChild(n);
        });
      }
      cell.onclick = () => openModal(dateStr);
      daysWrapper.appendChild(cell);
    }

    col.appendChild(header);
    col.appendChild(daysWrapper);
    container.appendChild(col);
  }
}

function changeYear(delta) {
  const calendar = document.getElementById("calendar");
  if (calendar) {
    calendar.style.opacity = 0;
    setTimeout(() => {
      currentYear += delta;
      initData().then(() => {
        calendar.style.opacity = 1;
      });
    }, 200);
  } else {
    currentYear += delta;
    initData();
  }
}

function goToToday() {
  currentYear = new Date().getFullYear();
  currentMonth = new Date().getMonth();
  initData();
}

async function initCalendarId() {
  const result = await gapi.client.calendar.calendarList.list();
  const exists = result.result.items.find(c => c.summary === "Plan365");
  calendarId = exists ? exists.id : (await gapi.client.calendar.calendars.insert({ summary: "Plan365" })).result.id;
}

async function initData() {
  if (!calendarId) return;
  showSpinner(true);
  const timeMin = new Date(currentYear, 0, 1).toISOString();
  const timeMax = new Date(currentYear + 1, 0, 1).toISOString();

  try {
    const response = await gapi.client.calendar.events.list({
      calendarId, timeMin, timeMax, showDeleted: false,
      singleEvents: true, orderBy: "startTime"
    });

    calendarData.clear();

    response.result.items.forEach(ev => {
      const start = ev.start?.date;
      const endRaw = ev.end?.date;
      if (!start || !endRaw) return;

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
            googleId: ev.id + `_repeat_${i}`,
            recurrenceType: metadata.recurrence || null
          };
          addToRange(eventCopy);
        }
      };

      if (rrule.startsWith("RRULE:FREQ=YEARLY")) return staticize(5, (d, i) => d.setFullYear(d.getFullYear() + i));
      if (rrule.startsWith("RRULE:FREQ=MONTHLY")) return staticize(6, (d, i) => d.setMonth(d.getMonth() + i));
      if (rrule.startsWith("RRULE:FREQ=WEEKLY")) return staticize(8, (d, i) => d.setDate(d.getDate() + 7 * i));
      if (rrule) return;

      const endDateObj = new Date(endRaw);
      if (isNaN(endDateObj.getTime())) return;
      endDateObj.setDate(endDateObj.getDate() - 1);
      const newEvent = {
        text: ev.summary,
        color,
        range: { start, end: endDateObj.toISOString().split("T")[0] },
        googleId: ev.id,
        recurrenceType: metadata.recurrence || null
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
  } finally {
    showSpinner(false);
  }
}

function toggleRecurringEvents() {
  showRecurringEvents = !showRecurringEvents;
  document.getElementById("toggle-recurring-btn").textContent = showRecurringEvents ? "Hide Recurring" : "Show Recurring";
  initData();
}

// --- Auth and Startup ---
function handleSignIn() {
  tokenClient.requestAccessToken();
}

function handleSignOut() {
  if (accessToken) {
    gapi.client.setToken(null);
    google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
      calendarId = null;
      document.getElementById("signin-btn").style.display = "inline-block";
      document.getElementById("signout-btn").style.display = "none";
      calendarData.clear();
      createCalendar();
    });
  }
}

function gapiLoad() {
  return new Promise(resolve => {
    gapi.load("client", async () => {
      await gapi.client.init({
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"]
      });
      resolve();
    });
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  // Theme handling
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
  }

  const themeIcon = document.getElementById("theme-toggle-icon");
  if (themeIcon) {
    themeIcon.className = savedTheme === "dark" ? "fas fa-moon" : "fas fa-sun";
  }

  const storedColor = localStorage.getItem("todayColor");
  if (storedColor) {
    changeTodayColor(storedColor);
    const picker = document.getElementById("today-color-input");
    if (picker) picker.value = storedColor;
  }

  await gapiLoad();

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: '943003293805-j19ek1k66uvh8s2q7dd4hsvtimf516jv.apps.googleusercontent.com',
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
    callback: async (tokenResponse) => {
      accessToken = tokenResponse.access_token;
      gapi.client.setToken({ access_token: accessToken });

      document.getElementById("signin-btn").style.display = "none";
      document.getElementById("signout-btn").style.display = "inline-block";

      setInterval(() => {
        tokenClient.requestAccessToken({ prompt: '' });
      }, 55 * 60 * 1000);

      await initCalendarId();
      await initData();
    },
  });

  tokenClient.requestAccessToken({ prompt: '' });
});

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") smoothScrollCalendar(100);
  if (e.key === "ArrowLeft") smoothScrollCalendar(-100);
});

function showDeleteChoiceModal() {
  return new Promise(resolve => {
    const modal = document.getElementById("delete-modal");
    const deleteAllBtn = document.getElementById("delete-all-btn");
    const deleteInstanceBtn = document.getElementById("delete-instance-btn");

    modal.style.display = "flex";

    const cleanup = () => {
      modal.style.display = "none";
      deleteAllBtn.removeEventListener("click", handleAll);
      deleteInstanceBtn.removeEventListener("click", handleInstance);
    };

    const handleAll = () => {
      cleanup();
      resolve(true); // delete all
    };

    const handleInstance = () => {
      cleanup();
      resolve(false); // delete only one
    };

    deleteAllBtn.addEventListener("click", handleAll);
    deleteInstanceBtn.addEventListener("click", handleInstance);
  });
}

function closeDeleteModal() {
  document.getElementById('delete-modal').style.display = 'none';
}

window.toggleRecurringEvents = toggleRecurringEvents;
window.handleSignIn = handleSignIn;
window.handleSignOut = handleSignOut;
window.toggleDarkMode = toggleDarkMode;
