import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorPatternAggregator, type ErrorEvent, type ErrorPattern } from '../../src/support-tools/error-pattern-aggregator';

vi.mock('pino', () => ({
  default: vi.fn().mockReturnValue({ debug: vi.fn() }),
}));

describe('ErrorPatternAggregator', () => {
  let agg: ErrorPatternAggregator;

  beforeEach(() => {
    agg = new ErrorPatternAggregator();
  });

  // ---- addEvent / addEvents ----
  describe('addEvent / addEvents', () => {
    it('should store a single event and update patterns', () => {
      const event: ErrorEvent = {
        id: 'e1',
        timestamp: Date.now(),
        errorMessage: 'Request timeout',
        pattern: 'timeout||504',
        category: 'api_failure',
        severity: 'P2',
      };
      agg.addEvent(event);
      const patterns = agg.getPatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0].pattern).toBe('timeout||504');
      expect(patterns[0].occurrences).toBe(1);
    });

    it('should aggregate multiple events with same pattern', () => {
      const now = Date.now();
      const events: ErrorEvent[] = [
        { id: 'e1', timestamp: now, errorMessage: 'Request timeout', pattern: 'timeout||504', category: 'api_failure', severity: 'P2' },
        { id: 'e2', timestamp: now + 1000, errorMessage: 'Request timeout', pattern: 'timeout||504', category: 'api_failure', severity: 'P2' },
        { id: 'e3', timestamp: now + 2000, errorMessage: 'Request timeout', pattern: 'timeout||504', category: 'api_failure', severity: 'P2' },
      ];
      agg.addEvents(events);
      const patterns = agg.getPatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0].occurrences).toBe(3);
    });

    it('should group events with different patterns separately', () => {
      const now = Date.now();
      agg.addEvents([
        { id: 'e1', timestamp: now, errorMessage: 'Request timeout', pattern: 'timeout||504', category: 'api_failure', severity: 'P2' },
        { id: 'e2', timestamp: now + 1000, errorMessage: 'Wallet disconnected', pattern: 'wallet_disconnect', category: 'sdk_error', severity: 'P3' },
      ]);
      const patterns = agg.getPatterns();
      expect(patterns).toHaveLength(2);
    });

    it('should populate affectedUsers from events', () => {
      const now = Date.now();
      agg.addEvents([
        { id: 'e1', timestamp: now, errorMessage: 'Test', pattern: 'p1', category: 'other', severity: 'P3', userId: 'user1' },
        { id: 'e2', timestamp: now + 1000, errorMessage: 'Test', pattern: 'p1', category: 'other', severity: 'P3', userId: 'user2' },
        { id: 'e3', timestamp: now + 2000, errorMessage: 'Test', pattern: 'p1', category: 'other', severity: 'P3', userId: 'user1' },
      ]);
      const patterns = agg.getPatterns();
      expect(patterns[0].affectedUsers).toEqual(['user1', 'user2']);
    });

    it('should populate affectedSystems from events', () => {
      const now = Date.now();
      agg.addEvents([
        { id: 'e1', timestamp: now, pattern: 'p1', category: 'api_failure', severity: 'P2', errorMessage: 'T', endpoint: '/order' },
        { id: 'e2', timestamp: now + 1000, pattern: 'p1', category: 'api_failure', severity: 'P2', errorMessage: 'T', endpoint: '/trades' },
      ]);
      const patterns = agg.getPatterns();
      expect(patterns[0].affectedSystems).toEqual(['/order', '/trades']);
    });
  });

  // ---- detectPattern / normalizeMessage ----
  describe('detectPattern', () => {
    it('should normalize UUIDs in error messages', () => {
      const pattern = agg.detectPattern('Error: failed for request abc123def4-5678-9abc-def0-123456789abc with id abc123def4-5678-9abc-def0-123456789abc');
      expect(pattern).not.toContain('abc123def4');
      expect(pattern).toContain('<UUID>');
    });

    it('should normalize 0x addresses', () => {
      const pattern = agg.detectPattern('Transfer failed for 0x1234567890abcdef1234567890abcdef12345678');
      expect(pattern).not.toContain('0x1234');
      expect(pattern).toContain('<ADDRESS>');
    });

    it('should normalize numeric values', () => {
      const pattern = agg.detectPattern('Timeout after 30000ms with balance 1000.50');
      expect(pattern).not.toContain('30000');
      expect(pattern).not.toContain('1000.50');
      expect(pattern).toContain('<N>');
    });

    it('should append metadata to pattern', () => {
      const pattern = agg.detectPattern('Timeout', { errorCode: 'ECONNABORTED', statusCode: 504, endpoint: '/order' });
      expect(pattern).toContain('ECONNABORTED');
      expect(pattern).toContain('504');
      expect(pattern).toContain('/order');
    });

    it('should truncate long patterns to 256 chars', () => {
      const longMessage = 'a'.repeat(300);
      const pattern = agg.detectPattern(longMessage);
      expect(pattern.length).toBeLessThanOrEqual(256);
    });
  });

  // ---- getPatterns / getTopPatterns ----
  describe('getPatterns / getTopPatterns', () => {
    it('should return empty when no events added', () => {
      expect(agg.getPatterns()).toEqual([]);
    });

    it('should return top N patterns by occurrence', () => {
      const now = Date.now();
      agg.addEvents([
        { id: 'e1', timestamp: now, errorMessage: 'A', pattern: 'p1', category: 'x', severity: 'P3' },
        { id: 'e2', timestamp: now + 100, errorMessage: 'A', pattern: 'p1', category: 'x', severity: 'P3' },
        { id: 'e3', timestamp: now + 200, errorMessage: 'A', pattern: 'p1', category: 'x', severity: 'P3' },
        { id: 'e4', timestamp: now + 300, errorMessage: 'B', pattern: 'p2', category: 'y', severity: 'P3' },
        { id: 'e5', timestamp: now + 400, errorMessage: 'B', pattern: 'p2', category: 'y', severity: 'P3' },
        { id: 'e6', timestamp: now + 500, errorMessage: 'C', pattern: 'p3', category: 'z', severity: 'P3' },
      ]);
      const top = agg.getTopPatterns(2);
      expect(top).toHaveLength(2);
      expect(top[0].pattern).toBe('p1');
      expect(top[0].occurrences).toBe(3);
      expect(top[1].pattern).toBe('p2');
      expect(top[1].occurrences).toBe(2);
    });

    it('should default limit to 10', () => {
      const now = Date.now();
      for (let i = 0; i < 15; i++) {
        agg.addEvent({
          id: `e${i}`, timestamp: now + i, errorMessage: 'T', pattern: `p${i}`, category: 'x', severity: 'P3',
        });
      }
      const top = agg.getTopPatterns();
      expect(top).toHaveLength(10);
    });
  });

  // ---- getPatternsByCategory ----
  describe('getPatternsByCategory', () => {
    it('should filter patterns by category', () => {
      const now = Date.now();
      agg.addEvents([
        { id: 'e1', timestamp: now, pattern: 'p1', category: 'api_failure', severity: 'P2', errorMessage: 'T' },
        { id: 'e2', timestamp: now + 100, pattern: 'p2', category: 'api_failure', severity: 'P2', errorMessage: 'T' },
        { id: 'e3', timestamp: now + 200, pattern: 'p3', category: 'sdk_error', severity: 'P3', errorMessage: 'T' },
      ]);
      const apiPatterns = agg.getPatternsByCategory('api_failure');
      expect(apiPatterns).toHaveLength(2);
      const sdkPatterns = agg.getPatternsByCategory('sdk_error');
      expect(sdkPatterns).toHaveLength(1);
    });

    it('should return empty for non-existent category', () => {
      agg.addEvents([
        { id: 'e1', timestamp: Date.now(), pattern: 'p1', category: 'other', severity: 'P3', errorMessage: 'T' },
      ]);
      expect(agg.getPatternsByCategory('nonexistent')).toEqual([]);
    });
  });

  // ---- getPatternsForUser ----
  describe('getPatternsForUser', () => {
    it('should filter patterns by user', () => {
      const now = Date.now();
      agg.addEvents([
        { id: 'e1', timestamp: now, pattern: 'p1', category: 'x', severity: 'P3', errorMessage: 'T', userId: 'user1' },
        { id: 'e2', timestamp: now + 100, pattern: 'p1', category: 'x', severity: 'P3', errorMessage: 'T', userId: 'user1' },
        { id: 'e3', timestamp: now + 200, pattern: 'p2', category: 'x', severity: 'P3', errorMessage: 'T', userId: 'user2' },
      ]);
      const user1Patterns = agg.getPatternsForUser('user1');
      expect(user1Patterns).toHaveLength(1);
      expect(user1Patterns[0].pattern).toBe('p1');
    });

    it('should return empty for non-existent user', () => {
      agg.addEvents([
        { id: 'e1', timestamp: Date.now(), pattern: 'p1', category: 'x', severity: 'P3', errorMessage: 'T', userId: 'user1' },
      ]);
      expect(agg.getPatternsForUser('unknown')).toEqual([]);
    });
  });

  // ---- getCriticalPatterns ----
  describe('getCriticalPatterns', () => {
    it('should return only P0 and P1 patterns', () => {
      const now = Date.now();
      agg.addEvents([
        { id: 'e1', timestamp: now, pattern: 'p1', category: 'x', severity: 'P0', errorMessage: 'T' },
        { id: 'e2', timestamp: now + 100, pattern: 'p2', category: 'x', severity: 'P1', errorMessage: 'T' },
        { id: 'e3', timestamp: now + 200, pattern: 'p3', category: 'x', severity: 'P2', errorMessage: 'T' },
        { id: 'e4', timestamp: now + 300, pattern: 'p4', category: 'x', severity: 'P3', errorMessage: 'T' },
      ]);
      const critical = agg.getCriticalPatterns();
      expect(critical).toHaveLength(2);
      expect(critical.map((p) => p.pattern)).toContain('p1');
      expect(critical.map((p) => p.pattern)).toContain('p2');
    });

    it('should return empty when no critical patterns', () => {
      agg.addEvent({ id: 'e1', timestamp: Date.now(), pattern: 'p1', category: 'x', severity: 'P3', errorMessage: 'T' });
      expect(agg.getCriticalPatterns()).toEqual([]);
    });
  });

  // ---- generateSummaryReport ----
  describe('generateSummaryReport', () => {
    it('should return comprehensive summary', () => {
      const now = Date.now();
      agg.addEvents([
        { id: 'e1', timestamp: now, pattern: 'timeout||504', category: 'api_failure', severity: 'P2', errorMessage: 'Timeout', userId: 'u1' },
        { id: 'e2', timestamp: now + 1000, pattern: 'timeout||504', category: 'api_failure', severity: 'P2', errorMessage: 'Timeout', userId: 'u2' },
        { id: 'e3', timestamp: now + 2000, pattern: 'critical|P0', category: 'on_chain_issue', severity: 'P0', errorMessage: 'Fatal', userId: 'u1' },
      ]);
      const report = agg.generateSummaryReport();
      expect(report.totalErrors).toBe(3);
      expect(report.totalPatterns).toBe(2);
      expect(report.criticalPatterns).toBe(1);
      expect(report.categoryBreakdown).toHaveProperty('api_failure');
      expect(report.categoryBreakdown).toHaveProperty('on_chain_issue');
      expect(report.severityBreakdown).toHaveProperty('P2');
      expect(report.severityBreakdown).toHaveProperty('P0');
      expect(report.suggestedPriorities).toBeDefined();
      expect(report.suggestedPriorities.length).toBeLessThanOrEqual(5);
    });

    it('should sort suggested priorities by severity', () => {
      const now = Date.now();
      agg.addEvents([
        { id: 'e1', timestamp: now, pattern: 'p1', category: 'x', severity: 'P4', errorMessage: 'Low' },
        { id: 'e2', timestamp: now + 100, pattern: 'p2', category: 'x', severity: 'P0', errorMessage: 'Critical' },
        { id: 'e3', timestamp: now + 200, pattern: 'p3', category: 'x', severity: 'P1', errorMessage: 'High' },
      ]);
      const report = agg.generateSummaryReport();
      expect(report.suggestedPriorities[0].pattern).toBe('Critical');
      expect(report.suggestedPriorities[1].pattern).toBe('High');
    });

    it('should return defaults when empty', () => {
      const report = agg.generateSummaryReport();
      expect(report.totalErrors).toBe(0);
      expect(report.totalPatterns).toBe(0);
      expect(report.criticalPatterns).toBe(0);
      expect(report.topPatterns).toEqual([]);
      expect(report.categoryBreakdown).toEqual({});
      expect(report.severityBreakdown).toEqual({});
      expect(report.suggestedPriorities).toEqual([]);
    });
  });

  // ---- exportCSV ----
  describe('exportCSV', () => {
    it('should return header + data rows', () => {
      const now = Date.now();
      agg.addEvents([
        { id: 'e1', timestamp: now, pattern: 'p1', category: 'api_failure', severity: 'P2', errorMessage: 'Timeout', userId: 'u1' },
        { id: 'e2', timestamp: now + 1000, pattern: 'p1', category: 'api_failure', severity: 'P2', errorMessage: 'Timeout', userId: 'u2' },
      ]);
      const csv = agg.exportCSV();
      const lines = csv.split('\n');
      expect(lines[0]).toContain('pattern_id,error_message,occurrences,severity');
      expect(lines.length).toBe(2); // header + 1 row
      expect(lines[1]).toContain('2'); // occurrences
    });

    it('should return just header when no events', () => {
      const csv = agg.exportCSV();
      expect(csv.split('\n').length).toBe(1);
      expect(csv.split('\n')[0]).toContain('pattern_id');
    });

    it('should escape quotes in error messages', () => {
      agg.addEvent({
        id: 'e1', timestamp: Date.now(), pattern: 'p1',
        category: 'x', severity: 'P3', errorMessage: 'Error with "quotes"',
      });
      const csv = agg.exportCSV();
      expect(csv).toContain('""quotes""');
    });
  });

  // ---- generateProductFeedback ----
  describe('generateProductFeedback', () => {
    it('should skip patterns with fewer than 3 occurrences', () => {
      agg.addEvent({ id: 'e1', timestamp: Date.now(), pattern: 'p1', category: 'api_failure', severity: 'P2', errorMessage: 'T' });
      const feedback = agg.generateProductFeedback();
      expect(feedback).toEqual([]);
    });

    it('should generate feedback for patterns with 3+ occurrences', () => {
      const now = Date.now();
      agg.addEvents([
        { id: 'e1', timestamp: now, pattern: 'timeout', category: 'api_failure', severity: 'P2', errorMessage: 'Timeout' },
        { id: 'e2', timestamp: now + 1000, pattern: 'timeout', category: 'api_failure', severity: 'P2', errorMessage: 'Timeout' },
        { id: 'e3', timestamp: now + 2000, pattern: 'timeout', category: 'api_failure', severity: 'P2', errorMessage: 'Timeout' },
      ]);
      const feedback = agg.generateProductFeedback();
      expect(feedback).toHaveLength(1);
      expect(feedback[0].issue).toContain('timeout');
      expect(feedback[0].priority).toBe('MEDIUM');
      expect(feedback[0].category).toBe('api_failure');
    });

    it('should assign HIGH priority for P0/P1 severity', () => {
      const now = Date.now();
      agg.addEvents([
        { id: 'e1', timestamp: now, pattern: 'fatal', category: 'on_chain_issue', severity: 'P0', errorMessage: 'Fatal' },
        { id: 'e2', timestamp: now + 1000, pattern: 'fatal', category: 'on_chain_issue', severity: 'P0', errorMessage: 'Fatal' },
        { id: 'e3', timestamp: now + 2000, pattern: 'fatal', category: 'on_chain_issue', severity: 'P0', errorMessage: 'Fatal' },
      ]);
      const feedback = agg.generateProductFeedback();
      expect(feedback[0].priority).toBe('HIGH');
      expect(feedback[0].recommendation).toContain('Immediate investigation');
    });

    it('should sort feedback by priority HIGH > MEDIUM > LOW', () => {
      const now = Date.now();
      // HIGH: P1 with 3+ occurrences
      agg.addEvents([
        { id: 'e1', timestamp: now, pattern: 'critical', category: 'on_chain_issue', severity: 'P1', errorMessage: 'Critical' },
        { id: 'e2', timestamp: now + 1000, pattern: 'critical', category: 'on_chain_issue', severity: 'P1', errorMessage: 'Critical' },
        { id: 'e3', timestamp: now + 2000, pattern: 'critical', category: 'on_chain_issue', severity: 'P1', errorMessage: 'Critical' },
      ]);
      // MEDIUM: ws_disconnect with 3+ occurrences
      agg.addEvents([
        { id: 'e4', timestamp: now + 3000, pattern: 'ws', category: 'ws_disconnect', severity: 'P3', errorMessage: 'WS' },
        { id: 'e5', timestamp: now + 4000, pattern: 'ws', category: 'ws_disconnect', severity: 'P3', errorMessage: 'WS' },
        { id: 'e6', timestamp: now + 5000, pattern: 'ws', category: 'ws_disconnect', severity: 'P3', errorMessage: 'WS' },
      ]);
      const feedback = agg.generateProductFeedback();
      expect(feedback[0].priority).toBe('HIGH');
      expect(feedback[1].priority).toBe('MEDIUM');
    });

    it('should include suggestedFix in recommendation when present', () => {
      const now = Date.now();
      agg.addEvents([
        { id: 'e1', timestamp: now, pattern: 'timeout with custom fix', category: 'other', severity: 'P3', errorMessage: 'T' },
        { id: 'e2', timestamp: now + 1000, pattern: 'timeout with custom fix', category: 'other', severity: 'P3', errorMessage: 'T' },
        { id: 'e3', timestamp: now + 2000, pattern: 'timeout with custom fix', category: 'other', severity: 'P3', errorMessage: 'T' },
      ]);
      const feedback = agg.generateProductFeedback();
      expect(feedback[0].recommendation).toContain('Increase timeout threshold');
    });
  });

  // ---- ErrorPattern fields ----
  describe('ErrorPattern fields', () => {
    it('should have correct patternId (btoa-based)', () => {
      agg.addEvent({ id: 'e1', timestamp: Date.now(), pattern: 'my_pattern', category: 'x', severity: 'P3', errorMessage: 'T' });
      const patterns = agg.getPatterns();
      expect(patterns[0].patternId).toBeDefined();
      expect(patterns[0].patternId.length).toBe(16);
    });

    it('should calculate firstSeen and lastSeen correctly', () => {
      const now = Date.now();
      agg.addEvents([
        { id: 'e1', timestamp: now, pattern: 'p', category: 'x', severity: 'P3', errorMessage: 'T' },
        { id: 'e2', timestamp: now + 10000, pattern: 'p', category: 'x', severity: 'P3', errorMessage: 'T' },
      ]);
      const patterns = agg.getPatterns();
      expect(patterns[0].firstSeen).toBe(new Date(now).toISOString());
      expect(patterns[0].lastSeen).toBe(new Date(now + 10000).toISOString());
    });

    it('should determine trend correctly', () => {
      const now = Date.now();
      // Increasing: second half more than first half * 1.2
      const events: ErrorEvent[] = [];
      for (let i = 0; i < 10; i++) {
        events.push({ id: `e${i}`, timestamp: now + i * 1000, pattern: 'p', category: 'x', severity: 'P3', errorMessage: 'T' });
      }
      agg.addEvents(events);
      const patterns = agg.getPatterns();
      expect(patterns[0].trend).toBe('stable'); // exactly split = stable
    });
  });
});
