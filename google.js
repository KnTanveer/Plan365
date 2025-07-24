import { google } from "googleapis";

export function getSessionClient(tokens) {
  const { client_id, client_secret, redirect_uris } = getGoogleConfig();

  if (!client_id || !client_secret || !redirect_uris[0]) {
    console.error("Missing Google OAuth environment variables");
    throw new Error("Google OAuth config is incomplete");
  }

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  oAuth2Client.setCredentials(tokens);
  return oAuth2Client;
}

function getGoogleConfig() {
  return {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uris: [process.env.REDIRECT_URI],
  };
}
