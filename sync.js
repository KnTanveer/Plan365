function syncEventToGoogle(event) {
  const authResponse = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse();
  fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tokens: authResponse,
      event: event
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.calendarId) {
      calendarId = data.calendarId;
      localStorage.setItem('plan365_calendar_id', calendarId);
    }
    console.log("Synced to Google via API", data);
  })
  .catch(err => console.error("API Sync error", err));
}
