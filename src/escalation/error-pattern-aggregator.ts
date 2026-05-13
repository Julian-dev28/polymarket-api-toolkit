import pino from 'pino';

export interface ErrorEvent {
  id: string;
  timestamp: number;
  errorMessage: string;
  pattern: string;
  category: string;
  severity: string;
  userId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  errorCode?: string;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

export interface ErrorPattern {
  patternId: string;
  errorMessage: string;
  pattern: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  affectedUsers: string[];
  affectedSystems: string[];
  severity: string;
  category: string;
  relatedTickets: string[];
  suggestedFix: string | null;
  trend: 'stable' | 'increasing' | 'decreasing';
}

export class ErrorPatternAggregator {
  private events: ErrorEvent[] = [];
  private patterns: Map<string, ErrorPattern> = new Map();
  private logger: pino.Logger;

  constructor(logger?: pino.Logger) {
    this.logger = logger || pino({ level: 'info' });
  }

  /** Add an error event for pattern analysis */
  addEvent(event: ErrorEvent): void {
    this.events.push(event);
    this.updatePatterns();
    this.logger.debug({ pattern: event.pattern, userId: event.userId }, 'Error event added');
  }

  /** Add multiple error events at once */
  addEvents(events: ErrorEvent[]): void {
    this.events.push(...events);
    this.updatePatterns();
  }

  /** Detect error patterns from a raw error message */
  detectPattern(errorMessage: string, metadata?: {
    errorCode?: string;
    endpoint?: string;
    method?: string;
    statusCode?: number;
    userId?: string;
  }): string {
    // Normalize the error message to a pattern
    const normalized = this.normalizeMessage(errorMessage);

    // Create a pattern ID from the normalized message + error code
    const parts = [normalized];
    if (metadata?.errorCode) parts.push(metadata.errorCode);
    if (metadata?.statusCode) parts.push(String(metadata.statusCode));
    if (metadata?.endpoint) parts.push(metadata.endpoint);

    return parts.join('||').slice(0, 256);
  }

  /** Get aggregated error patterns */
  getPatterns(): ErrorPattern[] {
    return Array.from(this.patterns.values());
  }

  /** Get top N patterns by occurrence count */
  getTopPatterns(limit: number = 10): ErrorPattern[] {
    return this.getPatterns()
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit);
  }

  /** Get patterns for a specific category */
  getPatternsByCategory(category: string): ErrorPattern[] {
    return this.getPatterns().filter((p) => p.category === category);
  }

  /** Get patterns for a specific user */
  getPatternsForUser(userId: string): ErrorPattern[] {
    return this.getPatterns().filter((p) => p.affectedUsers.includes(userId));
  }

  /** Get patterns with critical severity */
  getCriticalPatterns(): ErrorPattern[] {
    return this.getPatterns().filter((p) => p.severity === 'P0' || p.severity === 'P1');
  }

  /** Generate a summary report for product feedback */
  generateSummaryReport(): {
    totalErrors: number;
    totalPatterns: number;
    criticalPatterns: number;
    topPatterns: ErrorPattern[];
    categoryBreakdown: Record<string, number>;
    severityBreakdown: Record<string, number>;
    suggestedPriorities: Array<{ pattern: string; reason: string }>;
  } {
    const patterns = this.getPatterns();
    const categoryBreakdown: Record<string, number> = {};
    const severityBreakdown: Record<string, number> = {};

    for (const p of patterns) {
      categoryBreakdown[p.category] = (categoryBreakdown[p.category] || 0) + 1;
      severityBreakdown[p.severity] = (severityBreakdown[p.severity] || 0) + p.occurrences;
    }

    const suggestedPriorities = patterns
      .sort((a, b) => {
        const severityOrder = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
        return (severityOrder[a.severity as keyof typeof severityOrder] ?? 4) -
          (severityOrder[b.severity as keyof typeof severityOrder] ?? 4);
      })
      .slice(0, 5)
      .map((p) => ({
        pattern: p.errorMessage,
        reason: `${p.occurrences} occurrences, ${p.severity} severity, ${p.affectedUsers.length} users affected`,
      }));

    return {
      totalErrors: this.events.length,
      totalPatterns: patterns.length,
      criticalPatterns: patterns.filter((p) => p.severity === 'P0' || p.severity === 'P1').length,
      topPatterns: this.getTopPatterns(10),
      categoryBreakdown,
      severityBreakdown,
      suggestedPriorities,
    };
  }

  /** Export patterns as CSV for import into analytics tools */
  exportCSV(): string {
    const header = 'pattern_id,error_message,occurrences,severity,category,first_seen,last_seen,affected_users,suggested_fix';
    const rows = this.getPatterns().map((p) =>
      [
        p.patternId,
        `"${p.errorMessage.replace(/"/g, '""')}"`,
        p.occurrences,
        p.severity,
        p.category,
        p.firstSeen,
        p.lastSeen,
        `"${p.affectedUsers.join('; ')}"`,
        p.suggestedFix ? `"${p.suggestedFix.replace(/"/g, '""')}"` : '',
      ].join(',')
    );
    return [header, ...rows].join('\n');
  }

  /** Generate actionable product feedback from error patterns */
  generateProductFeedback(): Array<{
    issue: string;
    impact: string;
    recommendation: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    category: string;
  }> {
    const patterns = this.getPatterns();
    const feedback: Array<{
      issue: string;
      impact: string;
      recommendation: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      category: string;
    }> = [];

    for (const pattern of patterns) {
      if (pattern.occurrences < 3) continue;

      const issue = `Pattern "${pattern.pattern}" occurs ${pattern.occurrences} times`;
      const impact = `${pattern.affectedUsers.length} users affected, ${pattern.severity} severity`;

      let recommendation = '';
      let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

      if (pattern.severity === 'P0' || pattern.severity === 'P1') {
        priority = 'HIGH';
        recommendation = 'Immediate investigation required';
      } else if (pattern.severity === 'P2') {
        priority = 'HIGH';
        recommendation = 'Investigate and add better error handling';
      } else if (pattern.category === 'api_failure' || pattern.category === 'ws_disconnect') {
        priority = 'MEDIUM';
        recommendation = 'Add retry logic and better error messaging';
      } else if (pattern.category === 'sdk_error' || pattern.category === 'integration_failure') {
        priority = 'MEDIUM';
        recommendation = 'Improve SDK documentation and error messages';
      } else {
        priority = 'LOW';
        recommendation = 'Monitor and address when convenient';
      }

      if (pattern.suggestedFix) {
        recommendation += `; ${pattern.suggestedFix}`;
      }

      feedback.push({
        issue,
        impact,
        recommendation,
        priority,
        category: pattern.category,
      });
    }

    return feedback.sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return order[a.priority] - order[b.priority];
    });
  }

  private normalizeMessage(message: string): string {
    return message
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
      .replace(/\b0x[0-9a-f]{40}\b/gi, '<ADDRESS>')
      .replace(/\b[0-9a-f]{64}\b/gi, '<HASH>')
      .replace(/\b\d+\b/g, '<N>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private updatePatterns(): void {
    const grouped: Map<string, ErrorEvent[]> = new Map();

    for (const event of this.events) {
      if (!grouped.has(event.pattern)) {
        grouped.set(event.pattern, []);
      }
      grouped.get(event.pattern)!.push(event);
    }

    this.patterns = new Map();

    for (const [pattern, events] of grouped) {
      const firstSeen = new Date(Math.min(...events.map((e) => e.timestamp))).toISOString();
      const lastSeen = new Date(Math.max(...events.map((e) => e.timestamp))).toISOString();
      const affectedUsers = [...new Set(events.map((e) => e.userId).filter(Boolean))];

      // Determine if trend is increasing, decreasing, or stable
      const sortedByTime = events.sort((a, b) => a.timestamp - b.timestamp);
      const midpoint = Math.floor(sortedByTime.length / 2);
      const firstHalf = sortedByTime.slice(0, midpoint).length;
      const secondHalf = sortedByTime.slice(midpoint).length;
      const trend: 'stable' | 'increasing' | 'decreasing' =
        secondHalf > firstHalf * 1.2 ? 'increasing' :
        firstHalf > secondHalf * 1.2 ? 'decreasing' : 'stable';

      const patternId = btoa(pattern).slice(0, 16);

      this.patterns.set(pattern, {
        patternId,
        errorMessage: events[0]?.errorMessage ?? 'unknown',
        pattern,
        occurrences: events.length,
        firstSeen,
        lastSeen,
        affectedUsers: affectedUsers as string[],
        affectedSystems: [...new Set(events.map((e) => e.endpoint || 'unknown'))],
        severity: (events[0]?.severity ?? 'P3') as 'P0' | 'P1' | 'P2' | 'P3' | 'P4',
        category: events[0]?.category ?? 'unknown',
        relatedTickets: [],
        suggestedFix: this.suggestFix(pattern, events[0]?.category ?? 'unknown'),
        trend,
      });
    }
  }

  private suggestFix(pattern: string, category: string): string | null {
    if (pattern.includes('timeout')) return 'Increase timeout threshold or optimize API response time';
    if (pattern.includes('rate limit') || pattern.includes('rate_limit')) return 'Implement request throttling and implement exponential backoff';
    if (pattern.includes('network')) return 'Add network retry logic and fallback endpoints';
    if (pattern.includes('wallet') || pattern.includes('connect')) return 'Improve wallet connection UX and error messaging';
    if (pattern.includes('order')) return 'Validate order parameters client-side before sending to API';
    if (pattern.includes('balance')) return 'Add real-time balance synchronization between CLOB and on-chain';
    if (pattern.includes('bridge')) return 'Improve bridge status monitoring and user notifications';
    if (category === 'ws_disconnect') return 'Implement heartbeat monitoring and automatic reconnection with backoff';
    if (category === 'integration_failure') return 'Add integration tests and SDK validation suite';
    if (category === 'performance_issue') return 'Profile and optimize slow API endpoints';
    return null;
  }
}
