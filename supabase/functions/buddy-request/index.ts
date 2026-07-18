// POST /functions/v1/buddy-request  {username: string}
// Authenticated. Resolves username → user_id server-side, calls
// send_buddy_request(). Always returns {ok:true} regardless of whether the
// target exists — that's the anti-enumeration guarantee.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { sendEmail, buddyRequestReceived } from '../_shared/email.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL = Deno.env.get('VITE_APP_URL') ?? '';

const admin = createClient(SUPABASE_URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!jwt) return json({ error: 'no auth' }, 401);

  const asUser = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'invalid session' }, 401);
  const me = userData.user.id;

  let body: { username?: string };
  try {
    body = (await req.json()) as { username?: string };
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  const uname = (body.username ?? '').trim().toLowerCase();
  if (!USERNAME_RE.test(uname)) {
    // Match the anti-enumeration contract: always ok, quietly no-op.
    return json({ ok: true });
  }

  const { data: targetId } = await admin.rpc('find_user_id_by_username', { uname });
  const target = typeof targetId === 'string' ? targetId : null;
  if (!target) return json({ ok: true });

  const { data: rpcRes, error: rpcErr } = await admin.rpc('send_buddy_request', {
    requester: me,
    target
  });
  if (rpcErr) return json({ ok: true }); // never leak
  const row = Array.isArray(rpcRes) ? rpcRes[0] : rpcRes;

  // Notify the recipient (best-effort; failure is not fatal).
  if (row?.created) {
    try {
      const { data: peer } = await admin
        .from('users')
        .select('name, email')
        .eq('id', target)
        .single();
      const { data: senderProfile } = await admin
        .from('users')
        .select('name, username')
        .eq('id', me)
        .single();
      const base = APP_URL ? APP_URL.replace(/\/$/, '') : new URL(req.url).origin;
      const buddyUrl = `${base}/buddy`;
      if (peer?.email && senderProfile) {
        const { subject, html } = buddyRequestReceived({
          recipientName: peer.name ?? 'friend',
          senderName: senderProfile.name ?? senderProfile.username ?? 'someone',
          senderUsername: senderProfile.username ?? 'someone',
          buddyUrl
        });
        await sendEmail({ to: peer.email, subject, html });
      }
    } catch (e) {
      console.warn('[buddy-request] notify failed:', (e as Error).message);
    }
  }

  return json({ ok: true });
});
