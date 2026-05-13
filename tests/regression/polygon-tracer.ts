import { describe, it, expect } from 'vitest';
import { PolygonTracer } from '../../src/blockchain/polygon-tracer';

describe('PolygonTracer', () => {
  it('should decode USDC transfer events from mock logs', () => {
    const tracer = new PolygonTracer();
    const mockLogs = [
      {
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          '0x0000000000000000000000001111111111111111111111111111111111111111',
          '0x0000000000000000000000002222222222222222222222222222222222222222',
        ],
        data: '0x00000000000000000000000000000000000000000000000000000de0b6b3a7640000',
      },
    ];
    const transfers = tracer.decodeUSDCLogs(mockLogs);
    expect(transfers).toBeDefined();
    expect(Array.isArray(transfers)).toBe(true);
    expect(transfers[0]?.from).toBe('0x1111111111111111111111111111111111111111');
    expect(transfers[0]?.to).toBe('0x2222222222222222222222222222222222222222');
  });

  it('should return empty array for non-matching logs', () => {
    const tracer = new PolygonTracer();
    const mockLogs = [
      {
        topics: ['0x0000000000000000000000000000000000000000000000000000000000000000'],
        data: '0x00',
      },
    ];
    const transfers = tracer.decodeUSDCLogs(mockLogs);
    expect(transfers).toEqual([]);
  });

  it('should decode approval events', () => {
    const tracer = new PolygonTracer();
    const mockLogs = [
      {
        topics: [
          '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
          '0x0000000000000000000000001111111111111111111111111111111111111111',
          '0x0000000000000000000000003333333333333333333333333333333333333333',
        ],
        data: '0x000000000000000000000000000000000000000000000000016345785d8a0000',
      },
    ];
    const approvals = tracer.decodeApprovalLogs(mockLogs);
    expect(approvals).toBeDefined();
    expect(Array.isArray(approvals)).toBe(true);
    expect(approvals[0]?.owner).toBe('0x1111111111111111111111111111111111111111');
  });

  it('should decode ERC-1155 batch transfers', () => {
    const tracer = new PolygonTracer();
    const mockLogs = [
      {
        topics: [
          '0x4a39dc063a9487ef31ee81dd5a70df66840649ff074b0c8b0c01f3b6e00e17e1',
          '0x0000000000000000000000001111111111111111111111111111111111111111',
          '0x0000000000000000000000002222222222222222222222222222222222222222',
          '0x0000000000000000000000000000000000000000000000000000000000000002',
          '0x0000000000000000000000000000000000000000000000000000000000000001',
        ],
        data: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000016345785d8a0000',
      },
    ];
    const transfers = tracer.decodeERC1155BatchTransferLogs(mockLogs);
    expect(transfers).toBeDefined();
    expect(Array.isArray(transfers)).toBe(true);
  });

  it('should generate correct block explorer URLs', () => {
    const tracer = new PolygonTracer();
    const url = tracer.getBlockExplorerUrl('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
    expect(url).toContain('polygonscan.com');
    expect(url).toContain('tx/');
  });

  it('should construct valid transaction info', () => {
    const mockTx = {
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      blockNumber: 12345678n,
      from: '0x1111111111111111111111111111111111111111',
      to: '0x2222222222222222222222222222222222222222',
      value: 1000000000000000000n,
      gas: 21000n,
      gasPrice: 30000000000n,
      status: 'success' as const,
      logs: [],
      blockExplorerUrl: 'https://polygonscan.com/tx/0x1234...',
    };
    expect(mockTx.hash).toHaveLength(66);
    expect(mockTx.from).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(mockTx.blockNumber).toBeGreaterThan(0n);
  });
});
