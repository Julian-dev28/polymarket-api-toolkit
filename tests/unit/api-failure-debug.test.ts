import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiFailureDebugger } from '../../src/troubleshooting/api-failure-debug';

const mocks = vi.hoisted(() => ({
  mockAxios: vi.fn(),
}));

vi.mock('pino', () => ({
  default: vi.fn().mockReturnValue({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('axios', () => ({
  default: mocks.mockAxios,
}));

describe('ApiFailureDebugger', () => {
  let debugger_: ApiFailureDebugger;

  beforeEach(() => {
    debugger_ = new ApiFailureDebugger();
    vi.clearAllMocks();
    mocks.mockAxios.mockReset();
  });

  // ---- debugApiFailure ----
  describe('debugApiFailure', () => {
    it('should make request and return result with status when successful', async () => {
      mocks.mockAxios.mockResolvedValue({ status: 200, data: { ok: true } });

      const result = await debugger_.debugApiFailure({ url: 'https://example.com/api' });
      expect(result.endpoint).toBe('https://example.com/api');
      expect(result.method).toBe('GET');
      expect(result.status).toBe(200);
      expect(result.statusCode).toBe(200);
      expect(result.requestDuration).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
    });

    it('should handle 401 errors', async () => {
      mocks.mockAxios.mockRejectedValue({
        response: { status: 401, data: { err: 'Invalid API credentials' } },
      });

      const result = await debugger_.debugApiFailure({ url: 'https://example.com/api' });
      expect(result.status).toBe(401);
      expect(result.errorCategory).toBe('authentication');
      expect(result.possibleCauses.length).toBeGreaterThan(0);
      expect(result.suggestedFixes.length).toBeGreaterThan(0);
      expect(result.possibleCauses[0]).toContain('Invalid API key');
    });

    it('should handle 404 errors', async () => {
      mocks.mockAxios.mockRejectedValue({
        response: { status: 404, data: { error: 'Not found' } },
      });

      const result = await debugger_.debugApiFailure({ url: 'https://example.com/api' });
      expect(result.errorCategory).toBe('not_found');
      expect(result.possibleCauses[0]).toContain('Token ID does not exist');
    });

    it('should handle 422 validation errors', async () => {
      mocks.mockAxios.mockRejectedValue({
        response: { status: 422, data: { err: 'Price out of valid range' } },
      });

      const result = await debugger_.debugApiFailure({ url: 'https://example.com/api' });
      expect(result.errorCategory).toBe('validation');
      expect(result.possibleCauses[0]).toContain('Price out of valid range');
    });

    it('should handle 429 rate limit errors', async () => {
      mocks.mockAxios.mockRejectedValue({
        response: { status: 429, data: { error: 'Rate limited' } },
      });

      const result = await debugger_.debugApiFailure({ url: 'https://example.com/api' });
      expect(result.errorCategory).toBe('rate_limit');
      expect(result.suggestedFixes[0]).toContain('exponential backoff');
    });

    it('should handle 500/502/503 server errors', async () => {
      mocks.mockAxios.mockRejectedValue({
        response: { status: 500, data: { error: 'Internal server error' } },
      });

      const result = await debugger_.debugApiFailure({ url: 'https://example.com/api' });
      expect(result.errorCategory).toBe('server_error');
      expect(result.possibleCauses[0]).toContain('CLOB matching engine is down');
    });

    it('should handle timeout errors (ECONNABORTED)', async () => {
      mocks.mockAxios.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
      });

      const result = await debugger_.debugApiFailure({ url: 'https://example.com/api' });
      expect(result.errorCategory).toBe('timeout');
      expect(result.possibleCauses[0]).toContain('Server took too long to respond');
    });

    it('should handle network errors (no response)', async () => {
      mocks.mockAxios.mockRejectedValue({
        message: 'Network Error',
      });

      const result = await debugger_.debugApiFailure({ url: 'https://example.com/api' });
      expect(result.errorCategory).toBe('network');
      expect(result.possibleCauses[0]).toContain('DNS resolution failed');
    });

    it('should handle unknown errors as category unknown', async () => {
      mocks.mockAxios.mockRejectedValue({
        response: { status: 418, data: { error: "I'm a teapot" } },
      });

      const result = await debugger_.debugApiFailure({ url: 'https://example.com/api' });
      expect(result.errorCategory).toBe('unknown');
    });

    it('should support custom method', async () => {
      mocks.mockAxios.mockResolvedValue({ status: 201 });

      const result = await debugger_.debugApiFailure({
        url: 'https://example.com/api',
        method: 'POST',
        body: { test: 'data' },
      });
      expect(result.method).toBe('POST');
    });

    it('should handle axios instance rejection', async () => {
      mocks.mockAxios.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await debugger_.debugApiFailure({ url: 'https://example.com/api' });
      expect(result.error).toBe('ECONNREFUSED');
      expect(result.status).toBeNull();
    });
  });

  // ---- healthCheckEndpoints ----
  describe('healthCheckEndpoints', () => {
    it('should check CLOB health and nonce endpoints', async () => {
      mocks.mockAxios.mockResolvedValue({ status: 200 });

      const results = await debugger_.healthCheckEndpoints();
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('CLOB Health');
      expect(results[1].name).toBe('CLOB Nonce');
    });

    it('should mark unhealthy endpoints on failure', async () => {
      mocks.mockAxios.mockRejectedValue(new Error('Connection refused'));

      const results = await debugger_.healthCheckEndpoints();
      expect(results).toHaveLength(2);
      expect(results[0].healthy).toBe(false);
      expect(results[0].status).toBe(0);
    });

    it('should record response times', async () => {
      mocks.mockAxios.mockResolvedValue({ status: 200 });

      const results = await debugger_.healthCheckEndpoints();
      expect(results[0].responseTime).toBeGreaterThanOrEqual(0);
      expect(results[1].responseTime).toBeGreaterThanOrEqual(0);
    });
  });
});
