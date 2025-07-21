import cookie from 'cookie';

export default function handler(req, res) {
  res.setHeader('Set-Cookie', cookie.serialize('token', '', {
    path: '/',
    expires: new Date(0),
  }));
  res.redirect('/');
}
