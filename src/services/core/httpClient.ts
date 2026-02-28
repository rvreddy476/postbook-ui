export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method: HttpMethod;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export class HttpClientError extends Error {
  readonly status: number;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, requestId?: string, details?: unknown) {
    super(message);
    this.name = 'HttpClientError';
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }
}

const getErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const source = payload as Record<string, unknown>;
  const candidates = ['message', 'error', 'detail', 'description'];
  for (const key of candidates) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return fallback;
};

const isJsonResponse = (contentType: string | null) => {
  if (!contentType) {
    return false;
  }
  return contentType.toLowerCase().includes('application/json');
};

const createRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const random = Math.random().toString(36).slice(2, 10);
  return `req_${Date.now()}_${random}`;
};

export class HttpClient {
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;

  constructor(baseUrl: string, defaultTimeoutMs = 10_000) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  async request<TResponse>(options: RequestOptions): Promise<TResponse> {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    const requestId = createRequestId();

    try {
      const response = await fetch(`${this.baseUrl}${options.path}`, {
        method: options.method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'X-Client-Platform': 'web',
          ...(options.headers ?? {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type');
      const payload = isJsonResponse(contentType) ? await response.json() : await response.text();

      if (!response.ok) {
        throw new HttpClientError(
          getErrorMessage(payload, `Request failed with status ${response.status}`),
          response.status,
          response.headers.get('x-request-id') ?? requestId,
          payload
        );
      }

      return payload as TResponse;
    } catch (error) {
      if (error instanceof HttpClientError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new HttpClientError('Request timed out.', 408, requestId);
      }

      throw new HttpClientError('Network error. Please try again.', 0, requestId);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  post<TResponse>(path: string, body: unknown, headers?: Record<string, string>) {
    return this.request<TResponse>({
      method: 'POST',
      path,
      body,
      headers,
    });
  }
}
