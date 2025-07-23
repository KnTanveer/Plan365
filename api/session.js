import cookie from 'cookie';

export function getTokensFromCookies(req, res) {
  try {
    const cookies = req.headers.cookie;
    if (!cookies) {
      console.warn("No cookies found in request");
      return null;
    }

    const parsed = cookie.parse(cookies);
    const tokenString = parsed.tokens;

    if (!tokenString) {
      console.warn("No 'tokens' cookie found");
      return null;
    }

    const tokens = JSON.parse(tokenString);

    if (!tokens.access_token) {
      console.warn("No access_token found in tokens cookie");
      return null;
    }

    return tokens;
  } catch (err) {
    console.error("Failed to parse tokens from cookies:", err);
    return null;
  }
}
