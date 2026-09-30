// ─── send-push Edge Function ─────────────────────────────────────
// Sends FCM (HTTP v1) pushes to driver-app device tokens.
// The FCM service-account JSON lives ONLY in the function secret
// FCM_SERVICE_ACCOUNT — never in the repo or the mobile app.
//
// Deploy:  supabase functions deploy send-push --project-ref <ref>
// Secrets:  supabase secrets set FCM_SERVICE_ACCOUNT='<service-account JSON>'

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  const json = await res.json();
  if (!json.access_token) {
    throw new Error('OAuth failed: ' + JSON.stringify(json).slice(0, 200));
  }
  return json.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  try {
    const { tokens, title, body, data } = await req.json();
    const list: string[] = Array.isArray(tokens)
      ? tokens
      : tokens
        ? [tokens]
        : [];
    if (!list.length) {
      return Response.json(
        { sent: 0, failed: 0, error: 'no_tokens' },
        { headers: cors },
      );
    }
    const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT');
    if (!saRaw) {
      return Response.json(
        { sent: 0, failed: list.length, error: 'not_configured' },
        { headers: cors },
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
    return Response.json(
      {
        sent: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
      },
      { headers: cors },
    );
  } catch (e) {
    return Response.json(
      { sent: 0, failed: 0, error: String(e).slice(0, 200) },
      { status: 500, headers: cors },
    );
  }
});
