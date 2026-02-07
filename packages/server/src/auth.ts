import type { MiddlewareHandler } from 'hono';
import { apiError } from './errors';

function extractBearer(authorizationHeader: string): string | null {
  const [scheme, token] = authorizationHeader.split(' ', 2);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

export function createApiKeyAuthMiddleware(apiKeys: string[]): MiddlewareHandler {
  const allowed = new Set(apiKeys);

  return async (c, next) => {
    const authorization = c.req.header('authorization');
    const xApiKey = c.req.header('x-api-key');

    let key: string | null = null;

    // Precedence: Authorization > X-API-Key
    if (authorization) {
      key = extractBearer(authorization);
    } else if (xApiKey) {
      key = xApiKey.trim() || null;
    }

    if (!key || !allowed.has(key)) {
      return c.json(apiError('UNAUTHORIZED', 'Missing or invalid API key'), 401);
    }

    await next();
  };
}
