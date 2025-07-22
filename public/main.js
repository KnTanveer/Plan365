// --- Constants and State ---
let hiddenMonths = new Set(JSON.parse(localStorage.getItem("hiddenMonths") || "[]"));
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

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", isDark ? "#121212" : "#ffffff");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme");
  const isDark = savedTheme === "dark";
  if (isDark) document.body.classList.add("dark");

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", isDark ? "#121212" : "#ffffff");
  }

  const icon = document.getElementById("theme-toggle-icon");
  if (icon) icon.className = isDark ? "fas fa-moon" : "fas fa-sun";
});

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

// --- Auth and Startup ---
function handleLogin() {
  window.location.href = "/api/auth";
}

function handleLogout() {
  window.location.href = "/api/signout";
}

async function fetchEvents() {
  const res = await fetch("/api/events", { credentials: "include" });
  const out = document.getElementById("output");

  if (!res.ok) {
    out.textContent = "Session expired or unauthorized. Please sign in again.";
    return;
  }

  const data = await res.json();
  out.textContent = JSON.stringify(data.items, null, 2);
}

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") smoothScrollCalendar(100);
  if (e.key === "ArrowLeft") smoothScrollCalendar(-100);
});

const storedColor = localStorage.getItem("todayColor");
if (storedColor) {
  document.documentElement.style.setProperty('--today-color', storedColor);
  const picker = document.getElementById("today-color-input");
  if (picker) picker.value = storedColor;
}

window.addEventListener("DOMContentLoaded", async () => {
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
    const input = document.getElementById("today-color-input");
    if (input) input.value = storedColor;
  }

  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) loginBtn.addEventListener("click", handleLogin);

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  setInterval(() => tokenClient?.requestAccessToken({ prompt: '' }), 55 * 60 * 1000);

  await initData();
});

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
const fontReset = document.getElementById("font-reset");

const fontList = [
  // Sans-Serif
  "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Inter", "Noto Sans",
  "Work Sans", "Ubuntu", "Fira Sans", "DM Sans", "Mulish", "Assistant",
  "Barlow", "Rubik", "Titillium Web", "Cabin", "Asap", "Questrial", "Manrope",

  // Serif
  "Merriweather", "Playfair Display", "Lora", "Crimson Text", "Cormorant",
  "Zilla Slab", "Tinos", "EB Garamond", "Domine", "PT Serif", "Tangerine",

  // Display
  "Oswald", "Anton", "Bebas Neue", "Alfa Slab One", "Black Ops One",
  "Bangers", "Righteous", "Permanent Marker", "Passion One",

  // Handwriting / Calligraphy
  "Dancing Script", "Pacifico", "Satisfy", "Great Vibes", "Cookie",
  "Kaushan Script", "Caveat", "Shadows Into Light", "Indie Flower",

  // Monospace
  "Courier New", "Fira Code", "JetBrains Mono", "Source Code Pro",
  "IBM Plex Mono", "Inconsolata", "Lucida Console",

  // System Fonts
  "Arial", "Verdana", "Tahoma", "Trebuchet MS", "Times New Roman", "Georgia",
  "Impact", "Palatino Linotype", "Segoe UI", "Comic Sans MS", "Helvetica",
  "Optima", "Candara", "Geneva", "Century Gothic"
];

const systemFonts = new Set([
  "Arial", "Verdana", "Tahoma", "Trebuchet MS", "Times New Roman", "Georgia",
  "Courier New", "Lucida Console", "Impact", "Palatino Linotype", "Segoe UI",
  "Comic Sans MS", "Helvetica", "Optima", "Candara", "Geneva", "Century Gothic"
]);

const googleFontsSet = new Set(fontList.filter(f => !systemFonts.has(f)));
let currentFontList = [];

function loadGoogleFont(font) {
  if (!googleFontsSet.has(font)) return;
  const id = "dynamic-font";
  const existing = document.getElementById(id);
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
  document.body.style.fontFamily = `"${font}", sans-serif`;
  localStorage.setItem("preferredFont", font);
}

function selectFont(font) {
  fontSearchInput.value = font;
  applyFont(font);
  fontDropdown.classList.add("hidden"); 
}

function clearHighlights() {
  const items = fontDropdown.querySelectorAll("div");
  items.forEach(item => item.classList.remove("highlighted"));
}

function updateDropdown(query = "") {
  fontDropdown.innerHTML = "";
  currentFontList = fontList.filter(f => f.toLowerCase().includes(query.toLowerCase()));
  currentFontList.forEach((font) => {
    const item = document.createElement("div");
    item.textContent = font;
    item.style.fontFamily = `'${font}', sans-serif`;
    item.addEventListener("mouseenter", () => clearHighlights());
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectFont(font);
    });
    fontDropdown.appendChild(item);
  });

  fontDropdown.classList.toggle("hidden", currentFontList.length === 0);
}

fontSearchInput.addEventListener("input", () => {
  updateDropdown(fontSearchInput.value);
});

fontSearchInput.addEventListener("focus", () => {
  updateDropdown(fontSearchInput.value);
});

fontSearchInput.addEventListener("click", (e) => {
  e.stopPropagation();
  updateDropdown(fontSearchInput.value); 
});

fontSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && currentFontList.length > 0) {
    e.preventDefault();
    selectFont(currentFontList[0]);
  }
});

fontReset.addEventListener("click", () => {
  fontSearchInput.value = "";
  fontDropdown.classList.add("hidden");
  document.body.style.fontFamily = "";
  localStorage.removeItem("preferredFont");
});

document.addEventListener("click", (e) => {
  const container = document.getElementById("font-picker-container");
  if (container && !container.contains(e.target)) {
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
    await deleteEventById(currentEditingEvent.googleId, currentEditingEvent.recurrenceType);
  }

  await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: displayText,
      description: metadata,
      start,
      end: new Date(new Date(end).getTime() + 86400000).toISOString().split("T")[0],
      recurrence: recurrenceRule
    })
  });

  closeModal();
  await initData();
}

async function deleteCurrentEvent() {
  if (!currentEditingEvent) return;

  const isRecurring = currentEditingEvent.recurrenceType != null;
  const deleteWholeSeries = isRecurring ? await showDeleteChoiceModal() : false;
  let eventIdToDelete = currentEditingEvent.googleId;

  if (deleteWholeSeries) {
    const full = await fetch(`/api/events?id=${eventIdToDelete}`);
    const data = await full.json();
    if (data.recurringEventId) {
      eventIdToDelete = data.recurringEventId;
    }
  }

  await fetch("/api/events", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId: eventIdToDelete })
  });

  closeModal();
  await initData();
}

function createCalendar() {
  const container = document.getElementById("calendar");
  if (!container) return;

  container.innerHTML = "";
  document.getElementById("year-label").textContent = `${currentYear}`;

  for (let month = 0; month < 12; month++) {
    if (hiddenMonths.has(month)) continue;

    const col = document.createElement("div");
    col.className = "month-column";

    const header = document.createElement("h3");
    header.textContent = new Date(currentYear, month).toLocaleString("default", { month: "long" });
    header.style.cursor = "pointer";

    const daysWrapper = document.createElement("div");
    daysWrapper.className = "days-wrapper";

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
          n.onclick = event => {
            event.stopPropagation();
            openModal(dateStr, e);
          };
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

function syncHiddenMonthsFromCheckboxes() {
  hiddenMonths.clear();
  document.querySelectorAll('#month-popup input[type="checkbox"]').forEach(cb => {
    if (cb.checked) hiddenMonths.add(parseInt(cb.value));
  });
  localStorage.setItem("hiddenMonths", JSON.stringify([...hiddenMonths]));
  createCalendar();
}

function syncCheckboxesFromHiddenMonths() {
  document.querySelectorAll('#month-popup input[type="checkbox"]').forEach(cb => {
    cb.checked = hiddenMonths.has(parseInt(cb.value));
  });
}

document.addEventListener('DOMContentLoaded', function () {
  const toggle = document.getElementById('month-popup-toggle');
  const popup = document.getElementById('month-popup');
  const restore = document.getElementById('restore-months-btn');

  if (toggle && popup && restore) {
    toggle.addEventListener('click', () => {
      popup.classList.toggle('hidden');
    });

    restore.addEventListener('click', () => {
      document.querySelectorAll('#month-popup input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });
      syncHiddenMonthsFromCheckboxes();
    });

    document.addEventListener('click', function (e) {
      const popup = document.getElementById('month-popup');
      const toggle = document.getElementById('month-popup-toggle');
    
      if (
        popup &&
        !popup.classList.contains('hidden') &&
        !popup.contains(e.target) &&
        e.target !== toggle &&
        !toggle.contains(e.target)
      ) {
        popup.classList.add('hidden');
      }
    });

    document.querySelectorAll('#month-popup input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', syncHiddenMonthsFromCheckboxes);
    });
  }

  syncCheckboxesFromHiddenMonths();
  createCalendar();
});

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

async function initData() {
  showSpinner(true);
  calendarData.clear();

  try {
    const response = await fetch("/api/events", { credentials: "include" });
    if (!response.ok) throw new Error("Failed to fetch events");

    const result = await response.json();
    const year = new Date().getFullYear();

    result.items.forEach(ev => {
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
    alert("Session expired. Please sign in again.");
    handleLogout();
  } finally {
    showSpinner(false);
  }
}

async function deleteEventById(id, recurrenceType) {
  try {
    let realId = id;

    if (recurrenceType) {
      const res = await fetch(`/api/events?id=${id}`);
      const data = await res.json();
      if (data.recurringEventId) {
        realId = data.recurringEventId;
      }
    }

    await fetch("/api/events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: realId })
    });
  } catch (e) {
    console.warn("Failed to delete event:", e);
  }
}

function toggleRecurringEvents() {
  showRecurringEvents = !showRecurringEvents;

  const button = document.getElementById("toggle-recurring-btn");

  const icon = document.createElement("i");
  icon.className = "fas fa-sync-alt fa-spin";
  icon.style.marginRight = "5px";

  const label = document.createTextNode(showRecurringEvents ? "Hide Recurring" : "Show Recurring");

  button.innerHTML = "";
  button.appendChild(icon);
  button.appendChild(label);

  setTimeout(() => {
    icon.classList.remove("fa-spin");
  }, 1000);

  initData();
}

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
      resolve(true); 
    };

    const handleInstance = () => {
      cleanup();
      resolve(false); 
    };

    deleteAllBtn.addEventListener("click", handleAll);
    deleteInstanceBtn.addEventListener("click", handleInstance);
  });
}

function closeDeleteModal() {
  document.getElementById('delete-modal').style.display = 'none';
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (registration) {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, function (err) {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

window.toggleRecurringEvents = toggleRecurringEvents;
window.toggleDarkMode = toggleDarkMode;
