const BASE = (
  import.meta.env.VITE_API_BASE || 'https://dormfind.onrender.com'
).replace(/\/$/, '');

let tokens;

try {
  tokens = JSON.parse(
    sessionStorage.getItem('dormfind_tokens') || 'null'
  );
} catch {
  tokens = null;
}

export function setTokens(value) {
  tokens = value;

  if (value) {
    sessionStorage.setItem(
      'dormfind_tokens',
      JSON.stringify(value)
    );
  } else {
    sessionStorage.removeItem('dormfind_tokens');
  }
}

export function hasSession() {
  return !!tokens?.refresh_token;
}

let refreshing;

export async function api(
  path,
  {
    method = 'GET',
    body,
    retry = true
  } = {}
) {
  const headers = {};

  if (tokens?.access_token) {
    headers.Authorization =
      `Bearer ${tokens.access_token}`;
  }

  const form = body instanceof FormData;

  if (body && !form) {
    headers['Content-Type'] = 'application/json';
  }

  /*
   * Mas mahabang oras para sa email, image upload,
   * registration at admin dashboard.
   */
  const slowRequest =
    form ||
    [
      '/auth/register',
      '/auth/send-email-otp',
      '/auth/forgot-password',
      '/admin/overview',
      '/profile/email-otp',
      '/contracts',
      '/reports'
    ].includes(path);

  /*
   * Normal request: 30 seconds
   * Email/upload/admin: 45 seconds
   */
  const timeoutMs = slowRequest ? 45000 : 30000;

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let response;

  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body
        ? form
          ? body
          : JSON.stringify(body)
        : undefined,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'The server is taking too long. Check your internet and database connection, then try again.'
      );
    }

    throw new Error(
      'Cannot reach LavaLust. Start the backend on localhost:8000 and check the API URL.'
    );
  } finally {
    clearTimeout(timeout);
  }

  const publicAuthPaths = [
    '/auth/login',
    '/auth/register',
    '/auth/send-email-otp',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/refresh',
    '/auth/logout'
  ];

  if (
    response.status === 401 &&
    retry &&
    tokens?.refresh_token &&
    !publicAuthPaths.includes(path)
  ) {
    if (!refreshing) {
      refreshing = api('/auth/refresh', {
        method: 'POST',
        body: {
          refresh_token: tokens.refresh_token
        },
        retry: false
      })
        .then(result => {
          setTokens(result.tokens);
        })
        .catch(error => {
          setTokens(null);

          window.dispatchEvent(
            new Event('dormfind-signed-out')
          );

          throw error;
        })
        .finally(() => {
          refreshing = null;
        });
    }

    await refreshing;

    return api(path, {
      method,
      body,
      retry: false
    });
  }

  const data = await response.json().catch(() => {
    throw new Error(
      'Backend returned an invalid response. Check the backend terminal and PHP logs.'
    );
  });

  if (!response.ok) {
    throw new Error(
      data.error || 'Request failed.'
    );
  }

  return data.data;
}

export async function signOut() {
  try {
    if (tokens?.refresh_token) {
      let timer;

      try {
        await Promise.race([
          api('/auth/logout', {
            method: 'POST',
            body: {
              refresh_token: tokens.refresh_token
            }
          }),

          new Promise(resolve => {
            timer = setTimeout(resolve, 1500);
          })
        ]);
      } finally {
        clearTimeout(timer);
      }
    }
  } finally {
    setTokens(null);
  }
}
