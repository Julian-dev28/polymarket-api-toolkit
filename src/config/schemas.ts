import { z } from 'zod';

// ============================================================
// Gamma API Schemas
// ============================================================

export const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  status: z.enum(['OPEN', 'RESOLVED', 'CANCELLED']),
  markets: z.array(z.string()),
  closedDate: z.string().nullable(),
  effectiveDate: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  conditionId: z.string().nullable(),
  image: z.string().nullable(),
  ctfMarketType: z.string().nullable(),
  parentEvent: z.string().nullable(),
  parentId: z.string().nullable(),
  parentSlug: z.string().nullable(),
  tags: z.array(z.string()),
  blocked: z.boolean(),
  curated: z.boolean(),
  updatedAt: z.string(),
});

export const MarketSchema = z.object({
  id: z.string(),
  asset: z.object({
    id: z.string(),
    outcomeNames: z.array(z.string()),
    outcomesTokenIds: z.array(z.string()),
    condition: z.object({
      conditionId: z.string(),
      marketType: z.string(),
      marketData: z.object({
        marketId: z.string(),
        assetAddress: z.string(),
        categories: z.array(z.string()),
        ctfMarketType: z.string(),
        question: z.string(),
      }).nullable(),
    }),
    marketType: z.string().nullable(),
    question: z.string(),
  }),
  condition: z.object({
    conditionId: z.string(),
  }),
  slug: z.string(),
  clobTokenIds: z.array(z.string()),
  outcomeTokens: z.array(z.string()),
  outcomePrices: z.array(z.string()),
  lastPrice: z.object({
    yes: z.string(),
    no: z.string(),
  }),
  volume: z.string(),
  volume24h: z.string(),
  openInterest: z.string(),
  liquidity: z.string(),
  effectiveDate: z.string().nullable(),
  endDate: z.string().nullable(),
  closedDate: z.string().nullable(),
  status: z.enum(['OPEN', 'RESOLVED', 'CANCELLED', 'AWAITING_RESOLVER', 'RESOLVING']),
  slash: z.number().nullable(),
  tags: z.array(z.string()),
  imageUrl: z.string().nullable(),
  description: z.string().nullable(),
  customPoolId: z.string().nullable(),
  notionalValue: z.string(),
  notionalValueChange24h: z.string(),
  percentChange24h: z.string(),
  blockNumber: z.number(),
  chainId: z.number(),
  contractAddress: z.string(),
  atomicTokenId: z.string(),
  lastUpdated: z.string(),
});

export const ConditionSchema = z.object({
  id: z.string(),
  conditionId: z.string(),
  marketType: z.string(),
  marketData: z.object({
    marketId: z.string(),
    assetAddress: z.string(),
    categories: z.array(z.string()),
    ctfMarketType: z.string(),
    question: z.string(),
  }).nullable(),
  parentConditionId: z.string().nullable(),
  dates: z.object({
    effectiveDate: z.string().nullable(),
    expirationDate: z.string().nullable(),
  }),
});

// ============================================================
// CLOB API Schemas
// ============================================================

export const OrderbookEntrySchema = z.object({
  price: z.string(),
  size: z.string(),
  orders: z.array(z.object({
    orderID: z.string(),
    owner: z.string(),
    signer: z.string(),
    tokenID: z.string(),
    price: z.string(),
    side: z.enum(['BUY', 'SELL']),
    nonce: z.string(),
    takerOrder: z.boolean(),
  })),
});

export const OrderbookSnapshotSchema = z.object({
  market: z.string(),
  asset_id: z.string(),
  bids: z.array(OrderbookEntrySchema),
  asks: z.array(OrderbookEntrySchema),
  timestamp: z.string(),
});

export const TradeSchema = z.object({
  tradeID: z.string(),
  orderID: z.string(),
  makerOrderID: z.string(),
  takerOrderID: z.string(),
  side: z.enum(['BUY', 'SELL']),
  price: z.string(),
  size: z.string(),
  tokenID: z.string(),
  blockNumber: z.number(),
  transactionIndex: z.number(),
  timestamp: z.string(),
  maker: z.string(),
  makerTradeNonce: z.string(),
  protocolFee: z.string(),
  collateralToken: z.string(),
  market: z.string(),
  symbol: z.string(),
});

export const CandleSchema = z.object({
  timeframe: z.string(),
  id: z.string(),
  low: z.string(),
  high: z.string(),
  open: z.string(),
  close: z.string(),
  volume: z.string(),
  timestamp: z.string(),
});

export const MidpriceResponseSchema = z.object({
  market: z.string(),
  asset_id: z.string(),
  midprice: z.string(),
});

export const SpreadResponseSchema = z.object({
  market: z.string(),
  asset_id: z.string(),
  spread: z.string(),
  spreadPercent: z.string(),
});

export const OrderResponseSchema = z.object({
  orderID: z.string(),
  status: z.enum([
    'PRESIGNED', 'SIGNING', 'BROADCASTING',
    'PENDING', 'SETTLED', 'CLOSED', 'FAILED', 'CANCELLED', 'EARLY_CANCELLED'
  ]),
  error: z.string().nullable(),
});

// ============================================================
// Data API Schemas
// ============================================================

export const PositionSchema = z.object({
  assetId: z.string(),
  owner: z.string(),
  collateral: z.string(),
  collateralAsset: z.string(),
  collateralValue: z.string(),
  market: z.string(),
  position: z.string(),
});

export const UserTradeSchema = z.object({
  tradeId: z.string(),
  user: z.string(),
  market: z.string(),
  outcomeIndex: z.number(),
  side: z.enum(['YES', 'NO']),
  transactionValue: z.string(),
  fee: z.string(),
  price: z.string(),
  status: z.string(),
  errorMessage: z.string().nullable(),
  slug: z.string(),
  tokenIds: z.array(z.string()),
  transactionHash: z.string(),
  blockNumber: z.number(),
  timestamp: z.string(),
  builder: z.string().nullable(),
});

export const HolderDataSchema = z.object({
  market: z.string(),
  totalHolders: z.number(),
  yesHolders: z.number(),
  noHolders: z.number(),
});

export const OpenInterestSchema = z.object({
  market: z.string(),
  openInterest: z.string(),
  openInterestYes: z.string(),
  openInterestNo: z.string(),
});

// ============================================================
// Blockchain Schemas
// ============================================================

export const TransactionReceiptSchema = z.object({
  blockHash: z.string(),
  blockNumber: z.string(),
  from: z.string(),
  gas: z.string(),
  gasPrice: z.string(),
  gasUsed: z.string(),
  status: z.enum(['0x1', '0x0']),
  to: z.string(),
  transactionHash: z.string(),
  transactionIndex: z.string(),
  contractAddress: z.string().nullable(),
  logs: z.array(z.object({
    address: z.string(),
    blockHash: z.string(),
    blockNumber: z.string(),
    data: z.string(),
    logIndex: z.string(),
    removed: z.boolean(),
    topics: z.array(z.string()),
    transactionHash: z.string(),
    transactionIndex: z.string(),
  })),
});

export const BalanceResponseSchema = z.object({
  address: z.string(),
  balance: z.string(),
  token: z.string().nullable(),
  tokenSymbol: z.string().nullable(),
  tokenDecimals: z.number().nullable(),
  usdValue: z.string().nullable(),
  blockNumber: z.string(),
  source: z.enum(['rpc', 'api', 'cache']),
});

// ============================================================
// Escalation Schemas
// ============================================================

export const EscalationTicketSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(['P0', 'P1', 'P2', 'P3', 'P4']),
  category: z.enum([
    'api_failure', 'order_issue', 'deposit_problem',
    'balance_discrepancy', 'position_issue', 'sdk_error',
    'ws_disconnect', 'on_chain_issue', 'integration_failure',
    'performance_issue', 'other'
  ]),
  user: z.string().nullable(),
  description: z.string(),
  stepsToReproduce: z.array(z.string()),
  expectedBehavior: z.string(),
  actualBehavior: z.string(),
  evidence: z.object({
    apiRequests: z.array(z.any()).optional(),
    apiResponses: z.array(z.any()).optional(),
    errorLogs: z.array(z.string()).optional(),
    txHashes: z.array(z.string()).optional(),
    screenshots: z.array(z.string()).optional(),
    timestamps: z.array(z.string()).optional(),
  }),
  rootCauseAnalysis: z.string().nullable(),
  affectedSystems: z.array(z.string()),
  workaround: z.string().nullable(),
  status: z.enum(['NEW', 'TRIAGED', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED']),
  assignedTo: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
  resolution: z.string().nullable(),
  linkedTickets: z.array(z.string()),
  internalNotes: z.array(z.object({
    author: z.string(),
    note: z.string(),
    timestamp: z.string(),
  })).optional(),
});

export const ErrorPatternSchema = z.object({
  patternId: z.string(),
  errorMessage: z.string(),
  pattern: z.string(),
  occurrences: z.number(),
  firstSeen: z.string(),
  lastSeen: z.string(),
  affectedUsers: z.array(z.string()),
  affectedSystems: z.array(z.string()),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  category: z.string(),
  relatedTickets: z.array(z.string()),
  suggestedFix: z.string().nullable(),
});

export type Event = z.infer<typeof EventSchema>;
export type EscalationTicket = z.infer<typeof EscalationTicketSchema>;
export type Market = z.infer<typeof MarketSchema>;
export type Condition = z.infer<typeof ConditionSchema>;
export type OrderbookEntry = z.infer<typeof OrderbookEntrySchema>;
export type OrderbookSnapshot = z.infer<typeof OrderbookSnapshotSchema>;
export type Trade = z.infer<typeof TradeSchema>;
export type Candle = z.infer<typeof CandleSchema>;
export type MidpriceResponse = z.infer<typeof MidpriceResponseSchema>;
export type SpreadResponse = z.infer<typeof SpreadResponseSchema>;
export type OrderResponse = z.infer<typeof OrderResponseSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type UserTrade = z.infer<typeof UserTradeSchema>;
export type HolderData = z.infer<typeof HolderDataSchema>;
export type OpenInterest = z.infer<typeof OpenInterestSchema>;
export type TransactionReceipt = z.infer<typeof TransactionReceiptSchema>;
export type BalanceResponse = z.infer<typeof BalanceResponseSchema>;
export const OrderSide = z.enum(['BUY', 'SELL']);
export type OrderSide = z.infer<typeof OrderSide>;
export const OrderType = z.enum(['GTC', 'GTD', 'FOK', 'FAK']);
export type OrderType = z.infer<typeof OrderType>;
export const MarketStatus = z.enum(['OPEN', 'RESOLVED', 'CANCELLED', 'AWAITING_RESOLVER', 'RESOLVING']);
export type MarketStatus = z.infer<typeof MarketStatus>;
