import pino from 'pino';
import axios from 'axios';
import { PolymarketEndpoints } from '../config';

export interface MarketMakerHealth {
  midprice: { price: number; latency: number } | null;
  spread: { absolute: number; percent: number; latency: number } | null;
  orderbook: { bidDepth: number; askDepth: number; bidCount: number; askCount: number; latency: number } | null;
  lastTrade: { price: number; size: number; latency: number } | null;
  tickSize: string | null;
  fee: string | null;
  isNegRisk: boolean | null;
  riskLimits: any | null;
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

export class MarketMakerDebugger {
  private logger: pino.Logger;

  constructor(logger?: pino.Logger) {
    this.logger = logger || pino({ level: 'info' });
  }

  async checkMarketHealth(tokenID: string): Promise<MarketMakerHealth> {
    const health: MarketMakerHealth = {
      midprice: null, spread: null, orderbook: null, lastTrade: null,
      tickSize: null, fee: null, isNegRisk: null, riskLimits: null, overall: 'healthy',
    };

    const base = PolymarketEndpoints.CLOB.baseUrl;
    const endpoints = [
      { key: 'midprice', url: `${base}${PolymarketEndpoints.CLOB.midPrice(tokenID)}`, parse: (r: any) => ({ price: parseFloat(r.midprice), latency: 0 }) },
      { key: 'spread', url: `${base}${PolymarketEndpoints.CLOB.spread(tokenID)}`, parse: (r: any) => ({ absolute: parseFloat(r.spread), percent: parseFloat(r.spreadPercent), latency: 0 }) },
      { key: 'orderbook', url: `${base}${PolymarketEndpoints.CLOB.orderbook(tokenID)}`, parse: (r: any) => ({ bidDepth: r.bids?.reduce((s: number, b: any) => s + parseFloat(b.size || 0), 0) || 0, askDepth: r.asks?.reduce((s: number, a: any) => s + parseFloat(a.size || 0), 0) || 0, bidCount: r.bids?.length || 0, askCount: r.asks?.length || 0, latency: 0 }) },
      { key: 'lastTrade', url: `${base}${PolymarketEndpoints.CLOB.lastTradePrice(tokenID)}`, parse: (r: any) => ({ price: parseFloat(r.price), size: 0, latency: 0 }) },
    ];

    for (const ep of endpoints) {
      try {
        const start = Date.now();
        const res = await axios.get(ep.url, { timeout: 5000 });
        (health as any)[ep.key] = { ...ep.parse(res.data), latency: Date.now() - start };
      } catch {}
    }

    if (health.orderbook && (health.orderbook.bidDepth === 0 || health.orderbook.askDepth === 0)) {
      health.overall = 'degraded';
    }

    try { const r = await axios.get(`${base}${PolymarketEndpoints.CLOB.tickSize(tokenID)}`); health.tickSize = r.data.tick_size; } catch {}
    try { const r = await axios.get(`${base}${PolymarketEndpoints.CLOB.fee(tokenID)}`); health.fee = r.data.fee; } catch {}
    try { const r = await axios.get(`${base}${PolymarketEndpoints.CLOB.negRisk(tokenID)}`); health.isNegRisk = r.data.neg_risk; } catch {}
    try { const r = await axios.get(`${base}${PolymarketEndpoints.CLOB.riskLimits(tokenID)}`); health.riskLimits = r.data; } catch {}

    return health;
  }

  formatHealthReport(health: MarketMakerHealth): string {
    let out = '\n=== Market Maker Health Report ===\n\n';
    if (health.midprice) out += `Midprice: ${health.midprice.price} (${health.midprice.latency}ms)\n`;
    if (health.spread) out += `Spread: ${health.spread.absolute} (${health.spread.percent}%) (${health.spread.latency}ms)\n`;
    if (health.orderbook) out += `Orderbook: ${health.orderbook.bidCount} bids, ${health.orderbook.askCount} asks | Bid: ${health.orderbook.bidDepth}, Ask: ${health.orderbook.askDepth}\n`;
    if (health.lastTrade) out += `Last trade: ${health.lastTrade.price} (${health.lastTrade.latency}ms)\n`;
    out += `Tick size: ${health.tickSize || 'N/A'} | Fee: ${health.fee || 'N/A'} | Neg-risk: ${health.isNegRisk ?? 'N/A'}\n`;
    out += `Overall: ${health.overall.toUpperCase()}\n`;
    return out;
  }
}
