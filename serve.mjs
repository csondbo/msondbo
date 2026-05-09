import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

const POSTS_FILE  = path.join(__dirname, 'posts.json');
const CONFIG_FILE = path.join(__dirname, 'blog-config.json');

// In-memory sessions: token -> { expires }
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

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    return res.end();
  }

  // ── API routes ──────────────────────────────────────────

  // POST /api/login
  if (url.pathname === '/api/login' && method === 'POST') {
    const body = await parseBody(req);
    const correct = getPassword();
    if (!correct || body.password !== correct) {
      return json(res, 401, { error: 'Feil passord' });
    }
    const token = randomBytes(32).toString('hex');
    sessions.set(token, { expires: Date.now() + 8 * 60 * 60 * 1000 }); // 8h
    return json(res, 200, { token });
  }

  // POST /api/logout
  if (url.pathname === '/api/logout' && method === 'POST') {
    const auth = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
    sessions.delete(auth);
    return json(res, 200, { ok: true });
  }

  // GET /api/posts
  if (url.pathname === '/api/posts' && method === 'GET') {
    const posts = readPosts();
    const authed = isAuthed(req);
    const visible = authed ? posts : posts.filter(p => p.published);
    return json(res, 200, visible.sort((a, b) => new Date(b.date) - new Date(a.date)));
  }

  // POST /api/posts
  if (url.pathname === '/api/posts' && method === 'POST') {
    if (!isAuthed(req)) return json(res, 401, { error: 'Ikke innlogget' });
    const body = await parseBody(req);
    const posts = readPosts();
    const post = {
      id: randomBytes(8).toString('hex'),
      title:     (body.title   || '').trim(),
      content:   (body.content || '').trim(),
      date:      new Date().toISOString(),
      published: body.published !== false,
      image_url: body.image_url || null,
    };
    posts.unshift(post);
    writePosts(posts);
    return json(res, 201, post);
  }

  // PUT /api/posts/:id
  const putMatch = url.pathname.match(/^\/api\/posts\/([a-z0-9]+)$/);
  if (putMatch && method === 'PUT') {
    if (!isAuthed(req)) return json(res, 401, { error: 'Ikke innlogget' });
    const id = putMatch[1];
    const body = await parseBody(req);
    const posts = readPosts();
    const idx = posts.findIndex(p => p.id === id);
    if (idx === -1) return json(res, 404, { error: 'Ikke funnet' });
    posts[idx] = { ...posts[idx], ...body, id };
    writePosts(posts);
    return json(res, 200, posts[idx]);
  }

  // DELETE /api/posts/:id
  const delMatch = url.pathname.match(/^\/api\/posts\/([a-z0-9]+)$/);
  if (delMatch && method === 'DELETE') {
    if (!isAuthed(req)) return json(res, 401, { error: 'Ikke innlogget' });
    const id = delMatch[1];
    const posts = readPosts();
    const filtered = posts.filter(p => p.id !== id);
    writePosts(filtered);
    return json(res, 200, { ok: true });
  }

  // ── Static files ────────────────────────────────────────
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);

  // Block direct access to config/data files
  const blocked = ['posts.json', 'blog-config.json'];
  if (blocked.some(f => filePath.endsWith(f))) {
    res.writeHead(403); return res.end('Forbidden');
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });

}).listen(PORT, () => console.log(`Serving at http://localhost:${PORT}`));
