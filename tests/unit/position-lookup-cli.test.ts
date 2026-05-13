import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PositionLookupCli } from '../../src/troubleshooting/position-lookup-cli';

vi.mock('pino', () => ({
  default: vi.fn().mockReturnValue({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const mocks = vi.hoisted(() => ({
  mockReadContract: vi.fn(),
  mockGetBlockNumber: vi.fn(),
}));

vi.mock('viem', () => ({
  createPublicClient: vi.fn().mockReturnValue({
    readContract: mocks.mockReadContract,
    getBlockNumber: mocks.mockGetBlockNumber,
  }),
  http: vi.fn().mockReturnValue({}),
}));

vi.mock('viem/chains', () => ({
  polygon: { id: 137, name: 'Polygon PoS', network: 'polygon' },
}));

describe('PositionLookupCli', () => {
  let cli: PositionLookupCli;

  beforeEach(() => {
    cli = new PositionLookupCli();
    vi.clearAllMocks();
    // Default: decimals returns 6, balanceOf returns 1000000000
    mocks.mockReadContract.mockImplementation(({ functionName }: any) => {
      if (functionName === 'decimals') return Promise.resolve(6);
      return Promise.resolve(BigInt('1000000000'));
    });
    mocks.mockGetBlockNumber.mockResolvedValue(BigInt('123456789'));
  });

  // ---- getPositionSummary ----
  describe('getPositionSummary', () => {
    it('should return position summary with USDC and CTF positions', async () => {
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
      mocks.mockReadContract.mockImplementation(({ functionName }: any) => {
        if (functionName === 'decimals') return Promise.resolve(6);
        return Promise.resolve(BigInt('0'));
      });

      const summary = await cli.getPositionSummary('0xempty', []);
      expect(summary.usdc.balance).toBe('0.000000');
    });

    it('should handle large balance', async () => {
      mocks.mockReadContract.mockImplementation(({ functionName }: any) => {
        if (functionName === 'decimals') return Promise.resolve(6);
        return Promise.resolve(BigInt('999999999999999999'));
      });

      const summary = await cli.getPositionSummary('0x1234', []);
      expect(summary.usdc.balance).toBeDefined();
      expect(Number(summary.usdc.balance)).toBeGreaterThan(0);
    });

    it('should count markets with non-zero CTF balance', async () => {
      mocks.mockReadContract.mockImplementation(async ({ functionName }: any) => {
        if (functionName === 'decimals') return Promise.resolve(6);
        return Promise.resolve(BigInt('100'));
      });

      // Use valid hex tokenIDs that BigInt() can parse
      const summary = await cli.getPositionSummary('0x1234', ['0x0000000000000000000000000000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000000000000000000000000000002']);
      expect(summary.totalMarkets).toBe(2);
    });

    it('should handle errors in CTF balance queries gracefully', async () => {
      let callCount = 0;
      mocks.mockReadContract.mockImplementation(async ({ functionName }: any) => {
        if (functionName === 'decimals') return Promise.resolve(6);
        callCount++;
        if (callCount <= 1) return Promise.resolve(BigInt('50'));
        throw new Error('Contract error');
      });

      // Use valid hex tokenIDs
      const summary = await cli.getPositionSummary('0x1234', ['0x0000000000000000000000000000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000000000000000000000000000002']);
      expect(summary.ctfPositions).toHaveLength(2);
      // USDC balanceOf consumes callCount=1 (returns BigInt('50')), so both CTF queries throw
      expect(summary.ctfPositions[0].balance).toBe('0');
      expect(summary.ctfPositions[1].balance).toBe('0');
    });

    it('should handle empty token IDs list', async () => {
      mocks.mockReadContract.mockImplementation(({ functionName }: any) => {
        if (functionName === 'decimals') return Promise.resolve(6);
        return Promise.resolve(BigInt('500000000'));
      });

      const summary = await cli.getPositionSummary('0x1234', []);
      expect(summary.ctfPositions).toEqual([]);
      expect(summary.totalMarkets).toBe(0);
    });
  });

  // ---- formatSummary ----
  describe('formatSummary', () => {
    it('should format summary with all fields', () => {
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
      expect(output).toContain('0x1234567890abcdef...');
    });

    it('should show empty for zero balance', () => {
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
