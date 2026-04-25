import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://xxhpphnpgsswcosogwab.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY env var first');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const posts = JSON.parse(readFileSync('./posts.json', 'utf8'));

const rows = posts.map(p => ({
  title:     p.title,
  content:   p.content,
  date:      p.date,
  published: p.published,
}));

const { data, error } = await supabase.from('posts').insert(rows).select();
if (error) { console.error('Migration failed:', error.message); process.exit(1); }
console.log(`Migrated ${data.length} posts.`);
