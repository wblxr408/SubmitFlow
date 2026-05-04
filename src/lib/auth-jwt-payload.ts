export interface AuthJwtPayload {
  userId: number;
  email: string;
  role: string;
}

export function normalizeUserId(userId: unknown): number | null {
  if (typeof userId === 'number' && Number.isSafeInteger(userId) && userId > 0) {
    return userId;
  }

  if (typeof userId === 'string' && /^\d+$/.test(userId)) {
    const parsed = Number.parseInt(userId, 10);
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

export function normalizeAuthJwtPayload(payload: unknown): AuthJwtPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const userId = normalizeUserId(candidate.userId);

  if (
    userId === null ||
    typeof candidate.email !== 'string' ||
    typeof candidate.role !== 'string'
  ) {
    return null;
  }

  return {
    userId,
    email: candidate.email,
    role: candidate.role,
  };
}
