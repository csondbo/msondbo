import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'POST') {
    const body = req.body || {};
    const hash = process.env.ADMIN_PASSWORD_HASH;
    if (!hash || !body.password) return res.status(401).json({ error: 'Feil passord' });

    const match = await bcrypt.compare(body.password, hash);
    if (!match) return res.status(401).json({ error: 'Feil passord' });

    const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '8h' });
    return res.status(200).json({ token });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
