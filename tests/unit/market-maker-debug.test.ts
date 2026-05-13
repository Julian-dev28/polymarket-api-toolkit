import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MarketMakerHealth } from '../../src/troubleshooting/market-maker-debug';
import { MarketMakerDebugger } from '../../src/troubleshooting/market-maker-debug';

vi.mock('pino', () => ({
  default: vi.fn().mockReturnValue({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const mockAxiosGet = vi.fn();
vi.mock('axios', () => ({
  default: { get: mockAxiosGet },
}));

describe('MarketMakerDebugger', () => {
  let mm: MarketMakerDebugger;

  beforeEach(() => {
    mm = new MarketMakerDebugger();
    vi.clearAllMocks();
    mockAxiosGet.mockReset();
  });

  // ---- checkMarketHealth ----
  describe('checkMarketHealth', () => {
    it('should return healthy status with all endpoints successful', async () => {
      mockAxiosGet.mockImplementation(({ url }: any) => {
        const data: Record<string, any> = {
          'https://clob.polymarket.com/midprice?tokenID=tok-1': { midprice: '0.65' },
          'https://clob.polymarket.com/spread?tokenID=tok-1': { spread: '0.10', spreadPercent: '15.38' },
          'https://clob.polymarket.com/orderbook?tokenID=tok-1': { bids: [{ size: '100' }], asks: [{ size: '150' }] },
          'https://clob.polymarket.com/last-trade-price?tokenID=tok-1': { price: '0.65' },
          'https://clob.polymarket.com/tick-size?tokenID=tok-1': { tick_size: '0.01' },
          'https://clob.polymarket.com/fee?tokenID=tok-1': { fee: '0.0001' },
          'https://clob.polymarket.com/neg-risk?tokenID=tok-1': { neg_risk: false },
          'https://clob.polymarket.com/risk-limits?tokenID=tok-1': { maxNotional: '100000' },
        };
        return Promise.resolve({ data: data[url] || {} });
      });

      const health = await mm.checkMarketHealth('tok-1');
      expect(health.midprice).not.toBeNull();
      expect(health.midprice!.price).toBeCloseTo(0.65, 5);
      expect(health.spread).not.toBeNull();
      expect(health.spread!.absolute).toBeCloseTo(0.10, 5);
      expect(health.orderbook).not.toBeNull();
      expect(health.orderbook!.bidDepth).toBe(100);
      expect(health.orderbook!.askDepth).toBe(150);
      expect(health.orderbook!.bidCount).toBe(1);
      expect(health.orderbook!.askCount).toBe(1);
      expect(health.lastTrade).not.toBeNull();
      expect(health.tickSize).toBe('0.01');
      expect(health.fee).toBe('0.0001');
      expect(health.isNegRisk).toBe(false);
      expect(health.overall).toBe('healthy');
    });

    it('should return degraded when bid or ask depth is 0', async () => {
      mockAxiosGet.mockImplementation(({ url }: any) => {
        const data: Record<string, any> = {
          'https://clob.polymarket.com/midprice?tokenID=tok-1': { midprice: '0.65' },
          'https://clob.polymarket.com/spread?tokenID=tok-1': { spread: '0.10', spreadPercent: '15.38' },
          'https://clob.polymarket.com/orderbook?tokenID=tok-1': { bids: [], asks: [{ size: '150' }] },
          'https://clob.polymarket.com/last-trade-price?tokenID=tok-1': { price: '0.65' },
        };
        return Promise.resolve({ data: data[url] || {} });
      });

      const health = await mm.checkMarketHealth('tok-1');
      expect(health.overall).toBe('degraded');
      expect(health.orderbook!.bidDepth).toBe(0);
    });

    it('should handle endpoint failures gracefully', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Network Error'));

      const health = await mm.checkMarketHealth('tok-1');
      expect(health.midprice).toBeNull();
      expect(health.spread).toBeNull();
      expect(health.orderbook).toBeNull();
      expect(health.lastTrade).toBeNull();
      expect(health.tickSize).toBeNull();
      expect(health.fee).toBeNull();
      expect(health.isNegRisk).toBeNull();
      expect(health.overall).toBe('healthy');
    });

    it('should return some null values when only some endpoints fail', async () => {
      mockAxiosGet.mockImplementation(({ url }: any) => {
        if (url.includes('/midprice')) return Promise.resolve({ data: { midprice: '0.50' } });
        if (url.includes('/spread')) return Promise.resolve({ data: { spread: '0.05', spreadPercent: '10.0' } });
        return Promise.reject(new Error('Not available'));
      });

      const health = await mm.checkMarketHealth('tok-1');
      expect(health.midprice).not.toBeNull();
      expect(health.spread).not.toBeNull();
      expect(health.orderbook).toBeNull();
      expect(health.lastTrade).toBeNull();
    });

    it('should call all CLOB endpoints', async () => {
      mockAxiosGet.mockResolvedValue({ data: {} });

      await mm.checkMarketHealth('tok-1');

      const calls = mockAxiosGet.mock.calls;
      const urls = calls.map((c: any) => c[0]);
      // midprice, spread, orderbook, lastTrade
      expect(urls.some((u: string) => u.includes('/midprice'))).toBe(true);
      expect(urls.some((u: string) => u.includes('/spread'))).toBe(true);
      expect(urls.some((u: string) => u.includes('/orderbook'))).toBe(true);
      expect(urls.some((u: string) => u.includes('/last-trade-price'))).toBe(true);
      // tick-size, fee, neg-risk, risk-limits
      expect(urls.some((u: string) => u.includes('/tick-size'))).toBe(true);
      expect(urls.some((u: string) => u.includes('/fee?'))).toBe(true);
      expect(urls.some((u: string) => u.includes('/neg-risk'))).toBe(true);
      expect(urls.some((u: string) => u.includes('/risk-limits'))).toBe(true);
    });
  });

  // ---- formatHealthReport ----
  describe('formatHealthReport', () => {
    it('should include midprice in report', () => {
      const health: MarketMakerHealth = {
        midprice: { price: 0.65, latency: 50 },
        spread: { absolute: 0.10, percent: 15.38, latency: 30 },
        orderbook: { bidDepth: 100, askDepth: 150, bidCount: 5, askCount: 3, latency: 40 },
        lastTrade: { price: 0.65, size: 0, latency: 20 },
        tickSize: '0.01',
        fee: '0.0001',
        isNegRisk: false,
        riskLimits: null,
        overall: 'healthy',
      };
      const report = mm.formatHealthReport(health);
      expect(report).toContain('=== Market Maker Health Report ===');
      expect(report).toContain('Midprice: 0.65 (50ms)');
      expect(report).toContain('Spread: 0.1 (15.38%) (30ms)');
      expect(report).toContain('Orderbook: 5 bids, 3 asks | Bid: 100, Ask: 150');
      expect(report).toContain('Last trade: 0.65 (20ms)');
      expect(report).toContain('Tick size: 0.01 | Fee: 0.0001 | Neg-risk: false');
      expect(report).toContain('OVERALL: HEALTHY');
    });

    it('should omit null fields', () => {
      const health: MarketMakerHealth = {
        midprice: null, spread: null, orderbook: null, lastTrade: null,
        tickSize: null, fee: null, isNegRisk: null, riskLimits: null, overall: 'degraded',
      };
      const report = mm.formatHealthReport(health);
      expect(report).not.toContain('Midprice:');
      expect(report).not.toContain('Spread:');
      expect(report).not.toContain('Orderbook:');
      expect(report).not.toContain('Last trade:');
      expect(report).toContain('Tick size: N/A | Fee: N/A | Neg-risk: N/A');
      expect(report).toContain('DEGRADED');
    });

    it('should include N/A for null tickSize/fee/isNegRisk', () => {
      const health: MarketMakerHealth = {
        midprice: null, spread: null, orderbook: null, lastTrade: null,
        tickSize: null, fee: null, isNegRisk: null, riskLimits: null, overall: 'unhealthy',
      };
      const report = mm.formatHealthReport(health);
      expect(report).toContain('Tick size: N/A | Fee: N/A | Neg-risk: N/A');
      expect(report).toContain('UNHEALTHY');
    });
  });
});
