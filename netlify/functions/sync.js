import { getStore } from '@netlify/blobs';

const STORE_NAME = 'elev8-prompter';
const KEY = 'shared-v1';

export default async (request) => {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method === 'GET') {
    const data = await store.get(KEY, { type: 'json' });
    return new Response(JSON.stringify(data || { updatedAt: 0, scripts: [], settings: null, keymap: null, tombstones: [] }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'PUT') {
    let incoming;
    try {
      incoming = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'invalid json' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    const current = (await store.get(KEY, { type: 'json' })) || { updatedAt: 0, scripts: [], settings: null, keymap: null, tombstones: [] };
    const merged = mergeDocs(current, incoming);
    await store.setJSON(KEY, merged);
    return new Response(JSON.stringify(merged), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  return new Response('method not allowed', { status: 405, headers: cors });
};

function mergeDocs(a, b) {
  const byId = new Map();
  for (const s of a.scripts || []) byId.set(s.id, s);
  for (const s of b.scripts || []) {
    const existing = byId.get(s.id);
    if (!existing || (s.updatedAt || 0) >= (existing.updatedAt || 0)) byId.set(s.id, s);
  }

  const tombMap = new Map();
  for (const t of [...(a.tombstones || []), ...(b.tombstones || [])]) {
    const prev = tombMap.get(t.id);
    if (!prev || (t.deletedAt || 0) > (prev.deletedAt || 0)) tombMap.set(t.id, t);
  }
  for (const [id, t] of tombMap) {
    const s = byId.get(id);
    if (s && (t.deletedAt || 0) > (s.updatedAt || 0)) byId.delete(id);
  }

  const CUTOFF = Date.now() - 1000 * 60 * 60 * 24 * 30;
  const tombstones = [...tombMap.values()].filter(t => (t.deletedAt || 0) > CUTOFF);

  const pickNewer = (x, y) => {
    if (!x) return y || null;
    if (!y) return x;
    return (y.updatedAt || 0) > (x.updatedAt || 0) ? y : x;
  };

  return {
    updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0, Date.now()),
    scripts: [...byId.values()],
    settings: pickNewer(a.settings, b.settings),
    keymap: pickNewer(a.keymap, b.keymap),
    tombstones,
  };
}

export const config = { path: '/api/sync' };
