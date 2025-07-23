import cookie from 'cookie';

export function getTokensFromCookies(req, res) {
  try {
    const cookies = req.headers.cookie;
    if (!cookies) {
      console.warn("No cookies found in request");
      return null;
    }

    const parsed = cookie.parse(cookies);
    const access_token = parsed.access_token;
    const refresh_token = parsed.refresh_token || null;

    if (!access_token) {
      console.warn("No access_token found in cookies");
      return null;
    }

    return { access_token, refresh_token };
  } catch (err) {
    console.error("Failed to parse access token from cookies:", err);
    return null;
  }
}

