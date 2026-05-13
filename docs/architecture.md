# Architecture

## System Overview

Polymarket uses a hybrid decentralized architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Client / API Layer                     │
├─────────────┬──────────────┬───────────────┬────────────┤
│  CLOB API   │   Data API   │   Gamma API   │  WebSocket │
│ (trading)   │  (read-only) │ (markets)     │ (stream)   │
├─────────────┴──────────────┴───────────────┴────────────┤
│                   Escalation Engine                       │
├─────────────────────────────────────────────────────────┤
│  Ticket Gen │ Error Patter│ Incident Comms │ Bug Reports │
├─────────────────────────────────────────────────────────┤
│                  Troubleshooting                          │
├──────────────┬──────────────┬────────────────────────────┤
│  Balance     │  Deposit     │  API Failure Debugger     │
│  Reconciler  │  Troublesh.  │  Market Maker Debug       │
├─────────────────────────────────────────────────────────┤
│                   Blockchain Layer                        │
├─────────────────────────────────────────────────────────┤
│  PolygonTracer │ USDC Tracker │ Bridge Tracer           │
│  Position Lookup │ OnChain Order Tracker              │
└─────────────────────────────────────────────────────────┘
                            │
                    Polygon Blockchain
           (Exchange Contract + CTF + USDC.e)
```

## Data Flow

### Order Placement (Escalation Focus)
1. User creates order via SDK/API
2. CLOB matching engine matches against resting orders
3. On-chain settlement via Exchange contract
4. CLOB balance updated after confirmations (128+)

### Deposit Flow (Common Escalation)
1. User deposits USDC from external wallet
2. Bridge/swapper converts and moves to Polygon
3. USDC.e credited to Polymarket profile address
4. CLOB balance updated after on-chain settlement

### Common Failure Points
- Bridge delay/swapper timeout (user sends ETH, not USDC)
- Wrong USDC type (native USDC vs USDC.e)
- Insufficient confirmations (CLOB won't see balance)
- CLOB API rate limits or downtime
- WebSocket disconnections during trading
- Order rejection (price, size, tick size violations)
