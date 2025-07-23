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
    const refresh_token = parsed.refresh_token;

    if (!access_token) {
      console.warn("No access_token found in cookies");
      return null;
    }

    return { access_token, refresh_token };
  } catch (err) {
    console.error("Failed to parse tokens from cookies:", err);
    return null;
  }
}

export function setTokensAsCookies(res, tokens) {
  try {
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      sameSite: 'Lax',
    };

    res.setHeader('Set-Cookie', [
      cookie.serialize('access_token', tokens.access_token, options),
      cookie.serialize('refresh_token', tokens.refresh_token || '', options),
    ]);
  } catch (err) {
    console.error("Failed to serialize tokens to cookie:", err);
  }
}
