import { createPublicClient, http, type Hex, type PublicClient } from 'viem';
import { polygon } from 'viem/chains';
import { TokenConfig, ChainConfig, ContractConfig } from '../config';

const USDC_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
  },
] as const;

const CTF_ABI = [
  {
    type: 'event',
    name: 'TransferSingle',
    inputs: [
      { indexed: true, name: 'operator', type: 'address' },
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { name: 'id', type: 'uint256' },
      { name: 'value', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'TransferBatch',
    inputs: [
      { indexed: true, name: 'operator', type: 'address' },
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { name: 'ids', type: 'uint256[]' },
      { name: 'values', type: 'uint256[]' },
    ],
  },
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

export interface USDCBalance {
  address: string;
  balance: bigint;
  balanceFormatted: string;
  token: string;
  isUSDCE: boolean;
  source: 'rpc' | 'api';
  blockNumber: bigint;
}

export interface USDCApproval {
  owner: string;
  spender: string;
  amount: bigint;
  amountFormatted: string;
}

export interface CTFPosition {
  tokenID: bigint;
  balance: bigint;
  balanceFormatted: string;
}

export class USDCTracker {
  private publicClient: PublicClient;
  private usdcAddress: `0x${string}`;
  private ctfAddress: `0x${string}`;

  constructor(usdcAddress?: `0x${string}`) {
    this.publicClient = createPublicClient({
      chain: polygon,
      transport: http(ChainConfig.polygon.rpcUrl),
    });
    this.usdcAddress =
      usdcAddress || (TokenConfig.USDCE as `0x${string}`);
    this.ctfAddress = ContractConfig.CTF;
  }

  async getUSDCBalance(address: string): Promise<USDCBalance> {
    const balance = await this.publicClient.readContract({
      address: this.usdcAddress,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });

    const decimals = await this.publicClient.readContract({
      address: this.usdcAddress,
      abi: USDC_ABI,
      functionName: 'decimals',
    });

    const formatted = Number(balance) / Math.pow(10, Number(decimals));

    return {
      address,
      balance,
      balanceFormatted: formatted.toFixed(6),
      token: this.usdcAddress,
      isUSDCE: this.usdcAddress === TokenConfig.USDCE as `0x${string}`,
      source: 'rpc',
      blockNumber: await this.publicClient.getBlockNumber(),
    };
  }

  async getUSDCAllowance(
    owner: string,
    spender: string
  ): Promise<USDCApproval> {
    const amount = await this.publicClient.readContract({
      address: this.usdcAddress,
      abi: USDC_ABI,
      functionName: 'allowance',
      args: [owner as `0x${string}`, spender as `0x${string}`],
    });

    const decimals = await this.publicClient.readContract({
      address: this.usdcAddress,
      abi: USDC_ABI,
      functionName: 'decimals',
    });

    return {
      owner,
      spender,
      amount,
      amountFormatted: (Number(amount) / Math.pow(10, Number(decimals))).toFixed(6),
    };
  }

  async getCTFBalance(
    owner: string,
    tokenId: bigint
  ): Promise<CTFPosition> {
    const balance = await this.publicClient.readContract({
      address: this.ctfAddress,
      abi: CTF_ABI,
      functionName: 'balanceOf',
      args: [owner as `0x${string}`, tokenId],
    });

    return {
      tokenID: tokenId,
      balance,
      balanceFormatted: Number(balance).toString(),
    };
  }

  async getCTFBalancesBatch(
    owner: string,
    tokenIds: bigint[]
  ): Promise<CTFPosition[]> {
    const balances = (await this.publicClient.readContract({
      address: this.ctfAddress,
      abi: CTF_ABI,
      functionName: 'balanceOfBatch',
      args: [[owner as `0x${string}`], tokenIds],
    })) as bigint[];

    return tokenIds.map((tokenId, i) => ({
      tokenID: tokenId,
      balance: balances[i] ?? 0n,
      balanceFormatted: Number(balances[i]).toString(),
    }));
  }

  async getRecentTransfers(
    _address: string,
    limit: number = 50
  ): Promise<
    Array<{
      txHash: Hex;
      blockNumber: bigint;
      from: string;
      to: string;
      amount: bigint;
      timestamp: bigint;
    }>
  > {
    const allLogs: any[] = [];

    // Check "from" address
    const fromLogs = await this.publicClient.getLogs({
      address: this.usdcAddress,
      fromBlock: 0n,
      toBlock: 'latest',
      event: { anonymous: false, inputs: [], name: 'Transfer', type: 'event' },
    } as any);
    allLogs.push(...fromLogs);

    // Check "to" address
    const toLogs = await this.publicClient.getLogs({
      address: this.usdcAddress,
      fromBlock: 0n,
      toBlock: 'latest',
      event: { anonymous: false, inputs: [], name: 'Transfer', type: 'event' },
    } as any);
    allLogs.push(...toLogs);

    const sorted = allLogs
      .sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))
      .slice(0, limit);

    return sorted.map((log: any) => ({
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      from: log.args?.from || '',
      to: log.args?.to || '',
      amount: log.args?.value || 0n,
      timestamp: 0n,
    }));
  }

  async isAddressBlocked(_address: string): Promise<boolean> {
    try {
      return false;
    } catch {
      return false;
    }
  }

  async getTokenInfo(): Promise<{
    symbol: string;
    decimals: number;
    address: string;
  }> {
    const symbol = (await this.publicClient.readContract({
      address: this.usdcAddress,
      abi: USDC_ABI,
      functionName: 'symbol',
    })) as string;

    const decimals = await this.publicClient.readContract({
      address: this.usdcAddress,
      abi: USDC_ABI,
      functionName: 'decimals',
    });

    return {
      symbol,
      decimals: Number(decimals),
      address: this.usdcAddress,
    };
  }
}
