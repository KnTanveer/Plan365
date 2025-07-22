import axios from 'axios';
import cookie from 'cookie';

export default async function handler(req, res) {
  const code = req.query.code;

  const { data } = await axios.post('https://oauth2.googleapis.com/token', null, {
    params: {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: 'https://plan365.vercel.app/api/auth/callback',
      grant_type: 'authorization_code'
    }
  });

  res.setHeader('Set-Cookie', [
    cookie.serialize('access_token', data.access_token, {
      httpOnly: true, secure: true, maxAge: 3600, path: '/',
    }),
    cookie.serialize('refresh_token', data.refresh_token || '', {
      httpOnly: true, secure: true, maxAge: 60 * 60 * 24 * 30, path: '/',
    }),
  ]);

  res.redirect('/');
}
