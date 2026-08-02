import { getStore } from '@netlify/blobs';

const STORE_NAME = 'elev8-prompter';
const KEY = 'cmd-v1';

export default async (request) => {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  if (request.method === 'GET') {
    const doc = await store.get(KEY, { type: 'json' });
    return new Response(JSON.stringify(doc || { ts: 0, cmd: null }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'PUT') {
    let body;
    try { body = await request.json(); } catch { body = {}; }
    const doc = { ts: Date.now(), cmd: body.cmd || null, payload: body.payload || null };
    await store.setJSON(KEY, doc);
    return new Response(JSON.stringify(doc), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  return new Response('method not allowed', { status: 405, headers: cors });
};

export const config = { path: '/api/cmd' };
