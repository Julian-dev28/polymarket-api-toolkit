import { describe, it, expect, vi } from 'vitest';
import { PositionLookupCli } from '../../src/troubleshooting/position-lookup-cli';

vi.mock('pino', () => ({
  default: vi.fn().mockReturnValue({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('viem', () => ({
  createPublicClient: vi.fn().mockReturnValue({
    readContract: vi.fn().mockResolvedValue(BigInt('1000000000')),
    getBlockNumber: vi.fn().mockResolvedValue(BigInt('123456789')),
  }),
  http: vi.fn().mockReturnValue({}),
}));

vi.mock('viem/chains', () => ({
  polygon: { id: 137, name: 'Polygon PoS', network: 'polygon' },
}));

describe('PositionLookupCli', () => {
  // ---- getPositionSummary ----
  describe('getPositionSummary', () => {
    it('should return position summary with USDC and CTF positions', async () => {
      const cli = new PositionLookupCli();
      const summary = await cli.getPositionSummary('0x1234abc', ['token-1', 'token-2']);
      expect(summary.address).toBe('0x1234abc');
      expect(summary.usdc.balance).toBeDefined();
      expect(summary.usdc.token).toBe('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174');
      expect(summary.ctfPositions).toHaveLength(2);
      expect(summary.ctfPositions[0].tokenID).toBe('token-1');
      expect(summary.ctfPositions[1].tokenID).toBe('token-2');
      expect(summary.totalMarkets).toBeGreaterThanOrEqual(0);
      expect(summary.queriedAt).toBeDefined();
      expect(summary.blockNumber).toBeDefined();
    });

    it('should handle zero USDC balance', async () => {
      const mockViem = await import('viem');
      const client = mockViem.createPublicClient();
      (client.readContract as any).mockImplementation(({ functionName }: any) => {
        if (functionName === 'decimals') return Promise.resolve(6);
        return Promise.resolve(BigInt('0'));
      });

      const cli = new PositionLookupCli();
      const summary = await cli.getPositionSummary('0xempty', []);
      expect(summary.usdc.balance).toBe('0.000000');
    });

    it('should handle large balance', async () => {
      const mockViem = await import('viem');
      const client = mockViem.createPublicClient();
      (client.readContract as any).mockImplementation(({ functionName }: any) => {
        if (functionName === 'decimals') return Promise.resolve(6);
        return Promise.resolve(BigInt('999999999999999999'));
      });

      const cli = new PositionLookupCli();
      const summary = await cli.getPositionSummary('0x1234', []);
      // 999999999999999999 / 10^6 = 999999999.999999
      expect(summary.usdc.balance).toBeDefined();
      expect(Number(summary.usdc.balance)).toBeGreaterThan(0);
    });

    it('should count markets with non-zero CTF balance', async () => {
      const mockViem = await import('viem');
      const client = mockViem.createPublicClient();
      (client.readContract as any).mockImplementation(async ({ functionName, args }: any) => {
        if (functionName === 'decimals') return Promise.resolve(6);
        // For CTF balanceOf with specific args, return 0 for some tokens
        return Promise.resolve(BigInt('100'));
      });

      const cli = new PositionLookupCli();
      const summary = await cli.getPositionSummary('0x1234', ['tok-1', 'tok-2']);
      // Both have non-zero balance
      expect(summary.totalMarkets).toBe(2);
    });

    it('should handle errors in CTF balance queries gracefully', async () => {
      const mockViem = await import('viem');
      const client = mockViem.createPublicClient();
      let callCount = 0;
      (client.readContract as any).mockImplementation(async ({ functionName }: any) => {
        if (functionName === 'decimals') return Promise.resolve(6);
        callCount++;
        if (callCount <= 1) return Promise.resolve(BigInt('50'));
        throw new Error('Contract error');
      });

      const cli = new PositionLookupCli();
      const summary = await cli.getPositionSummary('0x1234', ['tok-1', 'tok-2']);
      expect(summary.ctfPositions).toHaveLength(2);
      expect(summary.ctfPositions[0].balance).toBe('50');
      expect(summary.ctfPositions[1].balance).toBe('0');
    });

    it('should handle empty token IDs list', async () => {
      const mockViem = await import('viem');
      const client = mockViem.createPublicClient();
      (client.readContract as any).mockResolvedValue(BigInt('500000000'));

      const cli = new PositionLookupCli();
      const summary = await cli.getPositionSummary('0x1234', []);
      expect(summary.ctfPositions).toEqual([]);
      expect(summary.totalMarkets).toBe(0);
    });
  });

  // ---- formatSummary ----
  describe('formatSummary', () => {
    it('should format summary with all fields', () => {
      const cli = new PositionLookupCli();
      const summary = {
        address: '0x1234abc',
        usdc: { balance: '1000.500000', token: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' },
        ctfPositions: [
          { tokenID: '0xabc123def456', balance: '10' },
          { tokenID: '0xdef789abc012', balance: '0' },
        ],
        totalMarkets: 1,
        queriedAt: '2024-01-15T10:00:00Z',
        blockNumber: BigInt('123456789'),
      };
      const output = cli.formatSummary(summary);
      expect(output).toContain('Position Summary for 0x1234abc');
      expect(output).toContain('Queried at: 2024-01-15T10:00:00Z');
      expect(output).toContain('Block: 123456789');
      expect(output).toContain('USDC.e Balance: 1000.500000');
      expect(output).toContain('Markets with positions: 1');
      expect(output).toContain('CTF Positions:');
      expect(output).toContain('✓ 10');
      expect(output).toContain('empty');
    });

    it('should truncate token IDs in output', () => {
      const cli = new PositionLookupCli();
      const summary = {
        address: '0xaddr',
        usdc: { balance: '0.000000', token: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' },
        ctfPositions: [{ tokenID: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', balance: '5' }],
        totalMarkets: 1,
        queriedAt: '2024-01-01T00:00:00Z',
        blockNumber: BigInt('100'),
      };
      const output = cli.formatSummary(summary);
      // Token ID should be truncated to first 18 chars + '...'
      expect(output).toContain('0x1234567890abcdef12...');
    });

    it('should show empty for zero balance', () => {
      const cli = new PositionLookupCli();
      const summary = {
        address: '0xaddr',
        usdc: { balance: '0.000000', token: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' },
        ctfPositions: [{ tokenID: '0xtok', balance: '0' }],
        totalMarkets: 0,
        queriedAt: '2024-01-01T00:00:00Z',
        blockNumber: BigInt('100'),
      };
      const output = cli.formatSummary(summary);
      expect(output).toContain('empty');
      expect(output).not.toContain('✓');
    });
  });
});
