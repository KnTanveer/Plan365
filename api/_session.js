import cookie from "cookie";

export function getTokensFromCookies(req, res) {
  const cookies = cookie.parse(req.headers.cookie || "");

  return {
    access_token: cookies.token,
    refresh_token: cookies.refresh,
  };
}
