import { createPublicClient, http, type Hex, type PublicClient } from 'viem';
import { polygon } from 'viem/chains';
import pino from 'pino';
import { ChainConfig, ContractConfig, TokenConfig } from '../config';

const CTF_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOfBatch',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'accounts', type: 'address[]' },
      { name: 'ids', type: 'uint256[]' },
    ],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
] as const;

export interface PositionReconciliation {
  address: string;
  usdcBalance: { raw: bigint; formatted: string };
  ctfBalances: Array<{ tokenID: string; balance: string; tokenIDHex: string }>;
  totalPositions: number;
  onChainAtBlock: bigint;
  reconciled: boolean;
  discrepancies: string[];
}

export class PositionLookup {
  private publicClient: PublicClient;
  private ctfAddress: `0x${string}`;
  private logger: pino.Logger;

  constructor(rpcUrl?: string) {
    this.publicClient = createPublicClient({
      chain: polygon,
      transport: http(rpcUrl || ChainConfig.polygon.rpcUrl),
    });
    this.ctfAddress = ContractConfig.CTF;
    this.logger = pino({ level: 'info' });
  }

  /** Get CTF token balances for a wallet address */
  async getCTFPositions(
    address: string,
    tokenIDs: bigint[]
  ): Promise<Array<{ tokenID: bigint; balance: bigint }>> {
    if (tokenIDs.length === 0) return [];

    const balances = await this.publicClient.readContract({
      address: this.ctfAddress,
      abi: CTF_ABI,
      functionName: 'balanceOfBatch',
      args: [[address as `0x${string}`], tokenIDs],
    }) as bigint[];

    return tokenIDs.map((tokenID, i) => ({
      tokenID,
      balance: balances[i],
    }));
  }

  /** Get USDC.e balance for reconciliation */
  async getUSDCEBalance(address: string): Promise<{
    raw: bigint;
    formatted: string;
  }> {
    const balance = await this.publicClient.getBalance({
      address: address as `0x${string}`,
    });

    const usdcBalance = await this.publicClient.readContract({
      address: TokenConfig.USDCE as `0x${string}`,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
        {
          name: 'decimals',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'uint8' }],
        },
      ] as const,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });

    const decimals = await this.publicClient.readContract({
      address: TokenConfig.USDCE as `0x${string}`,
      abi: [
        {
          name: 'decimals',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'uint8' }],
        },
      ] as const,
      functionName: 'decimals',
    });

    const formatted =
      Number(usdcBalance) / Math.pow(10, Number(decimals));

    return {
      raw: usdcBalance,
      formatted: formatted.toFixed(6),
    };
  }

  /** Reconcile on-chain positions against expected state */
  async reconcilePositions(
    address: string,
    expectedCTFBalances: Array<{ tokenID: bigint; expectedBalance: bigint }>,
    expectedUSDC: string
  ): Promise<PositionReconciliation> {
    const tokenIDs = expectedCTFBalances.map((e) => e.tokenID);
    const onChainCTF = await this.getCTFPositions(address, tokenIDs);
    const usdcBalance = await this.getUSDCEBalance(address);
    const onChainBlock = await this.publicClient.getBlockNumber();

    const discrepancies: string[] = [];
    const ctfFormatted: Array<{
      tokenID: string;
      balance: string;
      tokenIDHex: string;
    }> = [];

    for (const expected of expectedCTFBalances) {
      const onChain = onChainCTF.find(
        (c) => c.tokenID === expected.tokenID
      );
      const actual = onChain?.balance ?? 0n;

      if (actual !== expected.expectedBalance) {
        discrepancies.push(
          `Token ${expected.tokenID.toString()}: expected ${expected.expectedBalance}, got ${actual}`
        );
      }

      ctfFormatted.push({
        tokenID: expected.tokenID.toString(),
        balance: Number(actual).toString(),
        tokenIDHex: `0x${expected.tokenID.toString(16).padStart(64, '0')}`,
      });
    }

    // Also check USDC discrepancy
    const expectedUSDCNum = parseFloat(expectedUSDC);
    if (Math.abs(parseFloat(usdcBalance.formatted) - expectedUSDCNum) > 0.001) {
      discrepancies.push(
        `USDC: expected ${expectedUSDC}, got ${usdcBalance.formatted}`
      );
    }

    return {
      address,
      usdcBalance,
      ctfBalances: ctfFormatted,
      totalPositions: tokenIDs.length,
      onChainAtBlock: onChainBlock,
      reconciled: discrepancies.length === 0,
      discrepancies,
    };
  }

  /** Look up all CTF tokens for an address by scanning recent transfers */
  async scanCTFTokens(
    address: string,
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<bigint[]> {
    const transferEvent =
      '0x4a39dc063a9487ef31ee81dd5a70df66840649ff074b0c8b0c01f3b6e00e17e1';

    const logs = await this.publicClient.getLogs({
      address: this.ctfAddress,
      fromBlock,
      toBlock,
      topics: [
        transferEvent,
        null,
        '0x' + address.slice(2).toLowerCase().padStart(64, '0'),
      ],
    });

    const tokenIds = new Set<bigint>();
    for (const log of logs) {
      // Extract token ID from data (for TransferSingle) or topics
      if (log.topics.length >= 4) {
        const tokenId = BigInt(log.topics[3]);
        tokenIds.add(tokenId);
      }
    }
    return Array.from(tokenIds);
  }

  /** Get all token IDs for a specific market's outcomes */
  async getMarketTokenIDs(
    conditionId: Hex,
    outcomeCount: number = 2
  ): Promise<bigint[]> {
    // For binary markets: outcome tokens are derived from condition ID
    // Each outcome gets a sequential token ID
    const baseTokenID = BigInt(conditionId);
    const tokens: bigint[] = [];

    for (let i = 0; i < outcomeCount; i++) {
      tokens.push(baseTokenID + BigInt(i));
    }
    return tokens;
  }

  /** Quick balance summary for a user */
  async getBalanceSummary(address: string): Promise<{
    usdc: string;
    ctfTokens: number;
    nativeBalance: string;
    blockNumber: bigint;
  }> {
    const [usdc, nativeBalance, blockNumber] = await Promise.all([
      this.getUSDCEBalance(address),
      this.publicClient.getBalance({
        address: address as `0x${string}`,
      }),
      this.publicClient.getBlockNumber(),
    ]);

    return {
      usdc: usdc.formatted,
      ctfTokens: 0, // Would need to scan for actual count
      nativeBalance: Number(nativeBalance) / 1e18,
      blockNumber,
    };
  }
}
