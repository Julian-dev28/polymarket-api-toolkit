import { describe, it, expect } from 'vitest';
import { PolymarketEndpoints, ChainConfig, TokenConfig, ContractConfig, ClobConfig, ApiErrorCodes } from '../../src/config/endpoints';

describe('PolymarketEndpoints', () => {
  it('should have CLOB, DATA, GAMMA, WS keys', () => {
    expect(PolymarketEndpoints).toHaveProperty('CLOB');
    expect(PolymarketEndpoints).toHaveProperty('DATA');
    expect(PolymarketEndpoints).toHaveProperty('GAMMA');
    expect(PolymarketEndpoints).toHaveProperty('WS');
  });

  describe('CLOB', () => {
    it('should have baseUrl', () => {
      expect(PolymarketEndpoints.CLOB.baseUrl).toBe('https://clob.polymarket.com');
    });

    it('should have health, nonce, servers paths', () => {
      expect(PolymarketEndpoints.CLOB.health).toBe('/health');
      expect(PolymarketEndpoints.CLOB.nonce).toBe('/nonce');
      expect(PolymarketEndpoints.CLOB.servers).toBe('/servers');
    });

    it('should generate midPrice URL', () => {
      expect(PolymarketEndpoints.CLOB.midPrice('tok-1')).toBe('/midprice?tokenID=tok-1');
    });

    it('should generate spread URL', () => {
      expect(PolymarketEndpoints.CLOB.spread('tok-1')).toBe('/spread?tokenID=tok-1');
    });

    it('should generate orderbook URL', () => {
      expect(PolymarketEndpoints.CLOB.orderbook('tok-1')).toBe('/orderbook?tokenID=tok-1');
    });

    it('should have orderbookAll', () => {
      expect(PolymarketEndpoints.CLOB.orderbookAll).toBe('/orderbook/all');
    });

    it('should generate candles URL', () => {
      expect(PolymarketEndpoints.CLOB.candles('tok-1')).toBe('/candles?tokenID=tok-1');
    });

    it('should generate trades URL with params', () => {
      const url = PolymarketEndpoints.CLOB.trades('tok-1', 'price', 'desc', 'cursor123', 50);
      expect(url).toContain('/trades');
      expect(url).toContain('token_id=tok-1');
      expect(url).toContain('sort_by=price');
      expect(url).toContain('order=desc');
      expect(url).toContain('cursor=cursor123');
      expect(url).toContain('limit=50');
    });

    it('should generate trades URL without params', () => {
      const url = PolymarketEndpoints.CLOB.trades();
      expect(url).toBe('/trades?');
    });

    it('should generate lastTradePrice URL', () => {
      expect(PolymarketEndpoints.CLOB.lastTradePrice('tok-1')).toBe('/last-trade-price?tokenID=tok-1');
    });

    it('should generate tickSize URL', () => {
      expect(PolymarketEndpoints.CLOB.tickSize('tok-1')).toBe('/tick-size?tokenID=tok-1');
    });

    it('should generate negRisk URL', () => {
      expect(PolymarketEndpoints.CLOB.negRisk('tok-1')).toBe('/neg-risk?tokenID=tok-1');
    });

    it('should generate fee URL', () => {
      expect(PolymarketEndpoints.CLOB.fee('tok-1')).toBe('/fee?tokenID=tok-1');
    });

    it('should generate feeLevels URL', () => {
      expect(PolymarketEndpoints.CLOB.feeLevels('tok-1')).toBe('/fee-levels?tokenID=tok-1');
    });

    it('should generate riskLimits URL', () => {
      expect(PolymarketEndpoints.CLOB.riskLimits('tok-1')).toBe('/risk-limits?tokenID=tok-1');
    });
  });

  describe('DATA', () => {
    it('should have baseUrl', () => {
      expect(PolymarketEndpoints.DATA.baseUrl).toBe('https://data-api.polymarket.com');
    });

    it('should have events, markets paths', () => {
      expect(PolymarketEndpoints.DATA.events).toBe('/events');
      expect(PolymarketEndpoints.DATA.markets).toBe('/markets');
    });

    it('should generate event/market paths', () => {
      expect(PolymarketEndpoints.DATA.event('evt-1')).toBe('/events/evt-1');
      expect(PolymarketEndpoints.DATA.market('mkt-1')).toBe('/markets/mkt-1');
    });

    it('should generate positions path', () => {
      expect(PolymarketEndpoints.DATA.positions('0x1234')).toBe('/positions?user=0x1234');
    });

    it('should generate holderData path', () => {
      expect(PolymarketEndpoints.DATA.holderData('mkt-1')).toBe('/holder-data?market=mkt-1');
    });

    it('should generate openInterest path', () => {
      expect(PolymarketEndpoints.DATA.openInterest('mkt-1')).toBe('/open-interest?market=mkt-1');
    });

    it('should have leaderboard and builder endpoints', () => {
      expect(PolymarketEndpoints.DATA.leaderboard).toBe('/leaderboard');
      expect(PolymarketEndpoints.DATA.builderAnalytics).toBe('/builder-analytics');
      expect(PolymarketEndpoints.DATA.builderActivity('builder-1')).toBe('/builder-activity/builder-1');
    });
  });

  describe('GAMMA', () => {
    it('should have baseUrl', () => {
      expect(PolymarketEndpoints.GAMMA.baseUrl).toBe('https://gamma-api.polymarket.com');
    });

    it('should have events, markets, conditions paths', () => {
      expect(PolymarketEndpoints.GAMMA.events).toBe('/events');
      expect(PolymarketEndpoints.GAMMA.markets).toBe('/markets');
      expect(PolymarketEndpoints.GAMMA.conditions).toBe('/conditions');
    });

    it('should generate conditional paths', () => {
      expect(PolymarketEndpoints.GAMMA.event('evt-1')).toBe('/events/evt-1');
      expect(PolymarketEndpoints.GAMMA.market('mkt-1')).toBe('/markets/mkt-1');
      expect(PolymarketEndpoints.GAMMA.condition('cond-1')).toBe('/conditions/cond-1');
      expect(PolymarketEndpoints.GAMMA.outcomes('cond-1')).toBe('/conditions/cond-1/outcomes');
      expect(PolymarketEndpoints.GAMMA.tokens('cond-1')).toBe('/conditions/cond-1/tokens');
      expect(PolymarketEndpoints.GAMMA.resolver('mkt-1')).toBe('/markets/mkt-1/resolver');
    });

    it('should have activity path', () => {
      expect(PolymarketEndpoints.GAMMA.activity).toBe('/activity');
    });
  });

  describe('WS', () => {
    it('should have baseUrl', () => {
      expect(PolymarketEndpoints.WS.baseUrl).toBe('wss://ws-polymarket.coinbase.com');
    });

    it('should generate orderbook/trades WebSocket paths', () => {
      expect(PolymarketEndpoints.WS.orderbook('tok-1')).toBe('/orderbook/tok-1');
      expect(PolymarketEndpoints.WS.trades('tok-1')).toBe('/trades/tok-1');
    });
  });
});

describe('ChainConfig', () => {
  it('should have polygon chain config', () => {
    expect(ChainConfig.polygon.chainId).toBe(137);
    expect(ChainConfig.polygon.name).toBe('Polygon PoS');
    expect(ChainConfig.polygon.rpcUrl).toBe('https://polygon-rpc.com');
    expect(ChainConfig.polygon.multicall3).toBe('0xcA11bde05977b3631167028862bE2a173976CA11');
    expect(ChainConfig.polygon.blockExplorer).toBe('https://polygonscan.com');
  });

  it('should have polygonZkEvm chain config', () => {
    expect(ChainConfig.polygonZkEvm.chainId).toBe(1101);
    expect(ChainConfig.polygonZkEvm.name).toBe('Polygon zkEVM');
    expect(ChainConfig.polygonZkEvm.rpcUrl).toBe('https://zkevm-rpc.com');
  });
});

describe('TokenConfig', () => {
  it('should have USDCE address', () => {
    expect(TokenConfig.USDCE).toBe('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174');
  });

  it('should have USDC address', () => {
    expect(TokenConfig.USDC).toBe('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359');
  });
});

describe('ContractConfig', () => {
  it('should have Exchange address', () => {
    expect(ContractConfig.Exchange).toBe('0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E');
  });

  it('should have CTF address', () => {
    expect(ContractConfig.CTF).toBe('0x275251d121Db229B2C41cc8BdA1a6ac35B4BC7b6');
  });

  it('should have CTFRelay address', () => {
    expect(ContractConfig.CTFRelay).toBe('0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E');
  });

  it('should have Onramp address', () => {
    expect(ContractConfig.Onramp).toBe('0x93070a847efEf7F70739046A929D47a521F5B8ee');
  });
});

describe('ApiErrorCodes', () => {
  it('should have all error code mappings', () => {
    expect(ApiErrorCodes.INVALID_API_CREDS).toBe('INVALID_API_CREDS');
    expect(ApiErrorCodes.ORDER_REJECTED).toBe('ORDER_REJECTED');
    expect(ApiErrorCodes.INSUFFICIENT_FUNDS).toBe('INSUFFICIENT_FUNDS');
    expect(ApiErrorCodes.PRICE_TOO_LOW).toBe('PRICE_TOO_LOW');
    expect(ApiErrorCodes.PRICE_TOO_HIGH).toBe('PRICE_TOO_HIGH');
    expect(ApiErrorCodes.MIN_SIZE_VIOLATION).toBe('MIN_SIZE_VIOLATION');
    expect(ApiErrorCodes.MIN_NOTIONAL_VIOLATION).toBe('MIN_NOTIONAL_VIOLATION');
    expect(ApiErrorCodes.RATE_LIMITED).toBe('RATE_LIMITED');
    expect(ApiErrorCodes.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
    expect(ApiErrorCodes.TIMEOUT).toBe('TIMEOUT');
    expect(ApiErrorCodes.WALLET_DISCONNECTED).toBe('WALLET_DISCONNECTED');
    expect(ApiErrorCodes.BLOCKED_MARKET).toBe('BLOCKED_MARKET');
    expect(ApiErrorCodes.NEG_RISK_MARKET).toBe('NEG_RISK_MARKET');
    expect(ApiErrorCodes.TICK_SIZE_VIOLATION).toBe('TICK_SIZE_VIOLATION');
    expect(ApiErrorCodes.FEED_ERROR).toBe('FEED_ERROR');
  });

  it('should have 15 error codes', () => {
    expect(Object.keys(ApiErrorCodes)).toHaveLength(15);
  });
});

describe('ClobConfig', () => {
  it('should have api host URL', () => {
    expect(ClobConfig.host).toBe('https://clob.polymarket.com');
  });

  it('should have chainId', () => {
    expect(ClobConfig.chainId).toBe(137);
  });

  it('should have sigType', () => {
    expect(ClobConfig.sigType).toBe(1);
  });

  it('should have retry settings', () => {
    expect(ClobConfig.maxRetries).toBe(3);
    expect(ClobConfig.retryDelayMs).toBe(1000);
  });

  it('should have WebSocket reconnect settings', () => {
    expect(ClobConfig.wsReconnectIntervalMs).toBe(5000);
    expect(ClobConfig.wsMaxReconnectAttempts).toBe(10);
  });
});
