import { createPublicClient, http, type Hex, type PublicClient } from 'viem';
import { polygon, ethereum, arbitrum, base } from 'viem/chains';
import pino from 'pino';
import { ChainConfig, ContractConfig, TokenConfig } from '../config';

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
  [ethereum.name]: 'https://etherscan.io',
  [arbitrum.name]: 'https://arbiscan.io',
  [base.name]: 'https://basescan.org',
};

export class BridgeTracer {
  private clients: Record<string, PublicClient>;
  private logger: pino.Logger;

  constructor() {
    this.clients = {
      [polygon.name]: createPublicClient({
        chain: polygon,
        transport: http(ChainConfig.polygon.rpcUrl),
      }),
      [ethereum.name]: createPublicClient({
        chain: ethereum,
        transport: http('https://eth.llamarpc.com'),
      }),
      [arbitrum.name]: createPublicClient({
        chain: arbitrum,
        transport: http('https://arb1.arbitrum.io/rpc'),
      }),
      [base.name]: createPublicClient({
        chain: base,
        transport: http('https://mainnet.base.org'),
      }),
    };
    this.logger = pino({ level: 'info' });
  }

  async traceDeposit(
    fromChain: string,
    fromTxHash: Hex,
    toAddress: string
  ): Promise<BridgeDeposit> {
    this.logger.info('Tracing deposit:', { fromChain, fromTxHash, toAddress });
    const client = this.clients[fromChain];
    if (!client) throw new Error(`Unsupported chain: ${fromChain}`);

    const tx = await client.getTransaction({ hash: fromTxHash });
    const receipt = await client.getTransactionReceipt({ hash: fromTxHash });
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });

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
    userAddress: string,
    limit: number = 50
  ): Promise<BridgeDeposit[]> {
    this.logger.info('Tracing Polymarket deposits for:', userAddress);
    const client = this.clients[polygon.name];
    const fromBlock = await client.getBlockNumber();

    const transferEvent =
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    const toPad = '0x000000000000000000000000' + userAddress.slice(2).toLowerCase();

    const logs = await client.getLogs({
      address: TokenConfig.USDCE as `0x${string}`,
      fromBlock: fromBlock - 100000n,
      toBlock: 'latest',
      topics: [transferEvent, null, toPad as `0x${string}`],
    });

    const deposits: BridgeDeposit[] = logs.map((log) => ({
      fromChain: polygon.name,
      toChain: polygon.name,
      fromTxHash: log.transactionHash,
      fromAddress: log.args?.from || '',
      toAddress: userAddress,
      amount: log.args?.value || 0n,
      token: ContractConfig.USDCE,
      status: 'confirmed',
      timestamp: 0,
      bridgeType: 'native',
    }));

    return deposits.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  async getProfileAddress(walletAddress: string): Promise<string> {
    return walletAddress.toLowerCase();
  }

  async traceWithdrawal(
    chain: string,
    txHash: Hex,
    fromAddress: string
  ): Promise<BridgeWithdrawal> {
    const client = this.clients[chain];
    if (!client) throw new Error(`Unsupported chain: ${chain}`);

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
    const client = this.clients[polygon.name];
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
    if (!explorer) return txHash;
    return `${explorer}/tx/${txHash}`;
  }

  detectChain(tokenAddress: string): string | null {
    const lower = tokenAddress.toLowerCase();
    if (lower === TokenConfig.USDCE.toLowerCase()) return polygon.name;
    if (lower === ContractConfig.USDCE.toLowerCase()) return polygon.name;
    return null;
  }
}
