// server.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const qs = require('querystring');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI;

const tokenStore = new Map(); // TEMP: use a DB/session store in production

// --- PKCE Helpers ---
function base64URLEncode(str) {
  return str.toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateCodeVerifier() {
  return base64URLEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return base64URLEncode(hash);
}

// --- Step 1: Start OAuth flow ---
app.get('/auth/google', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  tokenStore.set(state, { codeVerifier }); // Save verifier for exchange

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + qs.stringify({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
    state,
    access_type: 'offline',
    prompt: 'consent',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  res.redirect(authUrl);
});

app.use(express.json());

function getUserToken(req) {
  const state = req.query.state;
  const session = tokenStore.get(state);
  if (!session || !session.accessToken) throw new Error("No valid session");
  return session.accessToken;
}

// --- Step 2: Callback ---
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  const session = tokenStore.get(state);
  if (!session) return res.status(400).send('Invalid state');

  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', qs.stringify({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: session.codeVerifier
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    // TEMP: Store tokens by session (use proper sessions or DB)
    tokenStore.set(state, {
      ...session,
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiry: Date.now() + response.data.expires_in * 1000
    });

    res.send(`
      <h2>✅ Login successful</h2>
      <p>You may now close this window and return to the app.</p>
      <pre>${JSON.stringify(response.data, null, 2)}</pre>
    `);
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).send('Token exchange failed.');
  }
});

// --- Step 3: Refresh Token Endpoint ---
app.get('/auth/refresh', async (req, res) => {
  const { state } = req.query;
  const session = tokenStore.get(state);
  if (!session?.refreshToken) return res.status(400).send('No refresh token found');

  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', qs.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    tokenStore.set(state, {
      ...session,
      accessToken: response.data.access_token,
      expiry: Date.now() + response.data.expires_in * 1000
    });

    res.json({ access_token: response.data.access_token });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).send('Token refresh failed.');
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// --- GET Events ---
app.get('/api/events', async (req, res) => {
  try {
    const accessToken = getUserToken(req);
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const timeMin = new Date(year, 0, 1).toISOString();
    const timeMax = new Date(year + 1, 0, 1).toISOString();

    const response = await axios.get('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime'
      }
    });

    res.json(response.data.items);
  } catch (err) {
    console.error("Failed to fetch events", err.response?.data || err);
    res.status(500).send("Failed to fetch events");
  }
});

// --- POST Create Event ---
app.post('/api/create-event', async (req, res) => {
  try {
    const accessToken = getUserToken(req);
    const { summary, description, startDate, endDate, recurrence } = req.body;

    const response = await axios.post('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      summary,
      description,
      start: { date: startDate },
      end: { date: new Date(new Date(endDate).getTime() + 86400000).toISOString().split("T")[0] },
      recurrence: recurrence ? [`RRULE:FREQ=${recurrence.toUpperCase()}`] : []
    }, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    res.json(response.data);
  } catch (err) {
    console.error("Failed to create event", err.response?.data || err);
    res.status(500).send("Failed to create event");
  }
});

// --- POST Update Event ---
app.post('/api/update-event', async (req, res) => {
  try {
    const accessToken = getUserToken(req);
    const { eventId, summary, description, startDate, endDate, recurrence } = req.body;

    const response = await axios.put(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      summary,
      description,
      start: { date: startDate },
      end: { date: new Date(new Date(endDate).getTime() + 86400000).toISOString().split("T")[0] },
      recurrence: recurrence ? [`RRULE:FREQ=${recurrence.toUpperCase()}`] : []
    }, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    res.json(response.data);
  } catch (err) {
    console.error("Failed to update event", err.response?.data || err);
    res.status(500).send("Failed to update event");
  }
});

// --- POST Delete Event ---
app.post('/api/delete-event', async (req, res) => {
  try {
    const accessToken = getUserToken(req);
    const { eventId } = req.body;

    await axios.delete(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    res.status(204).send();
  } catch (err) {
    console.error("Failed to delete event", err.response?.data || err);
    res.status(500).send("Failed to delete event");
  }
});
