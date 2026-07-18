// POST /functions/v1/signup-via-invite
// Body: {invite_token?, email?, username, pin, name?}
//
// Atomic account creation for the invite+PIN model.
//
// Two paths:
//   1. INVITED — invite_token is valid & unused. Email is looked up from the
//      linked account_requests row (or falls back to body.email). Any email
//      in the body must match the invite; we don't let the requester pivot.
//   2. BOOTSTRAP — no invite_token. Only allowed when public.users is empty.
//      Body must supply an email (Supabase Auth requires one). The first
//      account is the owner.
//
// PIN is stored as the Supabase Auth password (6-digit numeric). Client then
// calls signInWithPassword to obtain a session, or we can shortcut by
// returning the resolved email so the client's post-signup flow just runs
// through the normal login path.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const admin = createClient(SUPABASE_URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;
const PIN_RE = /^\d{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Body {
  invite_token?: string;
  email?: string;
  username?: string;
  pin?: string;
  name?: string;
}

async function inviteBundle(token: string) {
  // Load the invite and, if present, the request row it was created from.
  const { data: invite } = await admin
    .from('invites')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (!invite) return { invite: null as null, request: null as null };
  const { data: request } = await admin
    .from('account_requests')
    .select('email, name')
    .eq('invite_id', invite.id)
    .maybeSingle();
  return { invite, request };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const username = (body.username ?? '').trim().toLowerCase();
  const pin = (body.pin ?? '').trim();
  const bodyEmail = (body.email ?? '').trim().toLowerCase();
  const displayName = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const token = typeof body.invite_token === 'string' ? body.invite_token.trim() : '';

  if (!USERNAME_RE.test(username))
    return json({ error: 'Username must be 3–32 lowercase letters, digits, or underscore.' }, 400);
  if (!PIN_RE.test(pin))
    return json({ error: 'PIN must be exactly 6 digits.' }, 400);

  // Username uniqueness up front (cheap check; trigger also enforces).
  const { data: taken } = await admin
    .from('users')
    .select('id')
    .ilike('username', username)
    .maybeSingle();
  if (taken) return json({ error: 'That username is taken. Pick another.' }, 409);

  let resolvedEmail = '';
  let bootstrap = false;

  if (token) {
    const { invite, request } = await inviteBundle(token);
    if (!invite) return json({ error: 'Invite not found.' }, 400);
    if (invite.used_by) return json({ error: 'Invite already used.' }, 400);
    if (new Date(invite.expires_at).getTime() < Date.now())
      return json({ error: 'Invite expired.' }, 400);

    // Prefer the email locked into the request; fall back to body.email
    // only if the invite was hand-issued (not via account_requests).
    const authoritativeEmail = (request?.email ?? '').toLowerCase();
    if (authoritativeEmail) {
      if (bodyEmail && bodyEmail !== authoritativeEmail) {
        return json({ error: 'This invite is for a different email address.' }, 400);
      }
      resolvedEmail = authoritativeEmail;
    } else {
      if (!EMAIL_RE.test(bodyEmail)) return json({ error: 'Email is required.' }, 400);
      resolvedEmail = bodyEmail;
    }
  } else {
    // Bootstrap path — only if no users exist yet.
    const { count } = await admin
      .from('users')
      .select('id', { count: 'exact', head: true });
    if ((count ?? 0) > 0) {
      return json({ error: 'Signup is invite-only. Ask the owner for an invite.' }, 403);
    }
    if (!EMAIL_RE.test(bodyEmail)) return json({ error: 'Email is required.' }, 400);
    resolvedEmail = bodyEmail;
    bootstrap = true;
  }

  // Create the auth user. email_confirm skips the confirmation loop; the
  // invite click (or the fact that this is the first-ever account) already
  // demonstrates ownership.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: resolvedEmail,
    password: pin,
    email_confirm: true,
    user_metadata: {
      username,
      name: displayName || username,
      invite_token: token || undefined
    }
  });

  if (createErr || !created?.user) {
    const msg = createErr?.message ?? 'Signup failed.';
    // Common conflict: email already in Supabase Auth (rare with invite but possible).
    const status = /already registered|exists|duplicate/i.test(msg) ? 409 : 400;
    return json({ error: msg }, status);
  }

  // The handle_new_user trigger already inserted into public.users with the
  // username from metadata. Defensively ensure username is stamped in case a
  // legacy row exists.
  await admin
    .from('users')
    .update({ username })
    .eq('id', created.user.id);

  return json({
    ok: true,
    user_id: created.user.id,
    email: resolvedEmail,
    bootstrap
  });
});
