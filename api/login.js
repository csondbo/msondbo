import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

const CONFIG_FILE = path.join(process.cwd(), 'blog-config.json');

// Shared sessions store (in-memory, per function instance)
export const sessions = new Map();

function getPassword() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')).password; }
  catch { return null; }
}

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
    const correct = getPassword();
    if (!correct || body.password !== correct) {
      return res.status(401).json({ error: 'Feil passord' });
    }
    const token = randomBytes(32).toString('hex');
    sessions.set(token, { expires: Date.now() + 8 * 60 * 60 * 1000 });
    return res.status(200).json({ token });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
