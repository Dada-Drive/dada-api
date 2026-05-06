import { OAuth2Client } from 'google-auth-library';

import { config } from '@/config/index';
import { appError, ErrorCodes } from '@/types/errorCodes';

// ── Types ────────────────────────────────────────────────────────────────────

interface GoogleUserInfo {
  googleId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

// ── Client ───────────────────────────────────────────────────────────────────

const client = new OAuth2Client(config.google.clientId);

// Accept tokens from web, Android, and iOS clients
const VALID_AUDIENCES = [
  config.google.clientId,
  config.google.androidClientId,
  config.google.iosClientId,
].filter(Boolean);

// ── Verify Token ─────────────────────────────────────────────────────────────

async function verifyGoogleToken(idToken: string): Promise<GoogleUserInfo> {
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: VALID_AUDIENCES,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw appError(ErrorCodes.AUTH.TOKEN_INVALID);
    }

    const { sub, email, name, picture } = payload;

    if (!sub || !email) {
      throw appError(ErrorCodes.AUTH.TOKEN_INVALID, {
        reason: 'Google token missing required claims',
      });
    }

    return {
      googleId: sub,
      email,
      fullName: name ?? email.split('@')[0] ?? 'User',
      avatarUrl: picture ?? null,
    };
  } catch (err) {
    // Re-throw AppError as-is
    if (err && typeof err === 'object' && 'isOperational' in err) {
      throw err;
    }
    throw appError(ErrorCodes.AUTH.TOKEN_INVALID, {
      reason: 'Failed to verify Google ID token',
    });
  }
}

export { verifyGoogleToken };
export type { GoogleUserInfo };
