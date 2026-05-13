export type { Event, Market, Condition, OrderbookEntry, OrderbookSnapshot,
  Trade, Candle, MidpriceResponse, SpreadResponse, OrderResponse,
  Position, UserTrade, HolderData, OpenInterest, TransactionReceipt,
  BalanceResponse, OrderSide, OrderType, MarketStatus
} from './schemas';

export { PolymarketEndpoints, ChainConfig, TokenConfig, ContractConfig,
  ClobConfig, ApiErrorCodes,
  EventSchema, MarketSchema, ConditionSchema, OrderbookEntrySchema,
  OrderbookSnapshotSchema, TradeSchema, CandleSchema, MidpriceResponseSchema,
  SpreadResponseSchema, OrderResponseSchema, PositionSchema, UserTradeSchema,
  HolderDataSchema, OpenInterestSchema, TransactionReceiptSchema,
  BalanceResponseSchema, EscalationTicketSchema, ErrorPatternSchema,
  OrderSide, OrderType, MarketStatus
} from './endpoints';
export {
  EventSchema, MarketSchema, ConditionSchema, OrderbookEntrySchema,
  OrderbookSnapshotSchema, TradeSchema, CandleSchema, MidpriceResponseSchema,
  SpreadResponseSchema, OrderResponseSchema, PositionSchema, UserTradeSchema,
  HolderDataSchema, OpenInterestSchema, TransactionReceiptSchema,
  BalanceResponseSchema, EscalationTicketSchema, ErrorPatternSchema,
  OrderSide, OrderType, MarketStatus
} from './schemas';

export interface PolymarketConfig {
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
  privateKey?: string;
  funder?: string;
  clobHost?: string;
  dataApiHost?: string;
  gammaApiHost?: string;
  chainId?: number;
  wsUrl?: string;
}

export interface LogLevel {
  trace: number;
  debug: number;
  info: number;
  warn: number;
  error: number;
  fatal: number;
}

export const LOG_LEVELS: LogLevel = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};
