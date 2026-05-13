import { createPublicClient, http, type Hex } from 'viem';
import { polygon, mainnet, arbitrum, base } from 'viem/chains';
import pino from 'pino';
import { ChainConfig, TokenConfig } from '../config';

export interface BridgeDeposit {
  fromChain: string;
  toChain: string;
  fromTxHash: Hex;
  toTxHash?: Hex;
  fromAddress: string;
  toAddress: string;
  amount: bigint;
  token: string;
  status: 'pending' | 'confirmed' | 'failed' | 'completed';
  timestamp: number;
  bridgeType: 'wormhole' | 'celer' | 'layerzero' | 'native' | 'onramp';
}

export interface BridgeWithdrawal {
  txHash: Hex;
  chain: string;
  fromAddress: string;
  toAddress: string;
  amount: bigint;
  token: string;
  status: 'initiated' | 'relayed' | 'completed' | 'failed';
  timestamp: number;
}

const BLOCK_EXPLORERS: Record<string, string> = {
  [polygon.name]: ChainConfig.polygon.blockExplorer,
  [mainnet.name]: 'https://etherscan.io',
  [arbitrum.name]: 'https://arbiscan.io',
  [base.name]: 'https://basescan.org',
};

export class BridgeTracer {
  private logger: pino.Logger;

  constructor() {
    this.logger = pino({ level: 'info' });
  }

  private async getRpcData(fromChain: string, txHash: Hex) {
    const transportUrls: Record<string, string> = {
      [polygon.name]: ChainConfig.polygon.rpcUrl,
      [mainnet.name]: 'https://eth.llamarpc.com',
      [arbitrum.name]: 'https://arb1.arbitrum.io/rpc',
      [base.name]: 'https://mainnet.base.org',
    };
    const url = transportUrls[fromChain];
    if (!url) throw new Error(`Unsupported chain: ${fromChain}`);

    const client = createPublicClient({
      chain: polygon,
      transport: http(url),
    });

    const tx = await client.getTransaction({ hash: txHash });
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });

    return { tx, receipt, block };
  }

  async traceDeposit(
    fromChain: string,
    fromTxHash: Hex,
    toAddress: string
  ): Promise<BridgeDeposit> {
    this.logger.info({ fromChain, fromTxHash, toAddress }, 'Tracing deposit');
    const { tx, receipt, block } = await this.getRpcData(fromChain, fromTxHash);

    return {
      fromChain,
      toChain: polygon.name,
      fromTxHash,
      toTxHash: undefined,
      fromAddress: tx.from,
      toAddress,
      amount: tx.value,
      token: 'ETH',
      status: receipt.status === 'success' ? 'confirmed' : 'failed',
      timestamp: Number(block.timestamp) * 1000,
      bridgeType: 'native',
    };
  }

  async tracePolymarketDeposits(
    _userAddress: string,
    _limit: number = 50
  ): Promise<BridgeDeposit[]> {
    this.logger.info({ user: _userAddress }, 'Tracing Polymarket deposits');
    return [];
  }

  async getProfileAddress(walletAddress: string): Promise<string> {
    return walletAddress.toLowerCase();
  }

  async traceWithdrawal(
    chain: string,
    txHash: Hex,
    fromAddress: string
  ): Promise<BridgeWithdrawal> {
    const transportUrls: Record<string, string> = {
      [polygon.name]: ChainConfig.polygon.rpcUrl,
      [mainnet.name]: 'https://eth.llamarpc.com',
      [arbitrum.name]: 'https://arb1.arbitrum.io/rpc',
      [base.name]: 'https://mainnet.base.org',
    };
    const url = transportUrls[chain];
    if (!url) throw new Error(`Unsupported chain: ${chain}`);

    const client = createPublicClient({
      chain: polygon,
      transport: http(url),
    });

    const receipt = await client.getTransactionReceipt({ hash: txHash });
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });

    return {
      txHash,
      chain,
      fromAddress,
      toAddress: receipt.to || '',
      amount: 0n,
      token: 'USDC',
      status: receipt.status === 'success' ? 'completed' : 'failed',
      timestamp: Number(block.timestamp) * 1000,
    };
  }

  async isDepositConfirmed(
    txHash: Hex,
    requiredConfirmations: number = 128
  ): Promise<{ confirmed: boolean; confirmations: number }> {
    const client = createPublicClient({
      chain: polygon,
      transport: http(ChainConfig.polygon.rpcUrl),
    });
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    const currentBlock = await client.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;
    return {
      confirmed: confirmations >= BigInt(requiredConfirmations),
      confirmations: Number(confirmations),
    };
  }

  getExplorerUrl(chain: string, txHash: Hex): string {
    const explorer = BLOCK_EXPLORERS[chain];
    if (!explorer) return String(txHash);
    return `${explorer}/tx/${txHash}`;
  }

  detectChain(tokenAddress: string): string | null {
    const lower = tokenAddress.toLowerCase();
    if (lower === TokenConfig.USDCE.toLowerCase()) return polygon.name;
    return null;
  }
}
