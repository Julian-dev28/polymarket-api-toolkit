import { createPublicClient, http, type Hex, type PublicClient } from 'viem';
import { polygon } from 'viem/chains';
import pino from 'pino';
import { ChainConfig, ContractConfig } from '../config';

export interface TracedTransaction {
  hash: Hex;
  blockNumber: bigint;
  from: string;
  to: string;
  value: bigint;
  gas: bigint;
  gasPrice: bigint;
  status: 'success' | 'reverted';
  logs: Array<{ address: string; topics: string[]; data: string }>;
  blockExplorerUrl: string;
}

export interface BlockInfo {
  number: bigint;
  timestamp: bigint;
  hash: Hex;
  transactions: number;
}

export class PolygonTracer {
  private publicClient: PublicClient;
  private logger: pino.Logger;

  constructor(rpcUrl?: string) {
    this.publicClient = createPublicClient({
      chain: polygon,
      transport: http(rpcUrl || ChainConfig.polygon.rpcUrl),
    });
    this.logger = pino({ level: 'info' });
  }

  /** Get a fully traced transaction with decoded events */
  async traceTransaction(txHash: Hex): Promise<TracedTransaction> {
    this.logger.info('Tracing transaction:', txHash);
    const receipt = await this.publicClient.getTransactionReceipt({ hash: txHash });
    const tx = await this.publicClient.getTransaction({ hash: txHash });
    const blockInfo = await this.getBlockInfo(receipt.blockNumber);

    this.logger.info('Transaction traced:', {
      hash: txHash,
      block: Number(receipt.blockNumber),
      status: receipt.status,
      gasUsed: receipt.gasUsed,
    });

    return {
      hash: txHash,
      blockNumber: receipt.blockNumber,
      from: tx.from,
      to: tx.to || '',
      value: tx.value,
      gas: tx.gas,
      gasPrice: tx.gasPrice,
      status: receipt.status === 'success' ? 'success' : 'reverted',
      logs: receipt.logs.map((log) => ({
        address: log.address,
        topics: log.topics,
        data: log.data,
      })),
      blockExplorerUrl: `${ChainConfig.polygon.blockExplorer}/tx/${txHash}`,
    };
  }

  /** Decode USDC transfer events from transaction logs */
  decodeUSDCLogs(
    logs: Array<{ address: string; topics: string[]; data: string }>
  ): Array<{ from: string; to: string; amount: bigint; token: string }> {
    const transferEvent =
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const transfers: Array<{
      from: string;
      to: string;
      amount: bigint;
      token: string;
    }> = [];

    for (const log of logs) {
      if (log.topics[0] === transferEvent && log.topics.length === 3) {
        const from = '0x' + log.topics[1].slice(26);
        const to = '0x' + log.topics[2].slice(26);
        const amount = BigInt('0x' + log.data.slice(2));
        transfers.push({ from, to, amount, token: log.address });
      }
    }
    return transfers;
  }

  /** Decode ERC-20 Approval events from transaction logs */
  decodeApprovalLogs(
    logs: Array<{ address: string; topics: string[]; data: string }>
  ): Array<{ owner: string; spender: string; amount: bigint }> {
    const approvalEvent =
      '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
    const approvals: Array<{
      owner: string;
      spender: string;
      amount: bigint;
    }> = [];

    for (const log of logs) {
      if (log.topics[0] === approvalEvent && log.topics.length === 3) {
        const owner = '0x' + log.topics[1].slice(26);
        const spender = '0x' + log.topics[2].slice(26);
        const amount = BigInt('0x' + log.data.slice(2));
        approvals.push({ owner, spender, amount });
      }
    }
    return approvals;
  }

  /** Decode ERC-1155 BatchTransfer events (used by CTF for outcome tokens) */
  decodeERC1155BatchTransferLogs(
    logs: Array<{ address: string; topics: string[]; data: string }>
  ): Array<{
    operator: string;
    from: string;
    to: string;
    tokenIds: bigint[];
    amounts: bigint[];
  }> {
    const batchTransferEvent =
      '0x2eb2dac2d097dd13a7dae6970a43cc4c23f6cb98493b16f5635b39955f48e2c5';
    const transfers: Array<{
      operator: string;
      from: string;
      to: string;
      tokenIds: bigint[];
      amounts: bigint[];
    }> = [];

    for (const log of logs) {
      if (log.topics[0] === batchTransferEvent && log.topics.length === 3) {
        const operator = '0x' + log.topics[1].slice(26);
        const from = '0x' + log.topics[2].slice(26);
        const to = '0x' + log.topics[3].slice(26);

        const data = log.data;
        const tokenIds: bigint[] = [];
        const amounts: bigint[] = [];

        for (let i = 2; i < data.length; i += 64) {
          const chunk = data.slice(i, i + 64);
          if (chunk.length === 64 && chunk !== '0'.repeat(64)) {
            tokenIds.push(BigInt('0x' + chunk));
          }
        }
        for (let i = 2 + tokenIds.length * 64; i < data.length; i += 64) {
          const chunk = data.slice(i, i + 64);
          if (chunk.length === 64 && chunk !== '0'.repeat(64)) {
            amounts.push(BigInt('0x' + chunk));
          }
        }

        transfers.push({ operator, from, to, tokenIds, amounts });
      }
    }
    return transfers;
  }

  async getBlockInfo(blockNumber: bigint): Promise<BlockInfo> {
    const block = await this.publicClient.getBlock({ blockNumber });
    return {
      number: block.number,
      timestamp: block.timestamp,
      hash: block.hash,
      transactions: block.transactions.length,
    };
  }

  async getCurrentBlock(): Promise<bigint> {
    return this.publicClient.getBlockNumber();
  }

  async getNativeBalance(address: string): Promise<bigint> {
    return this.publicClient.getBalance({
      address: address as `0x${string}`,
    });
  }

  async isContract(address: string): Promise<boolean> {
    const code = await this.publicClient.getCode({
      address: address as `0x${string}`,
    });
    return code !== undefined && code !== '0x';
  }

  async waitForConfirmation(
    txHash: Hex,
    confirmations: number = 1
  ): Promise<TracedTransaction> {
    await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations,
    });
    return this.traceTransaction(txHash);
  }

  async getGasPrice(): Promise<bigint> {
    return this.publicClient.getGasPrice();
  }

  async estimateGas(
    to: string,
    data?: Hex,
    from?: string
  ): Promise<bigint> {
    return this.publicClient.estimateGas({
      to: to as `0x${string}`,
      data,
      from: from ? (from as `0x${string}`) : undefined,
    });
  }

  async traceMultipleTransactions(
    txHashes: Hex[]
  ): Promise<TracedTransaction[]> {
    const results: TracedTransaction[] = [];
    for (const hash of txHashes) {
      try {
        results.push(await this.traceTransaction(hash));
      } catch (err) {
        this.logger.error('Failed to trace transaction:', { hash, error: err });
        results.push({
          hash,
          blockNumber: 0n,
          from: '',
          to: '',
          value: 0n,
          gas: 0n,
          gasPrice: 0n,
          status: 'reverted',
          logs: [],
          blockExplorerUrl: `${ChainConfig.polygon.blockExplorer}/tx/${hash}`,
        });
      }
    }
    return results;
  }
}
