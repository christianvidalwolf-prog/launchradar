const ADMIN_EMAIL = 'christian.vidal@craze-group.com';
const SUPABASE_URL =
  process.env.LAUNCH_RADAR_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://cbiwqxjopafeicbqpyhz.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.LAUNCH_RADAR_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_EPa9HCbu7StolqeUq9wRHw__2dodmec';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.LAUNCH_RADAR_SUPABASE_SERVICE_ROLE_KEY;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

async function fetchCurrentUser(accessToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.msg || 'Invalid session.');
  }

  return response.json();
}

async function fetchAllUsers() {
  const users = [];
  const perPage = 200;

  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.msg || payload?.error_description || 'Failed to load users from Supabase.');
    }

    const payload = await response.json();
    const batch = Array.isArray(payload?.users) ? payload.users : [];
    users.push(...batch);

    if (batch.length < perPage) break;
  }

  return users
    .map(user => ({
      id: user.id,
      email: user.email || '',
      createdAt: user.created_at || null,
      confirmedAt: user.email_confirmed_at || user.confirmed_at || null,
      lastSignInAt: user.last_sign_in_at || null,
    }))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Missing Supabase service role key on the server.' });
    return;
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) {
    res.status(401).json({ error: 'Missing access token.' });
    return;
  }

  try {
    const currentUser = await fetchCurrentUser(accessToken);
    if (normalizeEmail(currentUser?.email) !== ADMIN_EMAIL) {
      res.status(403).json({ error: 'You do not have permission to view registered users.' });
      return;
    }

    const users = await fetchAllUsers();
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json({ users });
  } catch (error) {
    const message = error?.message || 'Unable to load registered users.';
    const status = message === 'Invalid session.' ? 401 : 500;
    res.status(status).json({ error: message });
  }
}
