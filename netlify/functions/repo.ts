/**
 * /.netlify/functions/repo — the site's save service.
 *
 * Replaces Git Gateway for everything the site itself saves. Netlify checks
 * the Identity token sent in the Authorization header and hands us the user
 * (context.clientContext.user), including app_metadata.roles, which only the
 * Netlify dashboard can change. The service then applies the role rules in
 * netlify/lib/rules.ts and commits to GitHub with a token only it holds.
 *
 * Settings (Netlify → Project configuration → Environment variables):
 *   GITHUB_TOKEN   fine-grained token, this repository only, Contents: read and write
 *   GITHUB_REPO    owner/name, e.g. mdraigon-dev/DarayyaRealWeb
 *   GITHUB_BRANCH  optional, defaults to main
 */
import { connectLambda, getStore } from '@netlify/blobs';
import { github } from '../lib/github';
import { handle, type ChunkStore } from '../lib/service';

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

export const handler = async (event: any, context: any) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'METHOD', message: 'Use POST.' });

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    return json(500, { error: 'NOT_CONFIGURED', message: 'The save service is not set up yet (GITHUB_TOKEN / GITHUB_REPO).' });
  }

  let body: unknown;
  try {
    body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '{}'));
  } catch {
    return json(400, { error: 'BAD_REQUEST', message: 'Invalid JSON.' });
  }

  // Large uploads arrive in chunks, held briefly in Netlify Blobs.
  let chunks: ChunkStore;
  try {
    connectLambda(event);
    const store = getStore('upload-chunks');
    chunks = {
      set: async (k, v) => { await store.set(k, v); },
      get: async (k) => (await store.get(k, { type: 'text' })) ?? null,
      delete: async (k) => { await store.delete(k); },
    };
  } catch {
    chunks = {
      set: async () => { throw new Error('Chunk storage unavailable'); },
      get: async () => null,
      delete: async () => {},
    };
  }

  const reply = await handle({
    user: context?.clientContext?.user,
    body,
    gh: github({ token, repo, branch: process.env.GITHUB_BRANCH || 'main' }),
    chunks,
    // Short-lived admin token for the Identity API (staff list only).
    identity: context?.clientContext?.identity,
  });
  return json(reply.status, reply.body);
};
