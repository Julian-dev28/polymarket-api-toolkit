import { describe, it, expect } from 'vitest';
import {
  EventSchema,
  MarketSchema,
  ConditionSchema,
  OrderbookEntrySchema,
  OrderbookSnapshotSchema,
  TradeSchema,
  CandleSchema,
  MidpriceResponseSchema,
  SpreadResponseSchema,
  OrderResponseSchema,
  PositionSchema,
  UserTradeSchema,
  HolderDataSchema,
  OpenInterestSchema,
  TransactionReceiptSchema,
  BalanceResponseSchema,
  EscalationTicketSchema,
  ErrorPatternSchema,
  OrderSide,
  OrderType,
  MarketStatus,
} from '../../src/config/schemas';

// ============================================================
// Gamma API Schemas
// ============================================================
describe('EventSchema', () => {
  const validEvent = {
    id: 'evt-1',
    title: 'Test Event',
    slug: 'test-event',
    status: 'OPEN',
    markets: ['mkt-1', 'mkt-2'],
    tags: ['politics'],
    blocked: false,
    curated: true,
    updatedAt: '2024-01-01T00:00:00Z',
  };

  it('should validate a complete event', () => {
    const result = EventSchema.parse(validEvent);
    expect(result.id).toBe('evt-1');
    expect(result.title).toBe('Test Event');
  });

  it('should reject missing required fields', () => {
    expect(() => EventSchema.parse({})).toThrow();
  });

  it('should reject invalid status', () => {
    expect(() => EventSchema.parse({ ...validEvent, status: 'UNKNOWN' })).toThrow();
  });
});

describe('MarketSchema', () => {
  const validMarket = {
    id: 'mkt-1',
    asset: {
      id: 'asset-1',
      outcomeNames: ['Yes', 'No'],
      outcomesTokenIds: ['tok-1', 'tok-2'],
      condition: {
        conditionId: 'cond-1',
        marketType: 'binary',
        marketData: {
          marketId: 'mkt-1',
          assetAddress: '0x1234',
          categories: ['politics'],
          ctfMarketType: 'binary',
          question: 'Will X happen?',
        },
      },
      marketType: 'binary',
      question: 'Will X happen?',
    },
    condition: { conditionId: 'cond-1' },
    slug: 'will-x-happen',
    clobTokenIds: ['tok-1', 'tok-2'],
    outcomeTokens: ['tok-1', 'tok-2'],
    outcomePrices: ['0.65', '0.35'],
    lastPrice: { yes: '0.65', no: '0.35' },
    volume: '1000',
    volume24h: '500',
    openInterest: '800',
    liquidity: '200',
    status: 'OPEN',
    slash: null,
    tags: [],
    notionalValue: '1000',
    notionalValueChange24h: '50',
    percentChange24h: '5.0',
    blockNumber: 123456,
    chainId: 137,
    contractAddress: '0xabcdef',
    atomicTokenId: 'tok-3',
    lastUpdated: '2024-01-01T00:00:00Z',
  };

  it('should validate a complete market', () => {
    const result = MarketSchema.parse(validMarket);
    expect(result.id).toBe('mkt-1');
    expect(result.outcomePrices).toEqual(['0.65', '0.35']);
  });

  it('should reject invalid market status', () => {
    expect(() => MarketSchema.parse({ ...validMarket, status: 'UNKNOWN' })).toThrow();
  });

  it('should validate with nullable fields', () => {
    const partial = { ...validMarket, slash: 0.05, description: 'Test desc', imageUrl: 'https://example.com/img.png', effectiveDate: '2024-01-01', endDate: '2024-12-31', closedDate: null, customPoolId: 'pool-1' };
    const result = MarketSchema.parse(partial);
    expect(result.slash).toBe(0.05);
  });
});

describe('ConditionSchema', () => {
  it('should validate a condition with market data', () => {
    const cond = {
      id: 'c-1',
      conditionId: 'cond-1',
      marketType: 'binary',
      marketData: {
        marketId: 'mkt-1',
        assetAddress: '0x1234',
        categories: ['politics'],
        ctfMarketType: 'binary',
        question: 'Test?',
      },
      parentConditionId: null,
      dates: { effectiveDate: '2024-01-01', expirationDate: '2024-12-31' },
    };
    const result = ConditionSchema.parse(cond);
    expect(result.marketData?.question).toBe('Test?');
  });

  it('should allow null marketData', () => {
    const cond = {
      id: 'c-1',
      conditionId: 'cond-1',
      marketType: 'trinary',
      marketData: null,
      parentConditionId: 'parent-1',
      dates: { effectiveDate: null, expirationDate: null },
    };
    const result = ConditionSchema.parse(cond);
    expect(result.marketData).toBeNull();
  });
});

// ============================================================
// CLOB API Schemas
// ============================================================
describe('OrderbookEntrySchema', () => {
  it('should validate an orderbook entry', () => {
    const entry = {
      price: '0.65',
      size: '100',
      orders: [{
        orderID: 'ord-1',
        owner: '0x1234',
        signer: '0x5678',
        tokenID: 'tok-1',
        price: '0.65',
        side: 'BUY',
        nonce: '123',
        takerOrder: false,
      }],
    };
    const result = OrderbookEntrySchema.parse(entry);
    expect(result.orders[0].side).toBe('BUY');
  });

  it('should reject invalid order side', () => {
    const entry = {
      price: '0.65',
      size: '100',
      orders: [{
        orderID: 'ord-1',
        owner: '0x1234',
        signer: '0x5678',
        tokenID: 'tok-1',
        price: '0.65',
        side: 'INVALID',
        nonce: '123',
        takerOrder: false,
      }],
    };
    expect(() => OrderbookEntrySchema.parse(entry)).toThrow();
  });
});

describe('OrderbookSnapshotSchema', () => {
  it('should validate a full snapshot', () => {
    const snap = {
      market: 'mkt-1',
      asset_id: 'tok-1',
      bids: [{ price: '0.60', size: '100', orders: [] }],
      asks: [{ price: '0.70', size: '200', orders: [] }],
      timestamp: '1700000000',
    };
    const result = OrderbookSnapshotSchema.parse(snap);
    expect(result.bids.length).toBe(1);
    expect(result.asks.length).toBe(1);
  });
});

describe('TradeSchema', () => {
  it('should validate a trade record', () => {
    const trade = {
      tradeID: 'tr-1',
      orderID: 'ord-1',
      makerOrderID: 'mord-1',
      takerOrderID: 'tord-1',
      side: 'BUY',
      price: '0.65',
      size: '100',
      tokenID: 'tok-1',
      blockNumber: 123456,
      transactionIndex: 0,
      timestamp: '2024-01-01T00:00:00Z',
      maker: '0x1234',
      makerTradeNonce: '1',
      protocolFee: '0.01',
      collateralToken: '0xusdc',
      market: 'mkt-1',
      symbol: 'YES',
    };
    const result = TradeSchema.parse(trade);
    expect(result.side).toBe('BUY');
    expect(result.blockNumber).toBe(123456);
  });
});

describe('CandleSchema', () => {
  it('should validate OHLCV data', () => {
    const candle = {
      timeframe: '1h',
      id: '2024-01-01T00:00',
      low: '0.60',
      high: '0.75',
      open: '0.65',
      close: '0.70',
      volume: '5000',
      timestamp: '2024-01-01T00:00:00Z',
    };
    const result = CandleSchema.parse(candle);
    expect(result.high).toBe('0.75');
    expect(result.low).toBe('0.60');
  });
});

describe('MidpriceResponseSchema', () => {
  it('should validate a midprice response', () => {
    const resp = {
      market: 'mkt-1',
      asset_id: 'tok-1',
      midprice: '0.65',
    };
    const result = MidpriceResponseSchema.parse(resp);
    expect(result.midprice).toBe('0.65');
  });
});

describe('SpreadResponseSchema', () => {
  it('should validate a spread response', () => {
    const resp = {
      market: 'mkt-1',
      asset_id: 'tok-1',
      spread: '0.10',
      spreadPercent: '15.38',
    };
    const result = SpreadResponseSchema.parse(resp);
    expect(result.spreadPercent).toBe('15.38');
  });
});

describe('OrderResponseSchema', () => {
  const validStatuses = ['PRESIGNED', 'SIGNING', 'BROADCASTING', 'PENDING', 'SETTLED', 'CLOSED', 'FAILED', 'CANCELLED', 'EARLY_CANCELLED'];

  it('should validate all order statuses', () => {
    for (const status of validStatuses) {
      const result = OrderResponseSchema.parse({
        orderID: 'ord-1',
        status,
        error: null,
      });
      expect(result.status).toBe(status);
    }
  });

  it('should reject invalid order status', () => {
    expect(() => OrderResponseSchema.parse({ orderID: 'ord-1', status: 'INVALID', error: null })).toThrow();
  });

  it('should allow nullable error', () => {
    const result = OrderResponseSchema.parse({ orderID: 'ord-1', status: 'PENDING', error: 'Timeout' });
    expect(result.error).toBe('Timeout');
  });
});

// ============================================================
// Data API Schemas
// ============================================================
describe('PositionSchema', () => {
  it('should validate a position', () => {
    const pos = {
      assetId: 'tok-1',
      owner: '0x1234',
      collateral: '1000',
      collateralAsset: '0xusdc',
      collateralValue: '1000',
      market: 'mkt-1',
      position: '50',
    };
    const result = PositionSchema.parse(pos);
    expect(result.position).toBe('50');
  });
});

describe('UserTradeSchema', () => {
  it('should validate a user trade', () => {
    const trade = {
      tradeId: 'ut-1',
      user: '0x1234',
      market: 'mkt-1',
      outcomeIndex: 0,
      side: 'YES',
      transactionValue: '500',
      fee: '1.5',
      price: '0.65',
      status: 'FILLED',
      errorMessage: null,
      slug: 'will-x-happen',
      tokenIds: ['tok-1'],
      transactionHash: '0xabc',
      blockNumber: 123456,
      timestamp: '2024-01-01T00:00:00Z',
      builder: null,
    };
    const result = UserTradeSchema.parse(trade);
    expect(result.side).toBe('YES');
  });

  it('should accept nullable builder and errorMessage', () => {
    const trade = {
      tradeId: 'ut-1', user: '0x1234', market: 'mkt-1', outcomeIndex: 0,
      side: 'NO', transactionValue: '100', fee: '0.3', price: '0.35',
      status: 'FILLED', errorMessage: null, slug: 'test', tokenIds: ['tok-2'],
      transactionHash: '0xdef', blockNumber: 123457, timestamp: '2024-01-01T01:00:00Z',
      builder: '0xbuilder',
    };
    const result = UserTradeSchema.parse(trade);
    expect(result.builder).toBe('0xbuilder');
  });
});

describe('HolderDataSchema', () => {
  it('should validate holder data', () => {
    const data = {
      market: 'mkt-1',
      totalHolders: 150,
      yesHolders: 100,
      noHolders: 50,
    };
    const result = HolderDataSchema.parse(data);
    expect(result.totalHolders).toBe(150);
  });
});

describe('OpenInterestSchema', () => {
  it('should validate open interest data', () => {
    const data = {
      market: 'mkt-1',
      openInterest: '5000',
      openInterestYes: '3500',
      openInterestNo: '1500',
    };
    const result = OpenInterestSchema.parse(data);
    expect(result.openInterestYes).toBe('3500');
  });
});

// ============================================================
// Blockchain Schemas
// ============================================================
describe('TransactionReceiptSchema', () => {
  it('should validate a transaction receipt', () => {
    const receipt = {
      blockHash: '0xb1',
      blockNumber: '123456',
      from: '0x1234',
      gas: '21000',
      gasPrice: '30000000000',
      gasUsed: '21000',
      status: '0x1',
      to: '0x5678',
      transactionHash: '0xabc',
      transactionIndex: '0',
      contractAddress: null,
      logs: [
        {
          address: '0x5678',
          blockHash: '0xb1',
          blockNumber: '123456',
          data: '0x00',
          logIndex: '0',
          removed: false,
          topics: ['0xddf252'],
          transactionHash: '0xabc',
          transactionIndex: '0',
        },
      ],
    };
    const result = TransactionReceiptSchema.parse(receipt);
    expect(result.status).toBe('0x1');
    expect(result.logs.length).toBe(1);
  });

  it('should validate failed transaction', () => {
    const receipt = {
      blockHash: '0xb1', blockNumber: '123456', from: '0x1234',
      gas: '21000', gasPrice: '30000000000', gasUsed: '21000',
      status: '0x0', to: '0x5678', transactionHash: '0xdef',
      transactionIndex: '0', contractAddress: null, logs: [],
    };
    const result = TransactionReceiptSchema.parse(receipt);
    expect(result.status).toBe('0x0');
  });
});

describe('BalanceResponseSchema', () => {
  it('should validate a balance response', () => {
    const resp = {
      address: '0x1234',
      balance: '1000000000',
      token: '0xusdc',
      tokenSymbol: 'USDC.e',
      tokenDecimals: 6,
      usdValue: '1000.00',
      blockNumber: '123456',
      source: 'rpc',
    };
    const result = BalanceResponseSchema.parse(resp);
    expect(result.source).toBe('rpc');
    expect(result.tokenDecimals).toBe(6);
  });

  it('should allow null token fields', () => {
    const resp = {
      address: '0x1234',
      balance: '1000000000000000000',
      token: null,
      tokenSymbol: null,
      tokenDecimals: null,
      usdValue: null,
      blockNumber: '123456',
      source: 'api',
    };
    const result = BalanceResponseSchema.parse(resp);
    expect(result.token).toBeNull();
    expect(result.source).toBe('api');
  });

  it('should reject invalid source', () => {
    expect(() => BalanceResponseSchema.parse({
      address: '0x1234', balance: '100', token: null,
      tokenSymbol: null, tokenDecimals: null, usdValue: null,
      blockNumber: '123456', source: 'invalid',
    })).toThrow();
  });
});

// ============================================================
// Escalation Schemas
// ============================================================
describe('EscalationTicketSchema', () => {
  const validTicket = {
    id: 'ticket-1',
    title: 'API Failure on Order Placement',
    severity: 'P1',
    category: 'api_failure',
    user: '0x1234',
    description: 'Orders failing with timeout',
    stepsToReproduce: ['Connect wallet', 'Navigate to market', 'Place order'],
    expectedBehavior: 'Order should be placed',
    actualBehavior: 'Returns 504 timeout',
    evidence: {
      apiRequests: [{ method: 'POST', url: '/order', headers: {}, body: {} }],
      errorLogs: ['TimeoutError: request failed'],
      txHashes: ['0xabc123'],
    },
    rootCauseAnalysis: null,
    affectedSystems: ['clob-api', 'network-layer'],
    workaround: null,
    status: 'NEW',
    assignedTo: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    resolvedAt: null,
    resolution: null,
    linkedTickets: [],
    internalNotes: [
      { author: 'support@polymarket.com', note: 'Investigating', timestamp: '2024-01-01T01:00:00Z' },
    ],
  };

  it('should validate a complete support ticket', () => {
    const result = EscalationTicketSchema.parse(validTicket);
    expect(result.id).toBe('ticket-1');
    expect(result.severity).toBe('P1');
    expect(result.evidence.errorLogs?.[0]).toBe('TimeoutError: request failed');
  });

  it('should validate all severities', () => {
    for (const sev of ['P0', 'P1', 'P2', 'P3', 'P4']) {
      const result = EscalationTicketSchema.parse({ ...validTicket, severity: sev });
      expect(result.severity).toBe(sev);
    }
  });

  it('should reject invalid severity', () => {
    expect(() => EscalationTicketSchema.parse({ ...validTicket, severity: 'P99' })).toThrow();
  });

  it('should validate all ticket statuses', () => {
    for (const status of ['NEW', 'TRIAGED', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED']) {
      const result = EscalationTicketSchema.parse({ ...validTicket, status });
      expect(result.status).toBe(status);
    }
  });

  it('should validate all categories', () => {
    const categories = ['api_failure', 'order_issue', 'deposit_problem', 'balance_discrepancy', 'position_issue', 'sdk_error', 'ws_disconnect', 'on_chain_issue', 'integration_failure', 'performance_issue', 'other'];
    for (const cat of categories) {
      const result = EscalationTicketSchema.parse({ ...validTicket, category: cat });
      expect(result.category).toBe(cat);
    }
  });

  it('should allow empty evidence arrays', () => {
    const result = EscalationTicketSchema.parse({
      ...validTicket,
      evidence: {},
    });
    expect(result.evidence.apiRequests).toBeUndefined();
  });

  it('should allow optional internalNotes', () => {
    const result = EscalationTicketSchema.parse({
      ...validTicket,
      internalNotes: undefined,
    });
    expect(result.internalNotes).toBeUndefined();
  });
});

describe('ErrorPatternSchema', () => {
  it('should validate an error pattern', () => {
    const pattern = {
      patternId: 'err-1',
      errorMessage: 'Connection timeout',
      pattern: 'timeout.*request',
      occurrences: 42,
      firstSeen: '2024-01-01T00:00:00Z',
      lastSeen: '2024-01-15T12:00:00Z',
      affectedUsers: ['0x1111', '0x2222'],
      affectedSystems: ['clob-api'],
      severity: 'HIGH',
      category: 'api_failure',
      relatedTickets: ['ticket-1'],
      suggestedFix: 'Increase timeout to 30s',
    };
    const result = ErrorPatternSchema.parse(pattern);
    expect(result.occurrences).toBe(42);
    expect(result.suggestedFix).toBe('Increase timeout to 30s');
  });

  it('should allow nullable suggestedFix', () => {
    const pattern = {
      patternId: 'err-1', errorMessage: 'Test', pattern: 'test',
      occurrences: 1, firstSeen: '2024-01-01', lastSeen: '2024-01-01',
      affectedUsers: [], affectedSystems: [], severity: 'LOW',
      category: 'other', relatedTickets: [], suggestedFix: null,
    };
    const result = ErrorPatternSchema.parse(pattern);
    expect(result.suggestedFix).toBeNull();
  });
});

// ============================================================
// Enum Schemas
// ============================================================
describe('OrderSide Enum', () => {
  it('should validate BUY', () => {
    const result = OrderSide.parse('BUY');
    expect(result).toBe('BUY');
  });

  it('should validate SELL', () => {
    const result = OrderSide.parse('SELL');
    expect(result).toBe('SELL');
  });

  it('should reject invalid side', () => {
    expect(() => OrderSide.parse('BUYSELL')).toThrow();
  });
});

describe('OrderType Enum', () => {
  it('should validate all order types', () => {
    expect(OrderType.parse('GTC')).toBe('GTC');
    expect(OrderType.parse('GTD')).toBe('GTD');
    expect(OrderType.parse('FOK')).toBe('FOK');
    expect(OrderType.parse('FAK')).toBe('FAK');
  });
});

describe('MarketStatus Enum', () => {
  it('should validate all market statuses', () => {
    expect(MarketStatus.parse('OPEN')).toBe('OPEN');
    expect(MarketStatus.parse('RESOLVED')).toBe('RESOLVED');
    expect(MarketStatus.parse('CANCELLED')).toBe('CANCELLED');
    expect(MarketStatus.parse('AWAITING_RESOLVER')).toBe('AWAITING_RESOLVER');
    expect(MarketStatus.parse('RESOLVING')).toBe('RESOLVING');
  });

  it('should reject invalid status', () => {
    expect(() => MarketStatus.parse('CLOSED')).toThrow();
  });
});
