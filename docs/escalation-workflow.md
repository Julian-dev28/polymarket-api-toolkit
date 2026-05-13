# Escalation Workflow

This document maps each module in the toolkit to real Escalation Engineer scenarios.

## 1. API Failure Debugging

### Scenario: VIP trader reports "order rejected" errors
```bash
# Run systematic diagnostic
pma debug-api https://clob.polymarket.com/orders --method POST

# Check if it's an auth issue vs validation issue
# Auto-categorizes: authentication, validation, rate_limit, server_error, network
```

### What this demonstrates:
- cURL/Postman-level API debugging in code
- Understanding HMAC-SHA256 request signing
- Reading and interpreting Polymarket API error responses
- Distinguishing between auth, validation, and infrastructure issues

## 2. CLOB Order Issues

### Scenario: Market maker can't place orders, orderbook looks wrong
```bash
# Check market health end-to-end
pma mm-health <TOKEN_ID>

# Check order lifecycle
const om = new OrderManager();
om.createOrder({ tokenID, price: 0.5, size: 100, side: 'BUY' });
// Full DRAFT -> PRESIGNED -> BROADCASTING -> SETTLED/CANCELLED/FAILED tracking
```

### What this demonstrates:
- Deep understanding of CLOB mechanics (offchain matching, onchain settlement)
- GTC/GTD/FAK/FOK order types
- Tick size, fee tiers, risk limits
- Orderbook depth and spread analysis

## 3. Deposit Discrepancy Investigation

### Scenario: User sent 1000 USDC but CLOB shows 0
```bash
pma deposit <USER_ADDRESS> --expected 1000 --clob-balance 0 --tx-hash <TX_HASH>
```

### What this demonstrates:
- Polygon blockchain fundamentals
- Reading block explorers (Polygonscan)
- USDC.e (0x2791...) vs native USDC (0x3c49...) distinction
- Bridge/swapper flow understanding
- Confirmation count requirements (128+ for Polygon)
- ERC-20 balance checking via RPC

## 4. Balance Reconciliation

### Scenario: CLOB shows different balance than on-chain
```bash
pma balance <ADDRESS> --clob 1000 --data-api 995
```

### What this demonstrates:
- Cross-source data verification
- Understanding CLOB's async balance updates
- On-chain vs off-chain state reconciliation
- Building tools that reduce ticket volume

## 5. WebSocket Disconnection Issues

### Scenario: Real-time orderbook stops updating, causing missed trades
```bash
# WS client with auto-reconnect, heartbeat monitoring
const ws = new ClobWebSocketClient();
ws.subscribeOrderbook(tokenID, handler);
// Tracks reconnect attempts, latency, message routing
```

### What this demonstrates:
- WebSocket debugging (connect/disconnect/reconnect)
- Understanding streaming protocol
- Building resilience patterns (reconnect, backoff, heartbeat)

## 6. Building Structured Bug Reports

### Scenario: Translate a frustrated VIP trader's complaint into an actionable ticket
```bash
pma ticket \
  --title "Order rejected with PRICE_TOO_LOW for market X" \
  --category order_issue \
  --description "User cannot place orders on high-volume market" \
  --expected "Order accepted at valid price" \
  --actual "Error: price below tick size minimum" \
  --user <ADDRESS> \
  --steps "Connect wallet, navigate to market, place limit order at 0.005"
```

### What this demonstrates:
- Writing bug reports engineering actually wants to pick up
- Translating between frustrated users and busy engineers
- Including evidence: API requests, responses, tx hashes, timestamps
- Root cause analysis suggestions

## 7. Error Pattern Aggregation for Product Feedback

### Scenario: Identify that 50+ users hit the same "tick size violation" error
```bash
pma patterns --top 20

# Generates:
# - Pattern deduplication (normalizes UUIDs, addresses, numbers)
# - Trend analysis (stable / increasing / decreasing)
# - Product feedback with priority ranking
# - CSV export for Hex/Amplitude analysis
```

### What this demonstrates:
- Pattern recognition across user issues
- Data-driven product feedback
- Pushing for self-serve tooling and better error messages
- Quantifying impact for triage calls

## 8. Incident Management

### Scenario: CLOB API goes down during high-volume event
```bash
# Draft customer communications
const communicator = new IncidentCommunicator();
communicator.draftIncidentNotification(incident, 'email');
communicator.draftIncidentNotification(incident, 'status_page');

# Calculate impact metrics
communicator.calculateImpact(incident, totalUsers);

# Post-incident report
communicator.draftPostIncidentReport(incident, rootCause, lessonsLearned);
```

### What this demonstrates:
- Incident response under pressure
- Customer communication during outages
- Quantifying impact for stakeholders
- Post-incident review process

## 9. SDK Integration Support

### Scenario: Developer using @polymarket/clob-client-v2 hits unexpected behavior
```typescript
import { ClobClient, DataApiClient, GammaApiClient } from 'polymarket-agent';

// Full SDK wrapper with Zod validation
const gamma = new GammaApiClient();
const markets = await gamma.getMarkets({ status: 'OPEN' });
const resolver = await gamma.checkMarketResolution(marketId);
```

### What this demonstrates:
- Deep knowledge of Polymarket SDK
- Gamma API for market discovery
- Condition resolution logic
- Builder analytics

## 10. Market Maker Tools

### Scenario: Market maker reports stale prices or liquidity issues
```bash
pma mm-health <TOKEN_ID>

# Outputs:
# Midprice, spread, orderbook depth, last trade
# Tick size, fee tier, neg-risk status, risk limits
# Latency for each endpoint
```

### What this demonstrates:
- Understanding market making mechanics
- Liquidity analysis
- Cost awareness (fees, spreads)
- Market structure knowledge
