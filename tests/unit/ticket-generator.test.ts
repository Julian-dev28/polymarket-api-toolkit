import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TicketGenerator } from '../../src/support-tools/ticket-generator';

vi.mock('pino', () => ({
  default: vi.fn().mockReturnValue({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe('TicketGenerator', () => {
  let generator: TicketGenerator;

  beforeEach(() => {
    generator = new TicketGenerator();
  });

  // ---- generateTicket ----
  describe('generateTicket', () => {
    it('should create a structured bug report', () => {
      const ticket = generator.generateTicket({
        title: 'API timeout',
        category: 'api_failure',
        description: 'Requests timing out',
        stepsToReproduce: ['Send request', 'Wait for timeout'],
        expectedBehavior: 'Response within 5s',
        actualBehavior: 'Request timed out after 30s',
        affectedSystems: ['CLOB API'],
      });

      expect(ticket.title).toBe('API timeout');
      expect(ticket.severity).toBe('P2');
      expect(ticket.category).toBe('api_failure');
      expect(ticket.status).toBe('NEW');
      expect(ticket.id).toBeDefined();
      expect(ticket.createdAt).toBeDefined();
      expect(ticket.updatedAt).toBeDefined();
    });

    it('should assign default severity based on category', () => {
      const result = generator.generateTicket({
        title: 'Test', category: 'order_issue', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [],
      });
      expect(result.severity).toBe('P1');
    });

    it('should use provided severity', () => {
      const result = generator.generateTicket({
        title: 'Test', category: 'api_failure', severity: 'P0', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [],
      });
      expect(result.severity).toBe('P0');
    });

    it('should accept user field', () => {
      const result = generator.generateTicket({
        title: 'Test', category: 'api_failure', description: 'D',
        stepsToReproduce: [], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: [],
        user: '0x1234',
      });
      expect(result.user).toBe('0x1234');
    });
  });

  // ---- detectSeverityFromError ----
  describe('detectSeverityFromError', () => {
    it('should detect timeout severity', () => {
      expect(generator.detectSeverityFromError('Request timeout')).toBe('P2');
    });

    it('should detect rate limit severity', () => {
      expect(generator.detectSeverityFromError('Rate limit exceeded')).toBe('P2');
    });

    it('should detect rejected severity', () => {
      expect(generator.detectSeverityFromError('Order rejected')).toBe('P1');
    });

    it('should detect 503 severity', () => {
      expect(generator.detectSeverityFromError('Service unavailable 503')).toBe('P0');
    });

    it('should detect invalid severity', () => {
      expect(generator.detectSeverityFromError('Invalid price')).toBe('P3');
    });

    it('should default to P4', () => {
      expect(generator.detectSeverityFromError('Some random error')).toBe('P4');
    });
  });

  // ---- toMarkdown ----
  describe('toMarkdown', () => {
    it('should generate markdown format', () => {
      const ticket = generator.generateTicket({
        title: 'Test Ticket', category: 'api_failure', description: 'D',
        stepsToReproduce: ['Step 1'], expectedBehavior: 'E', actualBehavior: 'A',
        affectedSystems: ['CLOB API'],
      });
      const md = generator.toMarkdown(ticket);
      expect(md).toContain('# Test Ticket');
      expect(md).toContain('**ID:**');
      expect(md).toContain('**Severity:** P2');
    });
  });

  // ---- toJson ----
  describe('toJson', () => {
    it('should generate JSON output', () => {
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
      // Advance time to ensure updatedAt differs
      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.now() + 10));
      generator.updateStatus(ticket, 'TRIAGED');
      vi.useRealTimers();
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
      generator.updateRootCause(ticket, 'Memory leak');
      expect(ticket.rootCauseAnalysis).toBe('Memory leak');
      expect(ticket.updatedAt).toBeDefined();
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
      generator.addNote(ticket, 'admin', 'Investigating');
      expect(ticket.internalNotes).toHaveLength(1);
      expect(ticket.internalNotes[0].author).toBe('admin');
      expect(ticket.internalNotes[0].note).toBe('Investigating');
    });
  });

  // ---- fromApiError ----
  describe('fromApiError', () => {
    it('should create ticket from API error', () => {
      const ticket = generator.fromApiError({
        title: 'Order placement failed',
        apiError: new Error('Insufficient balance'),
        request: { method: 'POST', url: '/orders' },
        response: { status: 400, data: { err: 'Insufficient balance' } },
        userId: '0x1234',
      });
      expect(ticket.title).toBe('Order placement failed');
      expect(ticket.category).toBe('api_failure');
      expect(ticket.severity).toBe('P1');
      expect(ticket.user).toBe('0x1234');
    });
  });

  // ---- fromFailedOrder ----
  describe('fromFailedOrder', () => {
    it('should create ticket from failed order', () => {
      const ticket = generator.fromFailedOrder({
        orderId: 'order-456',
        orderParams: { tokenID: 'tok-1', price: '0.5', side: 'BUY', size: '10' },
        error: new Error('Insufficient balance'),
        userId: '0x1234',
      });
      expect(ticket.category).toBe('order_issue');
      expect(ticket.severity).toBe('P1');
    });
  });

  // ---- fromDepositDiscrepancy ----
  describe('fromDepositDiscrepancy', () => {
    it('should create ticket from deposit discrepancy', () => {
      const ticket = generator.fromDepositDiscrepancy({
        userAddress: '0x1234',
        expectedAmount: '1000',
        actualAmount: '900',
        txHash: '0xabc',
      });
      expect(ticket.category).toBe('deposit_problem');
      expect(ticket.severity).toBe('P1');
      expect(ticket.title).toContain('Deposit discrepancy');
    });
  });

  // ---- fromWSDisconnect ----
  describe('fromWSDisconnect', () => {
    it('should create ticket from WS disconnect', () => {
      const ticket = generator.fromWSDisconnect({
        tokenID: 'tok-1',
        disconnectCount: 5,
        lastErrorMessage: 'Connection reset',
        userId: '0x1234',
      });
      expect(ticket.category).toBe('ws_disconnect');
      expect(ticket.severity).toBe('P2');
      expect(ticket.title).toContain('WebSocket disconnected 5x');
    });
  });

  // ---- fromBalanceDiscrepancy ----
  describe('fromBalanceDiscrepancy', () => {
    it('should create ticket from balance discrepancy', () => {
      const ticket = generator.fromBalanceDiscrepancy({
        address: '0x1234',
        clobBalance: '100',
        onChainBalance: '90',
        txHash: '0xabc',
      });
      expect(ticket.category).toBe('balance_discrepancy');
      expect(ticket.severity).toBe('P1');
      expect(ticket.title).toContain('Balance discrepancy');
    });
  });
});
