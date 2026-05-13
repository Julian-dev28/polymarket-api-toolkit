import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve(__dirname, '../../src');

const CLI_PATH = path.resolve(SRC_DIR, 'cli/index.ts');
const CLI_SOURCE = fs.readFileSync(CLI_PATH, 'utf-8');

// ── Command definitions extracted from source ───────────────────────────

const COMMAND_NAMES = [
  'health',
  'market',
  'balance',
  'deposit',
  'ticket',
  'patterns',
  'mm-health',
  'positions',
  'debug-api',
  'interactive',
];

describe('CLI definition structure', () => {
  it('CLI source file should exist', () => {
    expect(fs.existsSync(CLI_PATH)).toBe(true);
  });

  it('CLI source should reference Commander', () => {
    expect(CLI_SOURCE).toContain("from 'commander'");
  });

  it('CLI program should be named "pma"', () => {
    expect(CLI_SOURCE).toContain(".name('pma')");
  });

  it('CLI program should have version 1.0.0', () => {
    expect(CLI_SOURCE).toContain(".version('1.0.0')");
  });

  it('should define all expected CLI commands', () => {
    for (const cmd of COMMAND_NAMES) {
      // Commands like 'market <id>' embed positional args in the name
      expect(CLI_SOURCE, `CLI should define command "${cmd}"`).toContain(
        `.command('${cmd}`,
      );
    }
  });

  it('should NOT execute on import — program.parse() only', () => {
    // The CLI uses `program.parse()` which only runs when invoked from CLI
    // This test confirms the parse() call exists (so we know it would run when invoked)
    // but we don't actually invoke it.
    expect(CLI_SOURCE).toContain('program.parse()');
  });

  it('CLI should import the required modules', () => {
    expect(CLI_SOURCE).toContain("from 'commander'");
    expect(CLI_SOURCE).toContain("from 'chalk'");
    expect(CLI_SOURCE).toContain("from 'ora'");
  });

  it('CLI should import classes from internal modules', () => {
    expect(CLI_SOURCE).toContain("from '../clob-client/client'");
    expect(CLI_SOURCE).toContain("from '../escalation/ticket-generator'");
    expect(CLI_SOURCE).toContain("from '../escalation/error-pattern-aggregator'");
    expect(CLI_SOURCE).toContain("from '../troubleshooting/balance-reconcile'");
    expect(CLI_SOURCE).toContain("from '../troubleshooting/deposit-discrepancy'");
    expect(CLI_SOURCE).toContain("from '../troubleshooting/market-maker-debug'");
    expect(CLI_SOURCE).toContain("from '../troubleshooting/position-lookup-cli'");
    expect(CLI_SOURCE).toContain("from '../troubleshooting/api-failure-debug'");
  });
});

// ── Command-specific structure tests ─────────────────────────────────────

describe('CLI command options', () => {
  it('health command should have a description', () => {
    const section = CLI_SOURCE.slice(
      CLI_SOURCE.indexOf('.command(\'health\''),
      CLI_SOURCE.indexOf('.command(\'market'),
    );
    expect(section).toContain('.description(');
    expect(section).toContain('Checking API health');
  });

  it('market command should have a required positional arg and verbose option', () => {
    const section = CLI_SOURCE.slice(
      CLI_SOURCE.indexOf('.command(\'market'),
      CLI_SOURCE.indexOf('.command(\'balance'),
    );
    expect(section).toContain('<id>');
    expect(section).toContain('--verbose');
    expect(section).toContain('Show full market data');
  });

  it('balance command should accept a required address and optional reconciliation flags', () => {
    const section = CLI_SOURCE.slice(
      CLI_SOURCE.indexOf('.command(\'balance'),
      CLI_SOURCE.indexOf('.command(\'deposit'),
    );
    expect(section).toContain('<address>');
    expect(section).toContain('--clob');
    expect(section).toContain('--data-api');
  });

  it('deposit command should require --expected and --clob-balance options', () => {
    const section = CLI_SOURCE.slice(
      CLI_SOURCE.indexOf('.command(\'deposit'),
      CLI_SOURCE.indexOf('.command(\'ticket'),
    );
    expect(section).toContain('<address>');
    expect(section).toContain("requiredOption('--expected");
    expect(section).toContain("requiredOption('--clob-balance");
    expect(section).toContain('--tx-hash');
  });

  it('ticket command should have optional structured options', () => {
    const section = CLI_SOURCE.slice(
      CLI_SOURCE.indexOf('.command(\'ticket'),
      CLI_SOURCE.indexOf('.command(\'patterns'),
    );
    expect(section).toContain('--title');
    expect(section).toContain('--category');
    expect(section).toContain('--description');
    expect(section).toContain('--expected');
    expect(section).toContain('--actual');
    expect(section).toContain('--user');
    expect(section).toContain('--steps');
  });

  it('patterns command should accept optional --file and --top options', () => {
    const section = CLI_SOURCE.slice(
      CLI_SOURCE.indexOf('.command(\'patterns'),
      CLI_SOURCE.indexOf('.command(\'mm-health'),
    );
    expect(section).toContain('--file');
    expect(section).toContain('--top');
    expect(section).toContain("'10'"); // default value
  });

  it('mm-health command should accept a required tokenID', () => {
    const section = CLI_SOURCE.slice(
      CLI_SOURCE.indexOf('.command(\'mm-health'),
      CLI_SOURCE.indexOf('.command(\'positions'),
    );
    expect(section).toContain('<tokenID>');
  });

  it('positions command should accept a required address and optional --tokens', () => {
    const section = CLI_SOURCE.slice(
      CLI_SOURCE.indexOf('.command(\'positions'),
      CLI_SOURCE.indexOf('.command(\'debug-api'),
    );
    expect(section).toContain('<address>');
    expect(section).toContain('--tokens');
  });

  it('debug-api command should accept a required URL and optional --method', () => {
    const section = CLI_SOURCE.slice(
      CLI_SOURCE.indexOf('.command(\'debug-api'),
      CLI_SOURCE.indexOf('.command(\'interactive'),
    );
    expect(section).toContain('<url>');
    expect(section).toContain('--method');
    expect(section).toContain("'GET'");
  });
});

// ── Pure logic tests on imported CLI-adjacent modules ────────────────────

describe('CLI-related pure logic', () => {
  it('should verify TicketGenerator generates valid markdown', async () => {
    const { TicketGenerator } = await import('../../src/escalation/ticket-generator');
    const gen = new TicketGenerator();
    const report = gen.generateTicket({
      title: 'API timeout',
      category: 'api_failure',
      description: 'API returned 504',
      stepsToReproduce: ['Call /orders', 'Wait for timeout'],
      expectedBehavior: 'Order accepted',
      actualBehavior: '504 Gateway Timeout',
    });
    expect(report.id).toBeDefined();
    expect(report.severity).toBe('P2');
    expect(report.status).toBe('NEW');
    const md = gen.toMarkdown(report);
    expect(md).toContain('# API timeout');
    expect(md).toContain('504 Gateway Timeout');
    expect(md).toContain('1. Call /orders');
  });

  it('should verify TicketGenerator severity detection', async () => {
    const { TicketGenerator } = await import('../../src/escalation/ticket-generator');
    const gen = new TicketGenerator();
    expect(gen.detectSeverityFromError('rate limit exceeded')).toBe('P2');
    expect(gen.detectSeverityFromError('insufficient balance')).toBe('P1');
    expect(gen.detectSeverityFromError('service unavailable 503')).toBe('P0');
    expect(gen.detectSeverityFromError('price too low')).toBe('P3');
    expect(gen.detectSeverityFromError('generic error')).toBe('P4');
  });

  it('should verify TicketGenerator auto-severity from category', async () => {
    const { TicketGenerator } = await import('../../src/escalation/ticket-generator');
    const gen = new TicketGenerator();
    const r1 = gen.generateTicket({
      title: 't', category: 'order_issue', description: 'd',
      stepsToReproduce: ['a'], expectedBehavior: 'b', actualBehavior: 'c',
    });
    expect(r1.severity).toBe('P1');
    const r2 = gen.generateTicket({
      title: 't', category: 'api_failure', description: 'd',
      stepsToReproduce: ['a'], expectedBehavior: 'b', actualBehavior: 'c',
    });
    expect(r2.severity).toBe('P2');
  });

  it('should verify ErrorPatternAggregator pattern detection and grouping', async () => {
    const { ErrorPatternAggregator } = await import(
      '../../src/escalation/error-pattern-aggregator'
    );
    const agg = new ErrorPatternAggregator();

    // Add events — normalizeMessage strips numeric IDs so similar errors group
    agg.addEvent({
      id: 'e1', timestamp: Date.now(), errorMessage: 'Rate limit exceeded',
      pattern: 'rate limit', category: 'api_failure', severity: 'P2',
    });
    agg.addEvent({
      id: 'e2', timestamp: Date.now() + 1, errorMessage: 'Rate limit exceeded',
      pattern: 'rate limit', category: 'api_failure', severity: 'P2',
    });

    const patterns = agg.getPatterns();
    expect(patterns.length).toBe(1);
    expect(patterns[0].occurrences).toBe(2);

    const top = agg.getTopPatterns(10);
    expect(top.length).toBe(1);
  });

  it('should verify ErrorPatternAggregator getPatternsByCategory', async () => {
    const { ErrorPatternAggregator } = await import(
      '../../src/escalation/error-pattern-aggregator'
    );
    const agg = new ErrorPatternAggregator();

    agg.addEvent({
      id: 'e1', timestamp: Date.now(), errorMessage: 'timeout',
      pattern: 'timeout', category: 'api_failure', severity: 'P2',
    });
    agg.addEvent({
      id: 'e2', timestamp: Date.now(), errorMessage: 'connect failed',
      pattern: 'network error', category: 'ws_disconnect', severity: 'P3',
    });

    const apiPatterns = agg.getPatternsByCategory('api_failure');
    expect(apiPatterns.length).toBe(1);
    expect(apiPatterns[0].pattern).toBe('timeout');
  });

  it('should verify IncidentCommunicator draft templates', async () => {
    const { IncidentCommunicator } = await import(
      '../../src/escalation/incident-communicator'
    );
    const comm = new IncidentCommunicator();
    const incident = {
      id: 'inc-1',
      title: 'CLOB downtime',
      severity: 'P1' as const,
      description: 'CLOB API returning 503',
      startedAt: '2025-01-15T10:00:00Z',
      detectedBy: 'monitoring',
      affectedUsers: 150,
      affectedSystems: ['CLOB API'],
      status: 'investigating' as const,
    };

    const email = comm.draftIncidentNotification(incident, 'email');
    expect(email).toContain('CLOB downtime');
    expect(email).toContain('P1');

    const update = comm.draftIncidentUpdate(incident, 'Root cause identified');
    expect(update).toContain('CLOB downtime');
    expect(update).toContain('Root cause identified');

    const resolution = comm.draftResolutionNotice(incident, 'Fixed in v1.2');
    expect(resolution).toContain('CLOB downtime');
    expect(resolution).toContain('Fixed in v1.2');
  });

  it('should verify IncidentCommunicator calculateImpact', async () => {
    const { IncidentCommunicator } = await import(
      '../../src/escalation/incident-communicator'
    );
    const comm = new IncidentCommunicator();
    const incident = {
      id: 'inc-1',
      title: 'Test',
      severity: 'P0' as const,
      description: 'd',
      startedAt: '2025-01-01T00:00:00Z',
      detectedBy: 'auto',
      affectedUsers: 500,
      affectedSystems: ['clob'],
      status: 'investigating' as const,
    };

    const impact = comm.calculateImpact(incident, 10000);
    expect(impact.userPercentage).toBe('5.00');
    expect(impact.severityLabel).toBe('Critical — System-wide outage');
    expect(impact.communicationFrequency).toBe('every_5_min');
  });

  it('should verify TicketGenerator fromApiError factory', async () => {
    const { TicketGenerator } = await import('../../src/escalation/ticket-generator');
    const gen = new TicketGenerator();
    const report = gen.fromApiError({
      title: 'Order placement failed',
      apiError: { message: 'price too low' },
      request: { method: 'POST', url: '/orders' },
      userId: 'user-123',
    });
    expect(report.category).toBe('api_failure');
    expect(report.severity).toBe('P3'); // 'price too low' maps to P3
    expect(report.user).toBe('user-123');
  });

  it('should verify TicketGenerator fromBalanceDiscrepancy factory', async () => {
    const { TicketGenerator } = await import('../../src/escalation/ticket-generator');
    const gen = new TicketGenerator();
    const report = gen.fromBalanceDiscrepancy({
      address: '0x1234',
      clobBalance: '100',
      onChainBalance: '90',
      txHash: '0xabcd',
    });
    expect(report.category).toBe('balance_discrepancy');
    expect(report.severity).toBe('P1');
  });

  it('should verify TicketGenerator updateStatus', async () => {
    const { TicketGenerator } = await import('../../src/escalation/ticket-generator');
    const gen = new TicketGenerator();
    const report = gen.generateTicket({
      title: 't', category: 'other', description: 'd',
      stepsToReproduce: ['a'], expectedBehavior: 'b', actualBehavior: 'c',
    });
    expect(report.status).toBe('NEW');

    const updated = gen.updateStatus(report, 'RESOLVED');
    expect(updated.status).toBe('RESOLVED');
    expect(updated.resolvedAt).toBeDefined();
  });
});
