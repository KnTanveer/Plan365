import cookie from 'cookie';

export function getTokensFromCookies(req, res) {
  try {
    const cookies = req.headers.cookie;
    if (!cookies) {
      console.warn("No cookies found in request");
      return null;
    }

    const parsed = cookie.parse(cookies);
    const raw = parsed.tokens;

    if (!raw) {
      console.warn("No 'tokens' cookie found");
      return null;
    }

    const tokens = JSON.parse(raw);
    return tokens;
  } catch (err) {
    console.error("Failed to parse tokens from cookies:", err);
    return null;
  }
}

export function setTokensAsCookies(res, tokens) {
  try {
    const serialized = cookie.serialize('tokens', JSON.stringify(tokens), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, 
      sameSite: 'Lax',
    });

    res.setHeader('Set-Cookie', serialized);
  } catch (err) {
    console.error("Failed to serialize tokens to cookie:", err);
  }
}
