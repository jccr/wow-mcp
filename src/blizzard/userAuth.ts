import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import got from 'got';
import {
  OAUTH_AUTHORIZE_URL,
  OAUTH_TOKEN_URL,
  OAUTH_USERINFO_URL,
} from '../config/regions.js';
import type { Env } from '../config/env.js';
import type { BnetUserTokenRecord } from '../store/types.js';
import { getStore } from '../auth.js';
import { logger } from '../util/logger.js';

/**
 * Battle.net *user* login (OAuth authorization code flow).
 *
 * Flow:
 *   1. An MCP client calls the `wow_account_login` tool, which returns a
 *      one-time Battle.net authorize URL (the `state` is a random ticket
 *      that is only handed out through the MCP endpoint).
 *   2. The user opens it, logs in to Battle.net and approves `wow.profile`.
 *   3. Battle.net redirects to BNET_REDIRECT_URI (`/bnet/callback`), where
 *      the code is exchanged for a user access token and stored.
 *
 * Battle.net does not issue refresh tokens; user tokens last ~24 hours,
 * after which the user logs in again.
 *
 * This server holds a single linked Battle.net account (it is meant to be
 * run by one person for their own account).
 */

export const BNET_USER_SCOPES = 'openid wow.profile';

const STATE_TTL_MS = 10 * 60_000;
const pendingStates = new Map<string, number>(); // state -> expiresAtMs

function prunePendingStates(now = Date.now()): void {
  for (const [s, exp] of pendingStates) if (exp <= now) pendingStates.delete(s);
}

/** Create a one-time Battle.net authorize URL. */
export function createLoginUrl(env: Env): { url: string; expiresAtMs: number } {
  prunePendingStates();
  const state = crypto.randomBytes(32).toString('base64url');
  const expiresAtMs = Date.now() + STATE_TTL_MS;
  pendingStates.set(state, expiresAtMs);

  const url = new URL(OAUTH_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', env.BNET_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.BNET_REDIRECT_URI);
  url.searchParams.set('scope', BNET_USER_SCOPES);
  url.searchParams.set('state', state);
  return { url: url.toString(), expiresAtMs };
}

/** Consume a state ticket. Returns true if it was valid and unexpired. */
export function consumeState(state: string): boolean {
  const exp = pendingStates.get(state);
  pendingStates.delete(state);
  return exp !== undefined && exp > Date.now();
}

/** The linked user's token, or undefined if not logged in / expired. */
export async function getUserToken(): Promise<BnetUserTokenRecord | undefined> {
  const rec = await getStore().getBnetUserToken();
  if (!rec || rec.expiresAtMs <= Date.now()) return undefined;
  return rec;
}

export async function clearUserToken(): Promise<void> {
  await getStore().deleteBnetUserToken();
}

// ── /bnet/callback ─────────────────────────────────────

interface BnetTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  sub?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function page(res: ServerResponse, status: number, title: string, message: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5}</style>
</head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></body></html>`);
}

export async function handleBnetCallback(env: Env, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }).end(); return; }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (!state || !consumeState(state)) {
    page(res, 400, 'Login link expired', 'This login link is invalid or has expired. Ask your MCP client to run wow_account_login again for a new link.');
    return;
  }
  if (error) {
    page(res, 400, 'Battle.net login cancelled', `Battle.net returned: ${error}. You can close this tab.`);
    return;
  }
  if (!code) {
    page(res, 400, 'Battle.net login failed', 'No authorization code was returned.');
    return;
  }

  let token: BnetTokenResponse;
  try {
    const resp = await got.post<BnetTokenResponse>(OAUTH_TOKEN_URL, {
      form: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.BNET_REDIRECT_URI,
      },
      username: env.BNET_CLIENT_ID,
      password: env.BNET_CLIENT_SECRET,
      responseType: 'json',
      timeout: { request: 10_000 },
      retry: { limit: 0 },
    });
    token = resp.body;
  } catch (err) {
    logger.error({ err }, 'Battle.net code exchange failed');
    page(res, 502, 'Battle.net login failed', 'Could not exchange the authorization code with Battle.net. Check that BNET_REDIRECT_URI exactly matches a redirect URL registered for your client on develop.battle.net.');
    return;
  }

  // BattleTag is nice-to-have; ignore failures.
  let battletag: string | undefined;
  try {
    const info = await got(OAUTH_USERINFO_URL, {
      headers: { authorization: `Bearer ${token.access_token}` },
      responseType: 'json',
      timeout: { request: 10_000 },
      retry: { limit: 0 },
    }).json<{ battletag?: string }>();
    battletag = info.battletag;
  } catch (err) {
    logger.warn({ err }, 'Battle.net userinfo lookup failed');
  }

  await getStore().setBnetUserToken({
    accessToken: token.access_token,
    expiresAtMs: Date.now() + token.expires_in * 1000,
    scope: token.scope,
    battletag,
  });
  logger.info('Linked Battle.net account %s', battletag ?? '(unknown BattleTag)');

  page(res, 200, 'Battle.net account linked', `Logged in${battletag ? ` as ${battletag}` : ''}. You can close this tab and go back to your MCP client.`);
}
