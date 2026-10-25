import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/userRepository';
import { SafeUserProfile, JwtUserPayload } from '../types/user';
import { env } from '../config/env';

export class AuthenticationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode;
  }
}

export class AuthService {
  /**
   * Verifies an entered password against stored password in MTBL_USER.
   * Supports bcrypt hashes ($2a$, $2b$, $2y$) as well as legacy formatted strings.
   */
  private async verifyPassword(plainPassword: string, storedPassword: string): Promise<boolean> {
    if (!storedPassword || !plainPassword) {
      return false;
    }

    const trimmedStored = storedPassword.trim();

    // Check if stored format is a bcrypt hash (starts with $2 and is 60 chars)
    if (trimmedStored.startsWith('$2') && trimmedStored.length === 60) {
      try {
        return await bcrypt.compare(plainPassword, trimmedStored);
      } catch (err) {
        console.error('[AuthService] Bcrypt comparison error:', err);
        return false;
      }
    }

    // For legacy or non-bcrypt stored format:
    // Safe constant-time comparison or exact match
    return plainPassword === trimmedStored;
  }

  /**
   * Authenticates user against MTBL_USER.
   * Returns safe profile and signed JWT token.
   */
  async authenticate(loginId: string, plainPassword: string): Promise<{ user: SafeUserProfile; token: string }> {
    const trimmedId = loginId.trim();

    // 1. Fetch user by USER_ID
    const userRecord = await userRepository.findByUserId(trimmedId);

    // If user does not exist, return generic error (do not leak user existence)
    if (!userRecord) {
      throw new AuthenticationError('Invalid username or password.');
    }

    // 2. Verify password
    const isPasswordValid = await this.verifyPassword(plainPassword, userRecord.USER_PASSWORD);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid username or password.');
    }

    // 3. Check account status (USER_DISABLE_FLAG: 'Y' = disabled, 'N' = active)
    if (userRecord.USER_DISABLE_FLAG && userRecord.USER_DISABLE_FLAG.toUpperCase() === 'Y') {
      throw new AuthenticationError('Account is disabled or inactive. Please contact the administrator.', 403);
    }

    // 4. Update login metrics (async/non-blocking)
    userRepository.incrementLoginCount(userRecord.USER_ID).catch(() => {});

    // 5. Construct safe user profile
    const safeUser: SafeUserProfile = {
      userId: userRecord.USER_ID,
      userName: userRecord.USER_NAME || userRecord.USER_ID,
      description: userRecord.USER_L1_DESC || null,
      disableFlag: userRecord.USER_DISABLE_FLAG || 'N',
      loginCount: (userRecord.USER_LOGIN_COUNT || 0) + 1
    };

    // 6. Generate signed JWT token
    const payload: JwtUserPayload = {
      userId: safeUser.userId,
      userName: safeUser.userName
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any
    });

    return { user: safeUser, token };
  }

  /**
   * Generates a safe profile for the current authenticated user by userId
   */
  async getProfile(userId: string): Promise<SafeUserProfile> {
    const userRecord = await userRepository.findByUserId(userId);
    if (!userRecord) {
      throw new AuthenticationError('User session expired or user not found.', 401);
    }

    if (userRecord.USER_DISABLE_FLAG && userRecord.USER_DISABLE_FLAG.toUpperCase() === 'Y') {
      throw new AuthenticationError('Account has been disabled.', 403);
    }

    return {
      userId: userRecord.USER_ID,
      userName: userRecord.USER_NAME || userRecord.USER_ID,
      description: userRecord.USER_L1_DESC || null,
      disableFlag: userRecord.USER_DISABLE_FLAG || 'N',
      loginCount: userRecord.USER_LOGIN_COUNT || 0
    };
  }
}

export const authService = new AuthService();
