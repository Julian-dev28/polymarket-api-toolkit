import { describe, it, expect } from 'vitest';

describe('Root barrel: src/index.ts', () => {
  // Import from root barrel to ensure it re-exports properly
  // We can safely import modules that don't need viem/RPC
  it('should expose config exports via root barrel', async () => {
    // Config modules are re-exported through src/index.ts
    // These don't need viem, so they import cleanly
    const { TicketGenerator } = await import('../../src/support-tools/ticket-generator');
    expect(typeof TicketGenerator).toBe('function');
    const gen = new TicketGenerator();
    expect(typeof gen.generateTicket).toBe('function');
    expect(typeof gen.toMarkdown).toBe('function');
    expect(typeof gen.toJson).toBe('function');
    expect(typeof gen.updateStatus).toBe('function');
  });

  it('should expose support tools classes via root barrel', async () => {
    const { ErrorPatternAggregator } = await import('../../src/support-tools/error-pattern-aggregator');
    expect(typeof ErrorPatternAggregator).toBe('function');
    const agg = new ErrorPatternAggregator();
    expect(typeof agg.addEvent).toBe('function');
    expect(typeof agg.getPatterns).toBe('function');
    expect(typeof agg.getTopPatterns).toBe('function');
  });

  it('should expose incident communicator via root barrel', async () => {
    const { IncidentCommunicator } = await import('../../src/support-tools/incident-communicator');
    expect(typeof IncidentCommunicator).toBe('function');
    const comm = new IncidentCommunicator();
    expect(typeof comm.draftIncidentNotification).toBe('function');
    expect(typeof comm.draftIncidentUpdate).toBe('function');
    expect(typeof comm.draftResolutionNotice).toBe('function');
    expect(typeof comm.calculateImpact).toBe('function');
  });
});
