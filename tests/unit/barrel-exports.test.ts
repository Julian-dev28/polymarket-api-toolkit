import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve(__dirname, '../../src');

function readBarrel(relPath: string): string {
  const full = path.resolve(SRC_DIR, relPath);
  return fs.readFileSync(full, 'utf-8');
}

function expectBarrelExports(barrelPath: string, expectedNames: string[]): void {
  const content = readBarrel(barrelPath);
  for (const name of expectedNames) {
    const exportRe = new RegExp(`export\\s+.*\\b${name}\\b.*\\}`, 's');
    expect(exportRe.test(content), `Barrel ${barrelPath} should re-export ${name}`).toBe(true);
  }
}

// ── Root barrel: src/index.ts ────────────────────────────────────────────

describe('src/index.ts barrel exports', () => {
  it('should re-export all CLOB classes', () => {
    expectBarrelExports('index.ts', [
      'ClobClient', 'DataApiClient', 'GammaApiClient', 'ClobWebSocketClient',
      'OrderManager', 'OrderbookTracker', 'WebSocketSubscriber',
    ]);
  });

  it('should re-export all blockchain classes', () => {
    expectBarrelExports('index.ts', [
      'PolygonTracer', 'USDCTracker', 'PositionLookup', 'BridgeTracer', 'OnChainOrderTracker',
    ]);
  });

  it('should re-export all support-tools classes', () => {
    expectBarrelExports('index.ts', ['TicketGenerator', 'ErrorPatternAggregator', 'IncidentCommunicator']);
  });

  it('should re-export all troubleshooting classes', () => {
    expectBarrelExports('index.ts', [
      'BalanceReconciler', 'DepositDiscrepancyTroubleshooter', 'MarketMakerDebugger',
      'PositionLookupCli', 'ApiFailureDebugger',
    ]);
  });

  it('should re-export config constants and types', () => {
    const content = readBarrel('index.ts');
    for (const name of ['PolymarketEndpoints', 'ChainConfig', 'TokenConfig', 'ContractConfig', 'ClobConfig', 'ApiErrorCodes', 'LOG_LEVELS']) {
      const re = new RegExp(`export\\s+.*\\b${name}\\b.*}`, 's');
      expect(re.test(content), `Barrel should re-export ${name} from config`).toBe(true);
    }
  });

  it('should re-export config types', () => {
    const content = readBarrel('index.ts');
    expect(/export\s+type\s*\{/.test(content)).toBe(true);
    for (const name of ['PolymarketConfig', 'Event', 'Market', 'Condition', 'OrderbookEntry', 'Trade', 'Candle', 'OrderResponse', 'Position', 'BalanceResponse', 'OrderSide', 'OrderType', 'MarketStatus', 'EscalationTicket']) {
      expect(new RegExp(`\\b${name}\\b`).test(content), `Barrel should re-export type ${name}`).toBe(true);
    }
  });
});

// ── Blockchain barrel ────────────────────────────────────────────────────

describe('src/blockchain/index.ts barrel exports', () => {
  it('should re-export all blockchain classes', () => {
    expectBarrelExports('blockchain/index.ts', ['PolygonTracer', 'USDCTracker', 'PositionLookup', 'BridgeTracer', 'OnChainOrderTracker']);
  });

  it('should have exactly 5 named exports', () => {
    const lines = readBarrel('blockchain/index.ts').trim().split('\n').filter(l => l.trim().length > 0);
    expect(lines).toHaveLength(5);
  });
});

// ── CLOB barrel ──────────────────────────────────────────────────────────

describe('src/clob-client/index.ts barrel exports', () => {
  it('should re-export all CLOB classes', () => {
    expectBarrelExports('clob-client/index.ts', [
      'ClobClient', 'DataApiClient', 'GammaApiClient', 'ClobWebSocketClient',
      'OrderManager', 'OrderbookTracker', 'WebSocketSubscriber',
    ]);
  });

  it('should have exactly 4 non-empty lines of exports', () => {
    const lines = readBarrel('clob-client/index.ts').trim().split('\n').filter(l => l.trim().length > 0);
    expect(lines).toHaveLength(4);
  });
});

// ── Support tools barrel ────────────────────────────────────────────────────

describe('src/support-tools/index.ts barrel exports', () => {
  it('should re-export all support-tools classes', () => {
    expectBarrelExports('support-tools/index.ts', ['TicketGenerator', 'ErrorPatternAggregator', 'IncidentCommunicator']);
  });

  it('should have exactly 4 non-empty lines (3 exports + 1 type export)', () => {
    const lines = readBarrel('support-tools/index.ts').trim().split('\n').filter(l => l.trim().length > 0);
    expect(lines).toHaveLength(4);
  });

  it('should re-export types', () => {
    const content = readBarrel('support-tools/index.ts');
    expect(/export\s+type\s*\{/.test(content)).toBe(true);
    for (const name of ['EvidenceCollection', 'BugReport']) {
      expect(new RegExp(`\\b${name}\\b`).test(content), `Barrel should re-export type ${name}`).toBe(true);
    }
  });
});

// ── Troubleshooting barrel ──────────────────────────────────────────────────

describe('src/troubleshooting/index.ts barrel exports', () => {
  it('should re-export all troubleshooting classes', () => {
    expectBarrelExports('troubleshooting/index.ts', ['BalanceReconciler', 'DepositDiscrepancyTroubleshooter', 'MarketMakerDebugger', 'PositionLookupCli', 'ApiFailureDebugger']);
  });

  it('should have exactly 5 non-empty lines of exports', () => {
    const lines = readBarrel('troubleshooting/index.ts').trim().split('\n').filter(l => l.trim().length > 0);
    expect(lines).toHaveLength(5);
  });
});

// ── Runtime barrel export verification ──────────────────────────────────────

describe('barrel export runtime verification', () => {
  it('should export ApiFailureDebugger from troubleshooting barrel', async () => {
    const { ApiFailureDebugger } = await import('../../src/troubleshooting/index');
    expect(ApiFailureDebugger).toBeDefined();
    expect(typeof ApiFailureDebugger).toBe('function');
  });
});
