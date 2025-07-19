// --- Constants and State ---
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let calendarData = {};
let calendarId = null;
let accessToken = null;
let tokenClient;
let currentEditingEvent = null;
let showRecurringEvents = true;
let editMode = "all"; // default mode for editing recurring events

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
  document.getElementById("event-color").value = event ? event.color : (localStorage.getItem("lastColor") || "#b6eeb6");
  document.getElementById("repeat-select").value = event?.recurrenceType || "";
  document.getElementById("duration-display").textContent = "";
  document.getElementById("delete-btn").style.display = event ? "inline-block" : "none";
  currentEditingEvent = event;
  document.getElementById("modal").style.display = "flex";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
  currentEditingEvent = null;
  editMode = "all";
}

function openEditModePopup(callback) {
  const choice = prompt("Edit which events?\n- all\n- future\n- only this\n(Type exactly)", "all");
  if (["all", "future", "only this"].includes(choice)) {
    editMode = choice;
    callback();
  } else {
    alert("Invalid option. Please type 'all', 'future', or 'only this'.");
  }
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
  localStorage.setItem("lastColor", color);

  if (currentEditingEvent) {
    const baseId = currentEditingEvent.googleId.split("_repeat_")[0];
    if (editMode === "only this") {
      await gapi.client.calendar.events.insert({
        calendarId,
        resource: {
          summary: text,
          description: metadata,
          start: { date: start },
          end: { date: new Date(new Date(end).getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0] },
          recurrence: recurrenceRule || []
        }
      });
    } else {
      // Delete original recurring event first
      await gapi.client.calendar.events.delete({
        calendarId,
        eventId: baseId
      });

      // Then reinsert as updated recurring event from new start
      await gapi.client.calendar.events.insert({
        calendarId,
        resource: {
          summary: text,
          description: metadata,
          start: { date: start },
          end: { date: new Date(new Date(end).getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0] },
          recurrence: recurrenceRule || []
        }
      });
    }
  } else {
    await gapi.client.calendar.events.insert({
      calendarId,
      resource: {
        summary: text,
        description: metadata,
        start: { date: start },
        end: { date: new Date(new Date(end).getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0] },
        recurrence: recurrenceRule || []
      }
    });
  }

  closeModal();
  await initData();
}

async function deleteCurrentEvent() {
  if (!currentEditingEvent) return;
  const baseId = currentEditingEvent.googleId.split("_repeat_")[0];
  const choice = prompt("Delete which events?\n- all\n- future\n- only this\n(Type exactly)", "all");

  if (choice === "all") {
    await gapi.client.calendar.events.delete({
      calendarId,
      eventId: baseId
    });
  } else if (choice === "only this") {
    alert("This feature is not fully supported via Google Calendar API. Consider hiding this instance manually.");
  } else if (choice === "future") {
    alert("Partial delete (future only) is not supported via API. Full event will be removed.");
  } else {
    return alert("Invalid choice");
  }

  closeModal();
  await initData();
}

// Smooth horizontal scrolling
window.addEventListener("keydown", (e) => {
  const container = document.getElementById("calendar");
  if (!container) return;
  container.style.scrollBehavior = "smooth";
  if (e.key === "ArrowRight") container.scrollLeft += 200;
  if (e.key === "ArrowLeft") container.scrollLeft -= 200;
});
