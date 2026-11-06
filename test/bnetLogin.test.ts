import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server, AddressInfo } from 'node:http';
import type { Env } from '../src/config/env.js';
import { createApp } from '../src/app.js';
import { getStore } from '../src/auth.js';

const testEnv: Env = {
  BNET_CLIENT_ID: 'fake-bnet-id',
  BNET_CLIENT_SECRET: 'fake-bnet-secret',
  BNET_REDIRECT_URI: 'http://localhost:3000/bnet/callback',
  LOG_LEVEL: 'fatal',
  HTTP_TIMEOUT_MS: 15_000,
  HTTP_RETRY_LIMIT: 2,
  CACHE_TTL_SECONDS: 300,
  CACHE_SIZE: 500,
  MCP_TOKEN_TTL_SECONDS: 3600,
};

/** Call an MCP tool over the stateless HTTP transport and return its result. */
async function callTool(
  baseUrl: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ isError?: boolean; content: { type: string; text: string }[] }> {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name, arguments: args },
      id: 1,
    }),
  });
  assert.equal(res.status, 200);
  const text = await res.text();
  // Response may be SSE ("data: {...}") or plain JSON.
  const line = text.split('\n').find((l) => l.startsWith('data: ')) ?? text;
  const msg = JSON.parse(line.replace(/^data: /, ''));
  assert.ok(msg.result, `no result: ${text}`);
  return msg.result;
}

describe('Battle.net user login', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    server = await createApp(testEnv);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const { port } = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('wow_account_login returns a Battle.net authorize URL', async () => {
    const result = await callTool(baseUrl, 'wow_account_login');
    const body = JSON.parse(result.content[0]!.text);
    assert.equal(body.loggedIn, false);
    const url = new URL(body.loginUrl);
    assert.equal(url.origin + url.pathname, 'https://oauth.battle.net/authorize');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('client_id'), 'fake-bnet-id');
    assert.equal(url.searchParams.get('redirect_uri'), testEnv.BNET_REDIRECT_URI);
    assert.equal(url.searchParams.get('scope'), 'openid wow.profile');
    assert.ok((url.searchParams.get('state') ?? '').length >= 32);
  });

  it('account tools ask for login when not logged in', async () => {
    const result = await callTool(baseUrl, 'wow_account_profileSummary', { game: 'forever' });
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /wow_account_login/);
  });

  it('/bnet/callback rejects an unknown state', async () => {
    const res = await fetch(`${baseUrl}/bnet/callback?code=abc&state=not-a-real-state`);
    assert.equal(res.status, 400);
    assert.match(await res.text(), /expired/);
  });

  it('/bnet/callback state is single-use', async () => {
    const result = await callTool(baseUrl, 'wow_account_login');
    const state = new URL(JSON.parse(result.content[0]!.text).loginUrl).searchParams.get('state')!;

    // User cancels on Battle.net → state is consumed
    const first = await fetch(`${baseUrl}/bnet/callback?error=access_denied&state=${encodeURIComponent(state)}`);
    assert.equal(first.status, 400);
    assert.match(await first.text(), /cancelled/);

    const second = await fetch(`${baseUrl}/bnet/callback?code=abc&state=${encodeURIComponent(state)}`);
    assert.equal(second.status, 400);
    assert.match(await second.text(), /expired/);
  });

  it('login status reflects a stored token, and logout clears it', async () => {
    await getStore().setBnetUserToken({
      accessToken: 'user-token',
      expiresAtMs: Date.now() + 3_600_000,
      battletag: 'Tester#1234',
    });
    let body = JSON.parse((await callTool(baseUrl, 'wow_account_login')).content[0]!.text);
    assert.equal(body.loggedIn, true);
    assert.equal(body.battletag, 'Tester#1234');

    await callTool(baseUrl, 'wow_account_logout');
    body = JSON.parse((await callTool(baseUrl, 'wow_account_login')).content[0]!.text);
    assert.equal(body.loggedIn, false);
  });

  it('expired stored tokens count as logged out', async () => {
    await getStore().setBnetUserToken({ accessToken: 'old', expiresAtMs: Date.now() - 1 });
    const result = await callTool(baseUrl, 'wow_account_mountsCollection');
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /wow_account_login/);
  });

  it('retail-only account tools are rejected for forever', async () => {
    const result = await callTool(baseUrl, 'wow_account_decorCollection', { game: 'forever' });
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /only available for retail/);
  });
});
