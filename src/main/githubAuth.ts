/**
 * GitHub OAuth Device Flow.
 *
 * Flow:
 *   1. POST https://github.com/login/device/code → get device_code + user_code + verification_uri
 *   2. Caller displays user_code and opens verification_uri in the browser
 *   3. Poll https://github.com/login/oauth/access_token until the user approves (or denies)
 *   4. Persist the returned access_token in electron-store
 *
 * Token storage is plain JSON (electron-store does not encrypt). This is documented
 * and accepted for this app — a malicious local actor with disk read can already
 * exfiltrate just about anything else from the user's session.
 */

import { Octokit } from '@octokit/rest';
import { store } from './store';
import { isSandbox } from './sandbox';

// ─── Constants ────────────────────────────────────────────────────────────────

const CLIENT_ID = 'Ov23liTsYY1S5yKSVSNx';
const SCOPES = 'repo read:user';

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

const MIN_POLL_INTERVAL_MS = 5_000;
const MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes hard ceiling

// Inline 1x1 avatar so sandbox never requests an external image and trips the network guard.
const SANDBOX_AVATAR_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#5865F2"/></svg>'
  );

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeviceCodeInfo {
  user_code: string;
  verification_uri: string;
  expires_in: number;
}

interface DeviceCodeResponse extends DeviceCodeInfo {
  device_code: string;
  interval: number;
}

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

// ─── Abort state ──────────────────────────────────────────────────────────────

let activeController: AbortController | null = null;

function abortActive(reason: string) {
  if (activeController) {
    activeController.abort(reason);
    activeController = null;
  }
}

// ─── Utility: cancellable sleep ───────────────────────────────────────────────

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('Aborted'));
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Aborted'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

// ─── Device flow ──────────────────────────────────────────────────────────────

/**
 * Run GitHub Device Flow end-to-end.
 *
 * @param onDeviceCode Called once with the user_code + verification_uri the user
 *                     must enter to approve the app. Caller should display these.
 * @returns The access token (string) once the user has approved.
 * @throws  On timeout, denial, expiry, network error, or abort.
 */
export async function startDeviceAuth(
  onDeviceCode: (info: DeviceCodeInfo) => void
): Promise<string> {
  if (isSandbox) {
    return 'sandbox-fake-token';
  }
  // Cancel any prior flow before starting a new one.
  abortActive('superseded by new auth attempt');

  activeController = new AbortController();
  const signal = activeController.signal;
  const startTime = Date.now();

  try {
    // ── Step 1: request a device code ────────────────────────────────────────
    const codeRes = await fetch(DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: CLIENT_ID, scope: SCOPES }),
      signal,
    });

    if (!codeRes.ok) {
      throw new Error(`Device code request failed: HTTP ${codeRes.status}`);
    }

    const codeData = (await codeRes.json()) as DeviceCodeResponse;
    if (!codeData.device_code || !codeData.user_code) {
      throw new Error('Malformed device code response from GitHub');
    }

    onDeviceCode({
      user_code: codeData.user_code,
      verification_uri: codeData.verification_uri,
      expires_in: codeData.expires_in,
    });

    // ── Step 2: poll for the access token ────────────────────────────────────
    let pollIntervalMs = Math.max((codeData.interval || 5) * 1000, MIN_POLL_INTERVAL_MS);
    const deviceExpiresAt = startTime + Math.min(codeData.expires_in * 1000, MAX_DURATION_MS);

    while (true) {
      if (signal.aborted) throw new Error('Authentication aborted');
      if (Date.now() > deviceExpiresAt) throw new Error('Device code expired');

      await sleep(pollIntervalMs, signal);

      const tokenRes = await fetch(ACCESS_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          device_code: codeData.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
        signal,
      });

      const tokenData = (await tokenRes.json()) as TokenResponse;

      if (tokenData.access_token) {
        store.set('githubToken', tokenData.access_token);
        activeController = null;
        return tokenData.access_token;
      }

      switch (tokenData.error) {
        case 'authorization_pending':
          // User hasn't approved yet – keep polling at current rate.
          continue;
        case 'slow_down':
          // GitHub asked us to back off. Add 5s to the interval as per spec.
          pollIntervalMs += 5_000;
          continue;
        case 'expired_token':
          throw new Error('Device code expired before user approved');
        case 'access_denied':
          throw new Error('User denied access');
        case 'incorrect_client_credentials':
          throw new Error('Bad client_id (configuration error)');
        case 'unsupported_grant_type':
          throw new Error('Unsupported grant type (configuration error)');
        default:
          if (tokenData.error) {
            throw new Error(`OAuth error: ${tokenData.error_description || tokenData.error}`);
          }
          // No error and no token? Treat as pending and continue.
          continue;
      }
    }
  } finally {
    if (activeController?.signal === signal) {
      activeController = null;
    }
  }
}

// ─── Token + Octokit accessors ────────────────────────────────────────────────

export function getToken(): string | null {
  if (isSandbox) return 'sandbox-fake-token';
  const t = store.get('githubToken');
  return t && t.length > 0 ? t : null;
}

export function logout(): void {
  if (isSandbox) return;
  abortActive('logout');
  store.set('githubToken', '');
}

export function getOctokit(): Octokit | null {
  if (isSandbox) return null;
  const token = getToken();
  if (!token) return null;
  return new Octokit({ auth: token });
}

/**
 * Validate the stored token by hitting GET /user.
 * Returns the user object on success, or null if no token / token rejected.
 */
export async function checkAuth(): Promise<{
  authenticated: boolean;
  user?: { login: string; avatar_url: string; html_url: string };
  error?: string;
}> {
  if (isSandbox) {
    return {
      authenticated: true,
      user: {
        login: 'sandbox-user',
        avatar_url: SANDBOX_AVATAR_DATA_URI,
        html_url: 'https://github.com/sandbox-user',
      },
    };
  }
  const octokit = getOctokit();
  if (!octokit) return { authenticated: false };
  try {
    const { data } = await octokit.users.getAuthenticated();
    return {
      authenticated: true,
      user: {
        login: data.login,
        avatar_url: data.avatar_url,
        html_url: data.html_url,
      },
    };
  } catch (e: any) {
    // Token is stored but no longer valid – clear it so the UI doesn't keep retrying.
    if (e?.status === 401) store.set('githubToken', '');
    return { authenticated: false, error: e?.message || String(e) };
  }
}
