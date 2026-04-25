import fs from 'fs';
import path from 'path';

const POSTS_FILE = path.join(process.cwd(), 'posts.json');

// Shared in-memory sessions (same instance as api/posts.js only if warm — best effort)
const sessions = new Map();

function readPosts() {
  try { return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8')); }
  catch { return []; }
}

function writePosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), 'utf8');
}

function isAuthed(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '').trim();
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expires) { sessions.delete(token); return false; }
  return true;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { id } = req.query;

  if (req.method === 'PUT') {
    if (!isAuthed(req)) return res.status(401).json({ error: 'Ikke innlogget' });
    const body = req.body || {};
    const posts = readPosts();
    const idx = posts.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Ikke funnet' });
    posts[idx] = { ...posts[idx], ...body, id };
    writePosts(posts);
    return res.status(200).json(posts[idx]);
  }

  if (req.method === 'DELETE') {
    if (!isAuthed(req)) return res.status(401).json({ error: 'Ikke innlogget' });
    const posts = readPosts();
    const filtered = posts.filter(p => p.id !== id);
    writePosts(filtered);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
