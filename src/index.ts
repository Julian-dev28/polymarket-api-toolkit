// Polymarket Escalation Engineering Toolkit
// Complete API wrapper, blockchain tracer, ticket generator, and troubleshooting tools

// Config
export { PolymarketEndpoints, ChainConfig, TokenConfig, ContractConfig,
  ClobConfig, ApiErrorCodes, LOG_LEVELS } from './config';
export type { PolymarketConfig, Event, Market, Condition, OrderbookEntry,
  Trade, Candle, OrderResponse, Position, BalanceResponse, OrderSide,
  OrderType, MarketStatus, EscalationTicket } from './config';

// CLOB
export { ClobClient, DataApiClient, GammaApiClient, ClobWebSocketClient,
  OrderManager, OrderbookTracker, WebSocketSubscriber } from './clob-client';

// Blockchain
export { PolygonTracer, USDCTracker, PositionLookup, BridgeTracer,
  OnChainOrderTracker } from './blockchain';

// Escalation
export { TicketGenerator, ErrorPatternAggregator, IncidentCommunicator } from './escalation';

// Troubleshooting
export { BalanceReconciler, DepositDiscrepancyTroubleshooter,
  MarketMakerDebugger, PositionLookupCli, ApiFailureDebugger } from './troubleshooting';
