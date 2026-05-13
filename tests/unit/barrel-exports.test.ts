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
    const exportRe = new RegExp(`export\\\\s+\\\\{[^}]*\\\\b${name}\\\\b[^}]*\\\\}`, 's');
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

  it('should re-export all escalation classes', () => {
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
      const re = new RegExp(`export\\\\s+\\\\{[^}]*\\\\b${name}\\\\b[^}]*\\\\}`, 's');
      expect(re.test(content), `Barrel should re-export ${name} from config`).toBe(true);
    }
  });

  it('should re-export config types', () => {
    const content = readBarrel('index.ts');
    expect(/export\\s+type\\s*\\{/.test(content)).toBe(true);
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

// ── Escalation barrel ────────────────────────────────────────────────────

describe('src/escalation/index.ts barrel exports', () => {
  it('should re-export all escalation classes', () => {
    expectBarrelExports('escalation/index.ts', ['TicketGenerator', 'ErrorPatternAggregator', 'IncidentCommunicator']);
  });

  it('should re-export types', () => {
    const content = readBarrel('escalation/index.ts');
    expect(/export\\s+type\\s*\\{/.test(content)).toBe(true);
    expect(content).toContain('EvidenceCollection');
    expect(content).toContain('BugReport');
  });
});

// ── Troubleshooting barrel ───────────────────────────────────────────────

describe('src/troubleshooting/index.ts barrel exports', () => {
  it('should re-export all troubleshooting classes', () => {
    expectBarrelExports('troubleshooting/index.ts', [
      'BalanceReconciler', 'DepositDiscrepancyTroubleshooter', 'MarketMakerDebugger',
      'PositionLookupCli', 'ApiFailureDebugger',
    ]);
  });

  it('should have exactly 5 named exports', () => {
    const lines = readBarrel('troubleshooting/index.ts').trim().split('\n').filter(l => l.trim().length > 0);
    expect(lines).toHaveLength(5);
  });
});

// ── Runtime verification of barrel imports ───────────────────────────────

describe('barrel export runtime verification', () => {
  it('should export TicketGenerator from escalation barrel', async () => {
    const { TicketGenerator } = await import('../../src/escalation/index.js');
    expect(typeof TicketGenerator).toBe('function');
    const gen = new TicketGenerator();
    expect(typeof gen.generateTicket).toBe('function');
    expect(typeof gen.toMarkdown).toBe('function');
  });

  it('should export ErrorPatternAggregator from escalation barrel', async () => {
    const { ErrorPatternAggregator } = await import('../../src/escalation/index.js');
    expect(typeof ErrorPatternAggregator).toBe('function');
    const agg = new ErrorPatternAggregator();
    expect(typeof agg.addEvent).toBe('function');
    expect(typeof agg.getPatterns).toBe('function');
    expect(typeof agg.getTopPatterns).toBe('function');
    expect(agg.getPatterns()).toHaveLength(0);
  });

  it('should export IncidentCommunicator from escalation barrel', async () => {
    const { IncidentCommunicator } = await import('../../src/escalation/index.js');
    expect(typeof IncidentCommunicator).toBe('function');
    const comm = new IncidentCommunicator();
    expect(typeof comm.draftIncidentNotification).toBe('function');
    expect(typeof comm.draftIncidentUpdate).toBe('function');
    expect(typeof comm.draftResolutionNotice).toBe('function');
    expect(typeof comm.calculateImpact).toBe('function');
    expect(typeof comm.draftPostIncidentReport).toBe('function');

    const draft = comm.draftIncidentNotification({
      id: 'test-1',
      title: 'Test incident',
      severity: 'P2',
      description: 'A test incident',
      startedAt: '2025-01-01T00:00:00Z',
      detectedBy: 'system',
      affectedUsers: 5,
      affectedSystems: ['clob'],
      status: 'investigating',
    }, 'email');
    expect(draft).toContain('Test incident');
    expect(draft).toContain('P2');
  });

  it('should export ApiFailureDebugger from troubleshooting barrel', async () => {
    const { ApiFailureDebugger } = await import('../../src/troubleshooting/index.js');
    expect(typeof ApiFailureDebugger).toBe('function');
    const debug = new ApiFailureDebugger();
    expect(typeof debug.debugApiFailure).toBe('function');
    expect(typeof debug.healthCheckEndpoints).toBe('function');
  });

  it('should export MarketMakerDebugger from troubleshooting barrel', async () => {
    const { MarketMakerDebugger } = await import('../../src/troubleshooting/index.js');
    expect(typeof MarketMakerDebugger).toBe('function');
    const mm = new MarketMakerDebugger();
    expect(typeof mm.checkMarketHealth).toBe('function');
    expect(typeof mm.formatHealthReport).toBe('function');
  });

  it('should export OrderbookTracker from clob-client barrel', async () => {
    const { OrderbookTracker } = await import('../../src/clob-client/index.js');
    expect(typeof OrderbookTracker).toBe('function');
    const tracker = new OrderbookTracker();
    expect(typeof tracker.update).toBe('function');
    expect(typeof tracker.getSnapshot).toBe('function');
    expect(typeof tracker.getMidprice).toBe('function');
    expect(typeof tracker.getSpread).toBe('function');

    const snapshot = tracker.getSnapshot();
    expect(snapshot.bids).toEqual([]);
    expect(snapshot.asks).toEqual([]);

    tracker.update({ bids: [{ price: '0.5', size: '10' }], asks: [{ price: '0.6', size: '5' }] });
    expect(tracker.getMidprice()).toBe(0.55);
    const spread = tracker.getSpread();
    expect(spread?.absolute).toBeCloseTo(0.1, 10);
  });
});
