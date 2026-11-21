// ─── send-push Edge Function ─────────────────────────────────────
// Sends FCM (HTTP v1) pushes to driver-app device tokens.
// The FCM service-account JSON lives ONLY in the function secret
// FCM_SERVICE_ACCOUNT — never in the repo or the mobile app.
//
// Deploy:  supabase functions deploy send-push --project-ref <ref>
// Secrets:  supabase secrets set FCM_SERVICE_ACCOUNT='<service-account JSON>'
//           supabase secrets set PUSH_FUNCTION_SECRET='<long random string>'   # optional, server-to-server callers
//           supabase secrets set PUSH_ALLOWED_ORIGINS='https://app.travelsjayam.in'
//
// Every call is authenticated in the function itself: a trusted server may use
// the shared PUSH_FUNCTION_SECRET, while the web ERP uses its normal Supabase
// JWT (admin/manager only). Platform JWT verification stays on as a second
// layer. Browser CORS is restricted to an explicit origin allowlist.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { corsHeaders, verifyCaller } from './security.js';

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers });
}

function b64url(input: Uint8Array | string): string {
  const bin =
    typeof input === 'string'
      ? input
      : String.fromCharCode(...input);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** OAuth2 access token from the service-account JSON (RS256 JWT grant). */
async function accessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const pem = String(sa.private_key || '')
    .replace(/\\n/g, '\n')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  if (!sa.client_email || !pem || !sa.project_id) {
    throw new Error('FCM_SERVICE_ACCOUNT is incomplete');
  }
  const raw = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    raw,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(unsigned),
    ),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const result = await res.json();
  if (!result.access_token) {
    throw new Error('OAuth failed: ' + JSON.stringify(result).slice(0, 200));
  }
  return result.access_token;
}

serve(async (req) => {
  const env = Deno.env.toObject();
  const headers = corsHeaders(req.headers.get('origin'), env);
  if (!headers) return new Response('Forbidden', { status: 403 });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, headers);
  }

  const caller = await verifyCaller({
    authorization: req.headers.get('authorization'),
    pushSecret: req.headers.get('x-push-secret'),
    fetchImpl: fetch,
    env,
  });
  if (!caller.ok) {
    return json({ error: caller.error }, caller.status, headers);
  }

  try {
    const { tokens, title, body, data } = await req.json();
    const list: string[] = Array.isArray(tokens)
      ? tokens
      : tokens
        ? [tokens]
        : [];
    if (!list.length) {
      return json({ sent: 0, failed: 0, error: 'no_tokens' }, 200, headers);
    }
    const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT');
    if (!saRaw) {
      return json(
        { sent: 0, failed: list.length, error: 'not_configured' },
        200,
        headers,
      );
    }
    const sa = JSON.parse(saRaw);
    const token = await accessToken(sa);
    const results = [];
    for (const t of list.slice(0, 500)) {
      try {
        const r = await fetch(
          `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token: t,
                notification: {
                  title: title || 'Sri Jayam Travels',
                  body: body || '',
                },
                data: data || {},
              },
            }),
          },
        );
        const j = await r.json();
        results.push({
          token: t,
          ok: r.ok,
          messageId: j.name || null,
          error: r.ok ? null : JSON.stringify(j).slice(0, 200),
        });
      } catch (e) {
        results.push({ token: t, ok: false, error: String(e).slice(0, 200) });
      }
    }
    return json(
      {
        sent: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
      },
      200,
      headers,
    );
  } catch (e) {
    return json({ sent: 0, failed: 0, error: String(e).slice(0, 200) }, 500, headers);
  }
});
