import cookie from "cookie";

export function getTokensFromCookies(req, res) {
  const cookies = cookie.parse(req.headers.cookie || "");
  try {
    return JSON.parse(cookies.tokens || "{}");
  } catch {
    return {};
  }
}
