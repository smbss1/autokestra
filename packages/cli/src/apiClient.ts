export interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(normalizeBaseUrl(baseUrl) + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function readErrorBody(res: Response): Promise<{ message: string; code?: string; details?: unknown }> {
  const contentType = (res.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
  if (contentType === 'application/json') {
    try {
      const body: any = await res.json();
      const error = body?.error;
      if (error?.message) {
        return { message: String(error.message), code: error.code ? String(error.code) : undefined, details: error.details };
      }
      return { message: JSON.stringify(body) };
    } catch {
      // fallthrough
    }
  }

  try {
    const text = await res.text();
    return { message: text || `HTTP ${res.status}` };
  } catch {
    return { message: `HTTP ${res.status}` };
  }
}

export async function requestJson<T>(
  config: ApiClientConfig,
  method: string,
  path: string,
  options: {
    query?: Record<string, string | number | boolean | undefined>;
    headers?: Record<string, string>;
    body?: unknown;
    rawBody?: string;
    contentType?: string;
  } = {},
): Promise<T> {
  const url = buildUrl(config.baseUrl, path, options.query);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    ...(options.headers || {}),
  };

  let body: BodyInit | undefined;
  if (options.rawBody !== undefined) {
    body = options.rawBody;
    if (options.contentType) headers['Content-Type'] = options.contentType;
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers['Content-Type'] = options.contentType || 'application/json';
  }

  const res = await fetch(url, { method, headers, body });

  if (!res.ok) {
    const err = await readErrorBody(res);
    throw new ApiError(err.message, res.status, err.code, err.details);
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = (res.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    const text = await res.text();
    throw new ApiError(`Expected JSON but got '${contentType || 'unknown'}': ${text}`, res.status);
  }

  return (await res.json()) as T;
}
