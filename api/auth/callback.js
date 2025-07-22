import axios from 'axios';

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

  res.setHeader("Set-Cookie", [
    `token=${data.access_token}; Path=/; HttpOnly; Max-Age=3600; SameSite=Lax`,
    `refresh=${data.refresh_token}; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax`
  ]);

  res.redirect('/');
}
