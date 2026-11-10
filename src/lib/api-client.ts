/**
 * Centralized API client with retry logic and error handling
 * Requirements: 1.1, 1.4, 1.5
 */

export interface ApiClientOptions {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  skipRetry?: boolean;
}

const DEFAULT_OPTIONS: Required<ApiClientOptions> = {
  baseUrl: '',
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
};

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number, baseDelay: number): number {
  return baseDelay * Math.pow(2, attempt);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // Network errors
    return true;
  }
  if (error instanceof Response) {
    // Retry on 5xx errors and 429 (rate limit)
    return error.status >= 500 || error.status === 429;
  }
  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = (completed: boolean) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      resolve(completed);
    };
    const cancel = () => finish(false);
    const timer = setTimeout(() => finish(true), ms);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
  });
}

/**
 * Build URL with query parameters
 */
function buildUrl(baseUrl: string, path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path, baseUrl || window.location.origin);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  
  return url.toString();
}

export class ApiClient {
  private options: Required<ApiClientOptions>;
  private onError?: (error: string, retry?: () => void) => void;

  constructor(options: ApiClientOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Set error handler for toast notifications
   */
  setErrorHandler(handler: (error: string, retry?: () => void) => void): void {
    this.onError = handler;
  }

  /**
   * Execute fetch with retry logic
   */
  private async fetchWithRetry<T>(
    url: string,
    init: RequestInit,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { retries, retryDelay, timeout } = this.options;
    const maxAttempts = options.skipRetry ? 1 : Math.max(1, retries);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (options.signal?.aborted) {
        return { success: false, error: 'Request was cancelled' };
      }
      const controller = new AbortController();
      let timedOut = false;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeout);
      const cancel = () => controller.abort();
      options.signal?.addEventListener('abort', cancel, { once: true });
      try {
        let response: Response;
        let data;
        try {
          response = await fetch(url, {
            ...init,
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              ...init.headers,
              ...options.headers,
            },
          });
          data = await response.json();
        } finally {
          // Also clean up when fetch/json throws, before waiting for a retry.
          clearTimeout(timeoutId);
          options.signal?.removeEventListener('abort', cancel);
        }

        if (!response.ok) {
          // Check if we should retry
          if (attempt < maxAttempts - 1 && isRetryableError(response)) {
            if (!await sleep(getBackoffDelay(attempt, retryDelay), options.signal)) {
              return { success: false, error: 'Request was cancelled' };
            }
            continue;
          }

          // Return error response
          return {
            success: false,
            error: data.error || `HTTP ${response.status}: ${response.statusText}`,
          };
        }

        return data as ApiResponse<T>;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (options.signal?.aborted) {
          return { success: false, error: 'Request was cancelled' };
        }
        if (timedOut) lastError = new Error('Request timed out');

        // Check if we should retry
        if (attempt < maxAttempts - 1 && (timedOut || isRetryableError(error))) {
          if (!await sleep(getBackoffDelay(attempt, retryDelay), options.signal)) {
            return { success: false, error: 'Request was cancelled' };
          }
          continue;
        }

        // Handle abort
        if (lastError.name === 'AbortError') {
          return {
            success: false,
            error: 'Request was cancelled',
          };
        }
      }
    }

    // All retries exhausted
    const errorMessage = lastError?.message || 'Request failed after retries';
    return {
      success: false,
      error: errorMessage,
    };
  }

  /**
   * Handle error with optional toast notification
   */
  private handleError<T>(response: ApiResponse<T>, retryFn?: () => Promise<ApiResponse<T>>): ApiResponse<T> {
    if (!response.success && response.error && this.onError) {
      this.onError(response.error, retryFn ? () => { retryFn(); } : undefined);
    }
    return response;
  }

  /**
   * GET request
   */
  async get<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const url = buildUrl(this.options.baseUrl, path, options.params);
    
    const response = await this.fetchWithRetry<T>(url, { method: 'GET' }, options);
    if (options.signal?.aborted) return response;
    
    return this.handleError(response, () => this.get<T>(path, options));
  }

  /**
   * POST request
   */
  async post<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const url = buildUrl(this.options.baseUrl, path);
    
    const response = await this.fetchWithRetry<T>(
      url,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      options
    );
    
    return this.handleError(response, () => this.post<T>(path, body, options));
  }

  /**
   * PUT request
   */
  async put<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const url = buildUrl(this.options.baseUrl, path);
    
    const response = await this.fetchWithRetry<T>(
      url,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
      options
    );
    
    return this.handleError(response, () => this.put<T>(path, body, options));
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const url = buildUrl(this.options.baseUrl, path, options.params);
    
    const response = await this.fetchWithRetry<T>(url, { method: 'DELETE' }, options);
    
    return this.handleError(response, () => this.delete<T>(path, options));
  }
}

// Singleton instance
let apiClientInstance: ApiClient | null = null;

/**
 * Get the global API client instance
 */
export function getApiClient(options?: ApiClientOptions): ApiClient {
  if (!apiClientInstance) {
    apiClientInstance = new ApiClient(options);
  }
  return apiClientInstance;
}

/**
 * Reset the global API client instance (useful for testing)
 */
export function resetApiClient(): void {
  apiClientInstance = null;
}

/**
 * Create API error response (for use in API routes)
 */
export function createErrorResponse(error: string, code?: string): ApiResponse<never> {
  return {
    success: false,
    error,
    ...(code && { code }),
  } as ApiResponse<never>;
}

/**
 * Create API success response (for use in API routes)
 */
export function createSuccessResponse<T>(data: T, pagination?: PaginationInfo): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(pagination && { pagination }),
  };
}
