export const PolymarketEndpoints = {
  CLOB: {
    baseUrl: 'https://clob.polymarket.com',
    health: '/health',
    nonce: '/nonce',
    servers: '/servers',
    midPrice: (tokenID: string) => `/midprice?tokenID=${tokenID}`,
    spread: (tokenID: string) => `/spread?tokenID=${tokenID}`,
    orderbook: (tokenID: string) => `/orderbook?tokenID=${tokenID}`,
    orderbookAll: '/orderbook/all',
    candles: (tokenID: string) => `/candles?tokenID=${tokenID}`,
    trades: (tokenID?: string, sortBy?: string, order?: 'asc' | 'desc', cursor?: string, limit?: number) => {
      const params = new URLSearchParams();
      if (tokenID) params.set('token_id', tokenID);
      if (sortBy) params.set('sort_by', sortBy);
      if (order) params.set('order', order);
      if (cursor) params.set('cursor', cursor);
      if (limit) params.set('limit', String(limit));
      return `/trades?${params.toString()}`;
    },
    lastTradePrice: (tokenID: string) => `/last-trade-price?tokenID=${tokenID}`,
    tickSize: (tokenID: string) => `/tick-size?tokenID=${tokenID}`,
    negRisk: (tokenID: string) => `/neg-risk?tokenID=${tokenID}`,
    fee: (tokenID: string) => `/fee?tokenID=${tokenID}`,
    feeLevels: (tokenID: string) => `/fee-levels?tokenID=${tokenID}`,
    riskLimits: (tokenID: string) => `/risk-limits?tokenID=${tokenID}`,
  },
  DATA: {
    baseUrl: 'https://data-api.polymarket.com',
    events: '/events',
    event: (id: string) => `/events/${id}`,
    markets: '/markets',
    market: (id: string) => `/markets/${id}`,
    positions: (user: string) => `/positions?user=${user}`,
    trades: (user?: string, market?: string, cursor?: string, limit?: number) => {
      const params = new URLSearchParams();
      if (user) params.set('user', user);
      if (market) params.set('market', market);
      if (cursor) params.set('cursor', cursor);
      if (limit) params.set('limit', String(limit));
      return `/trades?${params.toString()}`;
    },
    holderData: (market: string) => `/holder-data?market=${market}`,
    openInterest: (market: string) => `/open-interest?market=${market}`,
    leaderboard: '/leaderboard',
    builderAnalytics: '/builder-analytics',
    builderActivity: (builder: string) => `/builder-activity/${builder}`,
  },
  GAMMA: {
    baseUrl: 'https://gamma-api.polymarket.com',
    events: '/events',
    event: (id: string) => `/events/${id}`,
    markets: '/markets',
    market: (id: string) => `/markets/${id}`,
    conditions: '/conditions',
    condition: (id: string) => `/conditions/${id}`,
    outcomes: (conditionId: string) => `/conditions/${conditionId}/outcomes`,
    tokens: (conditionId: string) => `/conditions/${conditionId}/tokens`,
    resolver: (marketId: string) => `/markets/${marketId}/resolver`,
    activity: '/activity',
  },
  WS: {
    baseUrl: 'wss://ws-polymarket.coinbase.com',
    orderbook: (tokenID: string) => `/orderbook/${tokenID}`,
    trades: (tokenID: string) => `/trades/${tokenID}`,
  },
} as const;

export const ChainConfig = {
  polygon: {
    chainId: 137,
    name: 'Polygon PoS',
    rpcUrl: 'https://polygon-rpc.com',
    multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11' as const,
    blockExplorer: 'https://polygonscan.com',
  },
  polygonZkEvm: {
    chainId: 1101,
    name: 'Polygon zkEVM',
    rpcUrl: 'https://zkevm-rpc.com',
  },
} as const;

export const TokenConfig = {
  USDCE: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const,
  USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as const,
} as const;

export const ContractConfig = {
  Exchange: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' as const,
  CTF: '0x275251d121Db229B2C41cc8BdA1a6ac35B4BC7b6' as const,
  CTFRelay: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' as const,
  Onramp: '0x93070a847efEf7F70739046A929D47a521F5B8ee' as const,
} as const;

export const ClobConfig = {
  host: 'https://clob.polymarket.com',
  chainId: 137,
  sigType: 1,
  maxRetries: 3,
  retryDelayMs: 1000,
  wsReconnectIntervalMs: 5000,
  wsMaxReconnectAttempts: 10,
} as const;

export const ApiErrorCodes = {
  INVALID_API_CREDS: 'INVALID_API_CREDS',
  ORDER_REJECTED: 'ORDER_REJECTED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  PRICE_TOO_LOW: 'PRICE_TOO_LOW',
  PRICE_TOO_HIGH: 'PRICE_TOO_HIGH',
  MIN_SIZE_VIOLATION: 'MIN_SIZE_VIOLATION',
  MIN_NOTIONAL_VIOLATION: 'MIN_NOTIONAL_VIOLATION',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  WALLET_DISCONNECTED: 'WALLET_DISCONNECTED',
  BLOCKED_MARKET: 'BLOCKED_MARKET',
  NEG_RISK_MARKET: 'NEG_RISK_MARKET',
  TICK_SIZE_VIOLATION: 'TICK_SIZE_VIOLATION',
  FEED_ERROR: 'FEED_ERROR',
} as const;
