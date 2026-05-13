import { describe, it, expect } from 'vitest';
import { TicketGenerator } from '../../src/escalation/ticket-generator';

describe('TicketGenerator', () => {
  const generator = new TicketGenerator();

  // ---- detectSeverityFromError ----
  describe('detectSeverityFromError', () => {
    it('should return P0 for 503/502/fatal errors', () => {
      expect(generator.detectSeverityFromError('Service unavailable')).toBe('P0');
      expect(generator.detectSeverityFromError('HTTP 502 Bad Gateway')).toBe('P0');
      expect(generator.detectSeverityFromError('HTTP 503')).toBe('P0');
      expect(generator.detectSeverityFromError('Fatal error in matching engine')).toBe('P0');
    });

    it('should return P1 for blocked/rejected errors', () => {
      expect(generator.detectSeverityFromError('Order rejected')).toBe('P1');
      expect(generator.detectSeverityFromError('insufficient balance')).toBe('P1');
      expect(generator.detectSeverityFromError('Account blocked')).toBe('P1');
    });

    it('should return P2 for timeout/rate limit errors', () => {
      expect(generator.detectSeverityFromError('Request timeout')).toBe('P2');
      expect(generator.detectSeverityFromError('Rate limit exceeded')).toBe('P2');
      expect(generator.detectSeverityFromError('rate_limited')).toBe('P2');
    });

    it('should return P3 for validation errors', () => {
      expect(generator.detectSeverityFromError('Invalid price')).toBe('P3');
      expect(generator.detectSeverityFromError('price too low')).toBe('P3');
      expect(generator.detectSeverityFromError('tick size error')).toBe('P3');
    });

    it('should return P4 for unknown errors', () => {
      expect(generator.detectSeverityFromError('Something weird happened')).toBe('P4');
      expect(generator.detectSeverityFromError('')).toBe('P4');
    });
  });

  // ---- defaultSeverity (via generateTicket) ----
  describe('default severity mapping', () => {
    const base = {
      title: 'Test', category: 'api_failure' as const, description: 'D',
      stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
    };

    it('should assign P1 for order_issue', () => {
      const t = generator.generateTicket({ ...base, category: 'order_issue' });
      expect(t.severity).toBe('P1');
    });

    it('should assign P1 for deposit_problem', () => {
      const t = generator.generateTicket({ ...base, category: 'deposit_problem' });
      expect(t.severity).toBe('P1');
    });

    it('should assign P1 for balance_discrepancy', () => {
      const t = generator.generateTicket({ ...base, category: 'balance_discrepancy' });
      expect(t.severity).toBe('P1');
    });

    it('should assign P1 for on_chain_issue', () => {
      const t = generator.generateTicket({ ...base, category: 'on_chain_issue' });
      expect(t.severity).toBe('P1');
    });

    it('should assign P2 for api_failure/ws_disconnect/integration_failure/position_issue', () => {
      for (const cat of ['api_failure', 'ws_disconnect', 'integration_failure', 'position_issue'] as const) {
        const t = generator.generateTicket({ ...base, category: cat });
        expect(t.severity).toBe('P2');
      }
    });

    it('should assign P3 for sdk_error/performance_issue', () => {
      for (const cat of ['sdk_error', 'performance_issue'] as const) {
        const t = generator.generateTicket({ ...base, category: cat });
        expect(t.severity).toBe('P3');
      }
    });

    it('should assign P4 for other', () => {
      const t = generator.generateTicket({ ...base, category: 'other' });
      expect(t.severity).toBe('P4');
    });
  });

  // ---- generateTicket basic ----
  describe('generateTicket', () => {
    it('should create a ticket with all required fields', () => {
      const ticket = generator.generateTicket({
        title: 'Order placement failed',
        category: 'order_issue',
        description: 'Orders failing with 500',
        stepsToReproduce: ['Connect wallet', 'Place order'],
        expectedBehavior: 'Order accepted',
        actualBehavior: 'Returns 500',
        affectedSystems: ['CLOB API'],
      });

      expect(ticket.id).toBeDefined();
      expect(ticket.title).toBe('Order placement failed');
      expect(ticket.severity).toBe('P1');
      expect(ticket.status).toBe('NEW');
      expect(ticket.assignedTo).toBeNull();
      expect(ticket.rootCauseAnalysis).toBeNull();
      expect(ticket.workaround).toBeNull();
      expect(ticket.resolvedAt).toBeNull();
      expect(ticket.linkedTickets).toEqual([]);
      expect(ticket.internalNotes).toEqual([]);
    });

    it('should allow custom severity override', () => {
      const ticket = generator.generateTicket({
        title: 'Test', category: 'other', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [], severity: 'P0',
      });
      expect(ticket.severity).toBe('P0');
    });

    it('should allow null user', () => {
      const ticket = generator.generateTicket({
        title: 'Test', category: 'sdk_error', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [], user: null,
      });
      expect(ticket.user).toBeNull();
    });

    it('should default affectedSystems to category', () => {
      const ticket = generator.generateTicket({
        title: 'Test', category: 'api_failure', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
      });
      expect(ticket.affectedSystems).toEqual(['api_failure']);
    });
  });

  // ---- evidence ----
  describe('evidence collection', () => {
    it('should attach evidence to a ticket', () => {
      const ticket = generator.generateTicket({
        title: 'With evidence', category: 'api_failure', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [],
        evidence: {
          apiRequests: [{ method: 'POST', url: '/order' }],
          apiResponses: [{ status: 500, data: { error: 'timeout' }, timestamp: '2024-01-01' }],
          errorLogs: ['Error: request timeout'],
          txHashes: ['0xabc123def456'],
          orderIds: ['order-123'],
          userAddresses: ['0x1234'],
          walletInfo: { address: '0x1234', chain: 'polygon' },
          screenshots: ['screenshot1.png'],
          timestamps: ['2024-01-01T00:00:00Z'],
        },
      });

      expect(ticket.evidence.errorLogs?.[0]).toBe('Error: request timeout');
      expect(ticket.evidence.txHashes?.[0]).toBe('0xabc123def456');
      expect(ticket.evidence.apiRequests?.[0].method).toBe('POST');
      expect(ticket.evidence.orderIds?.[0]).toBe('order-123');
      expect(ticket.evidence.userAddresses?.[0]).toBe('0x1234');
      expect(ticket.evidence.walletInfo?.address).toBe('0x1234');
      expect(ticket.evidence.screenshots?.[0]).toBe('screenshot1.png');
    });

    it('should work with empty evidence', () => {
      const ticket = generator.generateTicket({
        title: 'No evidence', category: 'other', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [],
      });
      expect(ticket.evidence).toEqual({});
    });
  });

  // ---- toMarkdown ----
  describe('toMarkdown', () => {
    it('should generate markdown with all sections', () => {
      const ticket = generator.generateTicket({
        title: 'API Down', category: 'api_failure', description: 'CLOB down',
        stepsToReproduce: ['Step 1'], expectedBehavior: 'Up', actualBehavior: 'Down',
        affectedSystems: ['CLOB'],
      });
      const md = generator.toMarkdown(ticket);
      expect(md).toContain('# API Down');
      expect(md).toContain('**ID:**');
      expect(md).toContain('**Severity:** P2');
      expect(md).toContain('**Category:** api_failure');
      expect(md).toContain('## Description');
      expect(md).toContain('CLOB down');
      expect(md).toContain('## Steps to Reproduce');
      expect(md).toContain('## Expected Behavior');
      expect(md).toContain('## Actual Behavior');
      expect(md).toContain('## Affected Systems');
      expect(md).toContain('---');
    });

    it('should include root cause in markdown when present', () => {
      const ticket = generator.generateTicket({
        title: 'Test', category: 'other', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [],
      });
      generator.updateRootCause(ticket, 'Missing null check');
      const md = generator.toMarkdown(ticket);
      expect(md).toContain('## Root Cause Analysis');
      expect(md).toContain('Missing null check');
    });

    it('should include workaround in markdown when present', () => {
      const ticket = generator.generateTicket({
        title: 'Test', category: 'other', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [], workaround: 'Retry after 5s',
      });
      const md = generator.toMarkdown(ticket);
      expect(md).toContain('## Workaround');
      expect(md).toContain('Retry after 5s');
    });

    it('should include user line when present', () => {
      const ticket = generator.generateTicket({
        title: 'Test', category: 'other', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [], user: '0x1234',
      });
      const md = generator.toMarkdown(ticket);
      expect(md).toContain('**User:** 0x1234');
    });

    it('should omit user line when null', () => {
      const ticket = generator.generateTicket({
        title: 'Test', category: 'other', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [], user: null,
      });
      const md = generator.toMarkdown(ticket);
      expect(md).not.toMatch(/\*\*User:\*\*/);
    });
  });

  // ---- toJson ----
  describe('toJson', () => {
    it('should serialize the ticket to JSON', () => {
      const ticket = generator.generateTicket({
        title: 'Test', category: 'other', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [],
      });
      const json = generator.toJson(ticket);
      const parsed = JSON.parse(json);
      expect(parsed.id).toBe(ticket.id);
      expect(parsed.title).toBe('Test');
    });
  });

  // ---- updateStatus ----
  describe('updateStatus', () => {
    it('should update status and updatedAt', () => {
      const ticket = generator.generateTicket({
        title: 'Test', category: 'other', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [],
      });
      const before = ticket.updatedAt;
      generator.updateStatus(ticket, 'TRIAGED');
      expect(ticket.status).toBe('TRIAGED');
      expect(ticket.updatedAt).not.toBe(before);
    });

    it('should set resolvedAt on RESOLVED', () => {
      const ticket = generator.generateTicket({
        title: 'Test', category: 'other', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [],
      });
      generator.updateStatus(ticket, 'RESOLVED');
      expect(ticket.status).toBe('RESOLVED');
      expect(ticket.resolvedAt).toBeDefined();
    });

    it('should set resolvedAt on CLOSED', () => {
      const ticket = generator.generateTicket({
        title: 'Test', category: 'other', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [],
      });
      generator.updateStatus(ticket, 'CLOSED');
      expect(ticket.status).toBe('CLOSED');
      expect(ticket.resolvedAt).toBeDefined();
    });
  });

  // ---- updateRootCause ----
  describe('updateRootCause', () => {
    it('should set rootCauseAnalysis and updatedAt', () => {
      const ticket = generator.generateTicket({
        title: 'Test', category: 'other', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [],
      });
      expect(ticket.rootCauseAnalysis).toBeNull();
      generator.updateRootCause(ticket, 'Null pointer in parseOrder()');
      expect(ticket.rootCauseAnalysis).toBe('Null pointer in parseOrder()');
    });
  });

  // ---- addNote ----
  describe('addNote', () => {
    it('should add an internal note', () => {
      const ticket = generator.generateTicket({
        title: 'Test', category: 'other', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [],
      });
      generator.addNote(ticket, 'support@polymarket.com', 'Looking into this');
      expect(ticket.internalNotes).toHaveLength(1);
      expect(ticket.internalNotes[0].author).toBe('support@polymarket.com');
      expect(ticket.internalNotes[0].note).toBe('Looking into this');
      expect(ticket.internalNotes[0].timestamp).toBeDefined();
    });

    it('should allow multiple notes', () => {
      const ticket = generator.generateTicket({
        title: 'Test', category: 'other', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [],
      });
      generator.addNote(ticket, 'eng@pm', 'Checking logs');
      generator.addNote(ticket, 'support@pm', 'User confirmed');
      expect(ticket.internalNotes).toHaveLength(2);
    });
  });

  // ---- fromApiError ----
  describe('fromApiError', () => {
    it('should generate a ticket from an API error', () => {
      const ticket = generator.fromApiError({
        title: 'CLOB timeout',
        apiError: { message: 'Request timeout', status: 504 },
        request: { method: 'POST', url: '/order', headers: {}, body: {} },
        response: { status: 504, data: { error: 'timeout' } },
        userId: '0x1234',
      });
      expect(ticket.title).toContain('CLOB timeout');
      expect(ticket.category).toBe('api_failure');
      expect(ticket.severity).toBe('P2'); // timeout -> P2
      expect(ticket.evidence.apiRequests?.[0].method).toBe('POST');
    });

    it('should handle string error', () => {
      const ticket = generator.fromApiError({
        title: 'String error',
        apiError: 'Something broke',
        request: {},
      });
      expect(ticket.severity).toBe('P4');
      expect(ticket.description).toContain('Something broke');
    });
  });

  // ---- fromFailedOrder ----
  describe('fromFailedOrder', () => {
    it('should generate a ticket from a failed order', () => {
      const ticket = generator.fromFailedOrder({
        orderId: 'order-456',
        orderParams: { tokenID: 'tok-1', price: '0.65', side: 'BUY', size: '100' },
        error: new Error('Insufficient balance'),
        userId: '0x1234',
      });
      expect(ticket.title).toContain('order-456');
      expect(ticket.category).toBe('order_issue');
      expect(ticket.severity).toBe('P1');
      expect(ticket.evidence.orderIds?.[0]).toBe('order-456');
    });
  });

  // ---- fromDepositDiscrepancy ----
  describe('fromDepositDiscrepancy', () => {
    it('should generate a ticket from a deposit issue', () => {
      const ticket = generator.fromDepositDiscrepancy({
        userAddress: '0x1234',
        expectedAmount: '1000',
        actualAmount: '900',
        txHash: '0xabc123',
        chain: 'polygon',
      });
      expect(ticket.title).toContain('Deposit discrepancy');
      expect(ticket.category).toBe('deposit_problem');
      expect(ticket.severity).toBe('P1');
      expect(ticket.evidence.txHashes?.[0]).toBe('0xabc123');
      expect(ticket.evidence.walletInfo?.address).toBe('0x1234');
    });
  });

  // ---- fromWSDisconnect ----
  describe('fromWSDisconnect', () => {
    it('should generate a ticket from WS disconnects', () => {
      const ticket = generator.fromWSDisconnect({
        tokenID: 'tok-1',
        disconnectCount: 5,
        lastErrorMessage: 'Connection reset',
        userId: '0x1234',
      });
      expect(ticket.category).toBe('ws_disconnect');
      expect(ticket.severity).toBe('P2');
      expect(ticket.title).toContain('5x');
    });
  });

  // ---- fromBalanceDiscrepancy ----
  describe('fromBalanceDiscrepancy', () => {
    it('should generate a ticket from balance mismatch', () => {
      const ticket = generator.fromBalanceDiscrepancy({
        address: '0x1234',
        clobBalance: '1000',
        onChainBalance: '900',
        txHash: '0xabc',
      });
      expect(ticket.category).toBe('balance_discrepancy');
      expect(ticket.severity).toBe('P1');
      expect(ticket.title).toContain('CLOB shows 1000');
      expect(ticket.title).toContain('on-chain shows 900');
    });
  });
});
