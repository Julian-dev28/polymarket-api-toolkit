import pino from 'pino';
import axios from 'axios';
import { PolymarketEndpoints, ApiErrorCodes } from '../config';

export interface ApiFailureResult {
  endpoint: string;
  method: string;
  status: number | null;
  statusCode: number | null;
  error: string | null;
  errorCategory: string;
  possibleCauses: string[];
  suggestedFixes: string[];
  requestDuration: number;
  timestamp: string;
}

export class ApiFailureDebugger {
  private logger: pino.Logger;

  constructor(logger?: pino.Logger) {
    this.logger = logger || pino({ level: 'info' });
  }

  async debugApiFailure(params: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    apiKey?: string;
    apiSecret?: string;
    passphrase?: string;
  }): Promise<ApiFailureResult> {
    this.logger.info('Debugging API failure:', params.url);
    const start = Date.now();

    const result: ApiFailureResult = {
      endpoint: params.url,
      method: params.method || 'GET',
      status: null,
      statusCode: null,
      error: null,
      errorCategory: 'unknown',
      possibleCauses: [],
      suggestedFixes: [],
      requestDuration: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      const config: any = {
        method: result.method,
        url: params.url,
        timeout: 30000,
        headers: { 'Content-Type': 'application/json', ...params.headers },
      };

      if (params.body) config.data = params.body;

      const response = await axios(config);
      result.status = response.status;
      result.statusCode = response.status;
    } catch (err: any) {
      result.status = err.response?.status ?? null;
      result.statusCode = err.response?.status ?? null;
      result.error = err.response?.data?.err ?? err.response?.data?.error ?? err.message;

      const { causes, fixes, category } = this.diagnoseError(err);
      result.errorCategory = category;
      result.possibleCauses = causes;
      result.suggestedFixes = fixes;
    }

    result.requestDuration = Date.now() - start;
    return result;
  }

  async healthCheckEndpoints(): Promise<Array<{
    name: string;
    url: string;
    status: number;
    responseTime: number;
    healthy: boolean;
  }>> {
    const endpoints = [
      { name: 'CLOB Health', url: `${PolymarketEndpoints.CLOB.baseUrl}${PolymarketEndpoints.CLOB.health}` },
      { name: 'CLOB Nonce', url: `${PolymarketEndpoints.CLOB.baseUrl}${PolymarketEndpoints.CLOB.nonce}` },
    ];

    const results = [];
    for (const ep of endpoints) {
      const start = Date.now();
      try {
        const res = await axios.get(ep.url, { timeout: 10000 });
        results.push({
          name: ep.name,
          url: ep.url,
          status: res.status,
          responseTime: Date.now() - start,
          healthy: true,
        });
      } catch {
        results.push({
          name: ep.name,
          url: ep.url,
          status: 0,
          responseTime: Date.now() - start,
          healthy: false,
        });
      }
    }
    return results;
  }

  private diagnoseError(err: any): {
    causes: string[];
    fixes: string[];
    category: string;
  } {
    const status = err.response?.status;
    const message = (err.response?.data?.err ?? err.response?.data?.error ?? err.message ?? '').toLowerCase();
    const causes: string[] = [];
    const fixes: string[] = [];
    let category = 'unknown';

    if (status === 401 || status === 403) {
      category = 'authentication';
      causes.push('Invalid API key or passphrase');
      causes.push('Expired or revoked API credentials');
      causes.push('Signature mismatch — verify HMAC-SHA256 signing');
      causes.push('Nonce too low — ensure monotonically increasing');
      fixes.push('Regenerate API keys via Polymarket dashboard');
      fixes.push('Verify timestamp is within 60s of server time');
      fixes.push('Check signature matches: HMAC-SHA256(secret, method + path + timestamp + nonce + body)');
    } else if (status === 404) {
      category = 'not_found';
      causes.push('Token ID does not exist');
      causes.push('Market has been resolved or delisted');
      causes.push('Invalid endpoint path');
      fixes.push('Verify token ID via /markets API');
      fixes.push('Check if market is still active');
    } else if (status === 422) {
      category = 'validation';
      causes.push('Price out of valid range for this market');
      causes.push('Size below minimum tradable amount');
      causes.push('Tick size violation');
      causes.push('Notional value below minimum');
      fixes.push('Check tick-size endpoint for this token');
      fixes.push('Ensure price is within spread range');
      fixes.push('Verify minimum size via /risk-limits');
    } else if (status === 429) {
      category = 'rate_limit';
      causes.push('Too many requests to API');
      causes.push('Rate limit window exceeded');
      fixes.push('Implement exponential backoff');
      fixes.push('Add request queuing/throttling');
      fixes.push('Reduce request frequency');
    } else if (status === 500 || status === 502 || status === 503) {
      category = 'server_error';
      causes.push('CLOB matching engine is down');
      causes.push('Database connection issues');
      causes.push('Service overload');
      fixes.push('Retry with exponential backoff');
      fixes.push('Check status.polymarket.com');
      fixes.push('Contact support if persistent');
    } else if (err.code === 'ECONNABORTED') {
      category = 'timeout';
      causes.push('Server took too long to respond');
      causes.push('Network connectivity issue');
      fixes.push('Increase timeout threshold');
      fixes.push('Check network connectivity');
    } else if (!err.response) {
      category = 'network';
      causes.push('DNS resolution failed');
      causes.push('SSL/TLS certificate error');
      causes.push('Network unreachable');
      fixes.push('Check internet connection');
      fixes.push('Verify proxy configuration');
    }

    return { causes, fixes, category };
  }
}
