import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

const POSTS_FILE = path.join(process.cwd(), 'posts.json');
const CONFIG_FILE = path.join(process.cwd(), 'blog-config.json');

// In-memory sessions (per function instance — not persistent across requests)
const sessions = new Map();

function readPosts() {
  try { return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8')); }
  catch { return []; }
}

function writePosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), 'utf8');
}

function getPassword() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')).password; }
  catch { return null; }
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

  if (req.method === 'GET') {
    const posts = readPosts();
    const authed = isAuthed(req);
    const visible = authed ? posts : posts.filter(p => p.published);
    return res.status(200).json(visible.sort((a, b) => new Date(b.date) - new Date(a.date)));
  }

  if (req.method === 'POST') {
    if (!isAuthed(req)) return res.status(401).json({ error: 'Ikke innlogget' });
    const body = req.body || {};
    const posts = readPosts();
    const post = {
      id: randomBytes(8).toString('hex'),
      title:     (body.title   || '').trim(),
      content:   (body.content || '').trim(),
      date:      new Date().toISOString(),
      published: body.published !== false,
    };
    posts.unshift(post);
    writePosts(posts);
    return res.status(201).json(post);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
