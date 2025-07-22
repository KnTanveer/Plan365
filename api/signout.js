import cookie from 'cookie';

export default function handler(req, res) {
  res.setHeader('Set-Cookie', [
    cookie.serialize('access_token', '', {
      httpOnly: true, secure: true, expires: new Date(0), path: '/',
    }),
    cookie.serialize('refresh_token', '', {
      httpOnly: true, secure: true, expires: new Date(0), path: '/',
    }),
  ]);

  res.redirect('/');
}
