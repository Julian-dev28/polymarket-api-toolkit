import { describe, it, expect, vi } from 'vitest';

// Mock viem completely - we test blockchain modules' logic, not actual RPC calls
vi.mock('viem', () => ({
  createPublicClient: vi.fn(),
  http: vi.fn(() => vi.fn()),
  polygon: { name: 'polygon', id: 137 },
  mainnet: { name: 'mainnet', id: 1 },
  arbitrum: { name: 'arbitrum', id: 42161 },
  base: { name: 'base', id: 8453 },
}));

vi.mock('viem/chains', () => ({
  polygon: { name: 'polygon', id: 137 },
  mainnet: { name: 'mainnet', id: 1 },
  arbitrum: { name: 'arbitrum', id: 42161 },
  base: { name: 'base', id: 8453 },
}));
