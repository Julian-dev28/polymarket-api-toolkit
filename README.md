# Polymarket API Toolkit

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-20+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Test Coverage](https://codecov.io/gh/JulianMartinez/polymarket-api-toolkit/branch/main/graph/badge.svg)](https://codecov.io/gh/JulianMartinez/polymarket-api-toolkit)
[![Changesets](https://img.shields.io/badge/changesets-ready-blue.svg)](https://github.com/changesets/changesets)

## Table of Contents

- [Overview](#overview)
- [What This Solves](#what-this-solves)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [API Reference](#api-reference)
  - [CLOB Client](#clob-client)
  - [Data API Client](#data-api-client)
  - [Gamma API Client](#gamma-api-client)
  - [WebSocket Client](#websocket-client)
  - [Blockchain Tracer](#blockchain-tracer)
  - [USDC Tracker](#usdc-tracker)
  - [Bridge Tracer](#bridge-tracer)
  - [Ticket Generator](#ticket-generator)
  - [Error Pattern Aggregator](#error-pattern-aggregator)
  - [Incident Communicator](#incident-communicator)
  - [Troubleshooting Tools](#troubleshooting-tools)
- [CLI Reference](#cli-reference)
- [Regression Tests](#regression-tests)
- [Running the Project](#running-the-project)
- [Contributing](#contributing)

## Overview

This toolkit is a comprehensive TypeScript codebase for diagnosing, tracing, and resolving the most technically complex issues with Polymarket's APIs and blockchain infrastructure. It's built for engineers who need to debug trading integrations, trace deposits across bridges, and produce structured bug reports — covering every scenario that can trip up a production Polymarket integration:

- **CLOB API debugging** — REST, WebSocket, FIX-style protocol support
- **Blockchain transaction tracing** — Polygon RPC, USDC, on-chain troubleshooting
- **Structured bug reports** — Engineering-ready tickets with evidence
- **Error pattern analysis** — Product feedback generation
- **Incident management** — Customer communications and post-mortems
- **Regression testing** — Real integration failure scenarios as automated tests
- **Internal tooling** — CLI for fast troubleshooting

## What This Solves

When a VIP trader contacts support saying "I sent 1000 USDC but my CLOB balance is still 0," this toolkit provides everything needed to diagnose in minutes, not hours:

1. **Trace the deposit on-chain** → `DepositDiscrepancyTroubleshooter` checks Polygon RPC
2. **Verify the right token** → Confirms USDC.e (not native USDC) at the right address
3. **Check confirmations** → Requires 128+ on Polygon for CLOB to reflect balance
4. **Compare sources** → `BalanceReconciler` compares on-chain vs CLOB vs Data API
5. **Generate a ticket** → `TicketGenerator` creates a structured bug report with evidence
6. **Aggregate the pattern** → `ErrorPatternAggregator` checks if this is a systemic issue

## Quick Start

```bash
# Install dependencies
npm install

# Type-check everything
npm run typecheck

# Run tests
npm run test

# Build
npm run build

# Use the CLI
npx pma health
npx pma market <MARKET_ID>
npx pma balance <ADDRESS>
npx pma ticket --title "..." --category api_failure
```

## Architecture

```
┌────────────────────────────────────────────────────┐
│                   CLI / SDK Layer                    │
├─────────────┬──────────────┬────────────────────────┤
│  pma CLI    │  TypeScript  │  Interactive Mode      │
│  (troubleshoot) │ Library   │  (REPL)               │
├─────────────┴──────────────┴────────────────────────┤
│              Support Tools                    │
├──────────────────────────────────────────────────────┤
│  TicketGen │ ErrorPattern │ IncidentComm │ KB Builder │
├──────────────────────────────────────────────────────┤
│             Troubleshooting Layer                    │
├─────────────┬──────────────┬────────────────────────┤
│  Balance    │  Deposit     │  API Failure           │
│  Reconcile  │  Troublesh.  │  Market Maker Debug    │
├──────────────────────────────────────────────────────┤
│               Blockchain Layer                       │
├──────────────────────────────────────────────────────┤
│  PolygonTracer │ USDC Tracker │ Bridge Tracer       │
│  Position Lookup │ OnChain Order Tracker           │
├──────────────────────────────────────────────────────┤
│              Polymarket API Layer                    │
├─────────────┬──────────────┬────────────────────────┤
│  CLOB API   │  Data API    │  Gamma API             │
│  (trading)  │  (read-only) │  (markets/events)      │
│             │              │  WebSocket (streaming) │
└──────────────────────────────────────────────────────┘
                        │
                Polygon Blockchain
         (Exchange + CTF + USDC.e smart contracts)
```

See [docs/architecture.md](./docs/architecture.md) for full diagrams.

## API Reference

### CLOB Client

Full-featured Polymarket CLOB client with HMAC-SHA256 request signing, automatic retry, and error classification.

```typescript
import { ClobClient } from 'polymarket-api-toolkit';

const client = new ClobClient({
  apiKey: process.env.POLYMARKET_API_KEY,
  apiSecret: process.env.POLYMARKET_API_SECRET,
  passphrase: process.env.POLYMARKET_PASSPHRASE,
});

// Public endpoints (no auth)
const midprice = await client.getMidprice(tokenID);
const spread = await client.getSpread(tokenID);
const orderbook = await client.getOrderbook(tokenID);
const trades = await client.getTrades(tokenID);
const candles = await client.getCandles(tokenID, '1h');

// Trading operations (authenticated)
const order = await client.placeOrder({ tokenID, price: 0.5, size: 100, side: 'BUY' });
await client.cancelOrder(orderID);
const openOrders = await client.getOpenOrders();

// Auto-retry on transient errors
const result = await client.withRetry(() => client.placeOrder(orderParams));
```

**Supported order types:** GTC (Good Till Cancelled), GTD (Good Till Date), FOK (Fill or Kill), FAK (Fill or Attack)

**Error classification:** Auto-categorizes errors into `INVALID_API_CREDS`, `ORDER_REJECTED`, `INSUFFICIENT_FUNDS`, `RATE_LIMITED`, etc.

### Data API Client

Read-only client for market data, positions, trades, leaderboards, and builder analytics.

```typescript
import { DataApiClient } from 'polymarket-api-toolkit';

const data = new DataApiClient();

// Markets
const markets = await data.getMarkets({ status: 'OPEN' });
const market = await data.getMarket(marketId);

// Events
const events = await data.getEvents();
const event = await data.getEvent(eventId);

// User data
const positions = await data.getPositions(walletAddress);
const trades = await data.getTrades({ user: walletAddress, limit: 50 });
const holderData = await data.getHolderData(marketId);
const openInterest = await data.getOpenInterest(marketId);

// Analytics
const leaderboard = await data.getLeaderboard({ days: 30 });
const builderAnalytics = await data.getBuilderAnalytics({ builder: '0x...' });
```

### Gamma API Client

Market discovery, condition resolution, and outcome token management.

```typescript
import { GammaApiClient } from 'polymarket-api-toolkit';

const gamma = new GammaApiClient();

// Market discovery
const events = await gamma.getEvents({ status: 'OPEN' });
const markets = await gamma.getMarkets({ status: 'OPEN', limit: 100 });
const market = await gamma.getMarket(marketId);

// Conditions and outcomes
const conditions = await gamma.getConditions();
const condition = await gamma.getCondition(conditionId);
const outcomes = await gamma.getConditionOutcomes(conditionId);
const tokens = await gamma.getConditionTokens(conditionId);

// Resolution
const resolver = await gamma.getMarketResolver(marketId);
const resolution = await gamma.checkMarketResolution(marketId);

// Activity
const activity = await gamma.getActivity({ market: marketId });
```

### WebSocket Client

Real-time orderbook and trade streaming with auto-reconnect and heartbeat monitoring.

```typescript
import { ClobWebSocketClient } from 'polymarket-api-toolkit';

const ws = new ClobWebSocketClient({
  reconnectInterval: 5000,
  maxAttempts: 10,
});

// Subscribe to orderbook updates
const handlerId = ws.subscribeOrderbook(tokenID, (data) => {
  console.log('Orderbook update:', data);
});

// Subscribe to trades
ws.subscribeTrades(tokenID, (data) => {
  console.log('New trade:', data);
});

// Get connection stats
const stats = ws.getStats();
// { handlerCount: 2, reconnectAttempts: 0, connected: true }

// Cleanup
ws.unsubscribe(handlerId);
ws.disconnect();
```

### Order Manager

Full order lifecycle management for debugging and testing.

```typescript
import { OrderManager } from 'polymarket-api-toolkit';

const manager = new OrderManager();

// Create order in DRAFT state
const order = manager.createOrder({
  tokenID: 'abc123',
  price: 0.5,
  size: 100,
  side: 'BUY',
});

// Simulate signing
manager.signOrder(order.orderID);

// Post to CLOB with full error handling
const response = await manager.postOrder(order.orderID, clobClient);
// Order transitions: DRAFT -> PRESIGNED -> BROADCASTING -> PENDING/CLOSED/FAILED

// Cancel order
await manager.cancelOrder(order.orderID, clobClient);

// Get fill summary
const summary = manager.getFillSummary();
// { totalOrders: 10, filled: 7, failed: 2, pending: 1, cancelled: 0 }
```

### Blockchain Tracer

Polygon blockchain transaction tracing with USDC and CTF event decoding.

```typescript
import { PolygonTracer } from 'polymarket-api-toolkit';

const tracer = new PolygonTracer();

// Trace a full transaction
const tx = await tracer.traceTransaction(txHash);
// Returns: blockNumber, from, to, value, gas, status, logs, blockExplorerUrl

// Decode USDC transfer events
const transfers = tracer.decodeUSDCLogs(tx.logs);
// [{ from: '0x...', to: '0x...', amount: 1000000000n, token: '0x...' }]

// Decode approval events
const approvals = tracer.decodeApprovalLogs(tx.logs);
// [{ owner: '0x...', spender: '0x...', amount: 1000000000n }]

// Decode ERC-1155 batch transfers (CTF outcome tokens)
const batchTransfers = tracer.decodeERC1155BatchTransferLogs(tx.logs);

// Wait for confirmation
await tracer.waitForConfirmation(txHash, 128);

// Get gas price
const gasPrice = await tracer.getGasPrice();

// Batch trace multiple transactions
const results = await tracer.traceMultipleTransactions([txHash1, txHash2]);
```

### USDC Tracker

USDC.e balance, approval, and transfer tracking via viem.

```typescript
import { USDCTracker } from 'polymarket-api-toolkit';

const tracker = new USDCTracker();

// Get USDC balance
const balance = await tracker.getUSDCBalance(address);
// { balance: 1000000000n, balanceFormatted: '1000.000000', isUSDCE: true }

// Check approval for a spender (exchange contract)
const approval = await tracker.getUSDCAllowance(owner, spender);
// { amount: 5000000000n, amountFormatted: '5000.000000' }

// Get CTF token balances
const ctfBalance = await tracker.getCTFBalance(address, tokenId);

// Batch query CTF balances
const balances = await tracker.getCTFBalancesBatch(address, [tokenID1, tokenID2]);

// Get recent transfers
const transfers = await tracker.getRecentTransfers(address, 50);

// Verify token details
const info = await tracker.getTokenInfo();
// { symbol: 'USDC.e', decimals: 6, address: '0x2791...' }
```

### Position Lookup

Reconcile CTF positions between on-chain and CLOB state.

```typescript
import { PositionLookup } from 'polymarket-api-toolkit';

const lookup = new PositionLookup();

// Reconcile balances across sources
const result = await lookup.reconcilePositions(
  address,
  expectedCTFBalances,
  expectedUSDC
);
// Returns: discrepancies[], reconciled: true/false, onChainAtBlock

// Scan for CTF tokens an address holds
const tokenIDs = await lookup.scanCTFTokens(address, fromBlock, toBlock);

// Get market token IDs from condition
const marketTokens = await lookup.getMarketTokenIDs(conditionID, 2);

// Quick balance summary
const summary = await lookup.getBalanceSummary(address);
// { usdc: '1000.000000', ctfTokens: 5, nativeBalance: '0.5' }
```

### Bridge Tracer

Multi-chain deposit/withdrawal tracing for Polygon, Ethereum, Arbitrum, and Base.

```typescript
import { BridgeTracer } from 'polymarket-api-toolkit';

const tracer = new BridgeTracer();

// Trace a deposit from any chain to Polymarket
const deposit = await tracer.traceDeposit('ethereum', fromTxHash, toAddress);
// Returns: bridgeType, status, confirmations, explorerUrl

// Trace Polymarket deposits by user
const deposits = await tracer.tracePolymarketDeposits(userAddress, 50);

// Verify deposit confirmations
const confirmation = await tracer.isDepositConfirmed(txHash, 128);
// { confirmed: true, confirmations: 150 }

// Get explorer URL for any chain
const url = tracer.getExplorerUrl('polygon', txHash);
// 'https://polygonscan.com/tx/...'

// Detect which chain a token lives on
const chain = tracer.detectChain(tokenAddress);
// 'polygon' for USDC.e
```

### Ticket Generator

Generate structured, engineering-ready bug reports from any error scenario.

```typescript
import { TicketGenerator } from 'polymarket-api-toolkit';

const generator = new TicketGenerator();

// From an API error
const ticket = generator.fromApiError({
  title: 'Order rejected with PRICE_TOO_LOW',
  apiError: { code: 'PRICE_TOO_LOW', message: 'Price below minimum tick size' },
  request: { method: 'POST', url: '/orders', body: { tokenID, price: 0.005 } },
  response: { status: 422, data: { error: 'Price too low' } },
  userId: '0x...',
});

// From a failed order
const orderTicket = generator.fromFailedOrder({
  orderId: 'abc-123',
  orderParams: { tokenID, price: 0.5, size: 100, side: 'BUY' },
  error: new Error('Insufficient funds'),
  userId: '0x...',
});

// From a deposit discrepancy
const depositTicket = generator.fromDepositDiscrepancy({
  userAddress: '0x...',
  expectedAmount: '1000',
  actualAmount: '0',
  txHash: '0x...',
});

// Convert to Jira-ready markdown
console.log(generator.toMarkdown(ticket));

// Or JSON for programmatic consumption
console.log(generator.toJson(ticket));
```

### Error Pattern Aggregator

Deduplicate, analyze, and generate product feedback from error patterns.

```typescript
import { ErrorPatternAggregator } from 'polymarket-api-toolkit';

const aggregator = new ErrorPatternAggregator();

// Add error events
aggregator.addEvent({
  id: crypto.randomUUID(),
  timestamp: Date.now(),
  errorMessage: 'PRICE_TOO_LOW: price must be >= 0.01',
  pattern: aggregator.detectPattern('PRICE_TOO_LOW'),
  category: 'order_issue',
  severity: 'P3',
  userId: '0x...',
});

// Get aggregated patterns
const patterns = aggregator.getTopPatterns(10);
// [{ pattern: '...', occurrences: 50, affectedUsers: [...], trend: 'increasing' }]

// Generate product feedback
const feedback = aggregator.generateProductFeedback();
// [{ issue, impact, recommendation, priority: 'HIGH', category }]

// Export as CSV for Hex/Amplitude
const csv = aggregator.exportCSV();

// Get severity breakdown
const report = aggregator.generateSummaryReport();
// { totalErrors: 250, criticalPatterns: 3, categoryBreakdown: { ... } }
```

### Incident Communicator

Draft customer-facing communications during incidents.

```typescript
import { IncidentCommunicator } from 'polymarket-api-toolkit';

const communicator = new IncidentCommunicator();

// Draft different formats
const email = communicator.draftIncidentNotification(incident, 'email');
const dashboard = communicator.draftIncidentNotification(incident, 'dashboard');
const statusPage = communicator.draftIncidentNotification(incident, 'status_page');

// Mid-incident update
const update = communicator.draftIncidentUpdate(incident, 'Root cause identified: database connection pool exhausted');

// Resolution notice
const resolution = communicator.draftResolutionNotice(incident, 'Fixed: increased connection pool size and added retry logic');

// Calculate impact
const impact = communicator.calculateImpact(incident, 100000);
// { userPercentage: '12.5', severityLabel: 'High — Significant impact', communicationFrequency: 'every_15_min' }

// Post-incident report
const report = communicator.draftPostIncidentReport(incident, rootCause, lessonsLearned);
```

## CLI Reference

The `pma` CLI provides quick access to all tools from the terminal:

```bash
# Check health of all Polymarket APIs
pma health

# Look up market by ID
pma market <MARKET_ID> [--verbose]

# Check USDC balance (with optional reconciliation)
pma balance <ADDRESS> [--clob <BALANCE>] [--data-api <BALANCE>]

# Investigate missing deposit
pma deposit <ADDRESS> --expected <AMOUNT> --clob-balance <AMOUNT> [--tx-hash <HASH>]

# Generate a structured bug report
pma ticket --title "..." --category order_issue \
  --description "..." --expected "..." --actual "..."

# Analyze error patterns
pma patterns [--top 20]

# Check market maker health
pma mm-health <TOKEN_ID>

# Debug a failed API request
pma debug-api <URL> [--method POST]

# Interactive troubleshooting mode
pma interactive
```

## Regression Tests

Real integration failure scenarios converted into automated tests:

```bash
npm run test
npm run test:coverage
```

| Test Suite | Covers |
|---|---|
| `order-placement-failures` | Order lifecycle, error handling, fill tracking |
| `deposit-discrepancy` | Balance reconciliation, confirmation checking |
| `ws-disconnect-resilience` | WebSocket reconnection, handler management |
| `balance-inconsistency` | Cross-source balance comparison |

## Running the Project

```bash
# Install dependencies
npm install

# Development
npm run dev          # Run a script with ts-node
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
npm run format       # Prettier check

# Testing
npm run test         # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # With coverage report

# Build
npm run build        # Compile to dist/

# CLI
npx pma health       # Quick health check
npx pma interactive  # Interactive mode

# Docker
docker build -t polymarket-api-toolkit .
docker run --env-file config/.env polymarket-api-toolkit
```

## Contributing

1. Fork and create a branch: `git checkout -b feature/my-feature`
2. Make changes with tests
3. Run `npx changeset` to create a version bump
4. Submit a PR

We use [Changesets](https://github.com/changesets/changesets) for versioning and changelog management.

## Tech Stack

| Component | Technology |
|---|---|
| Language | TypeScript 5.x |
| Runtime | Node.js 20+ |
| Blockchain | viem (Ethereum/Polygon RPC) |
| HTTP | Axios |
| WebSocket | Native WebSocket API |
| Validation | Zod |
| Testing | Vitest + V8 Coverage |
| CLI | Commander.js + Chalk + Ora + Inquirer |
| Logging | Pino |
| Build | TypeScript Compiler |
| Linting | ESLint + Prettier |
| Versioning | Changesets |
| CI/CD | GitHub Actions |
| Container | Docker (multi-stage) |

## License

MIT
