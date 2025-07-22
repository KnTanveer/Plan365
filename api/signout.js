import cookie from 'cookie';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isProd = process.env.NODE_ENV === 'production';

  res.setHeader('Set-Cookie', [
    cookie.serialize('access_token', '', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'Lax',
      path: '/',
      maxAge: 0
    }),
    cookie.serialize('refresh_token', '', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'Lax',
      path: '/',
      maxAge: 0
    }),
    cookie.serialize('tokens', '', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'Lax',
      path: '/',
      maxAge: 0
    })
  ]);

  return res.status(200).json({ message: 'Signed out' });
}
