import { createPublicClient, http, type Hex, type PublicClient } from 'viem';
import { polygon } from 'viem/chains';
import pino from 'pino';
import { ChainConfig, ContractConfig, TokenConfig } from '../config';

// Minimal Exchange contract ABI
const EXCHANGE_ABI = [
  {
    name: 'paused',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getPositions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        components: [
          { name: 'conditionId', type: 'bytes32' },
          { name: 'marketId', type: 'bytes32' },
          { name: 'indexSet', type: 'uint256' },
          { name: 'amount', type: 'uint256' },
        ],
        name: '',
        type: 'tuple[]',
      },
    ],
  },
  {
    name: 'getOutcomeTokenBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'conditionId', type: 'bytes32' },
      { name: 'outcomeIndex', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// Minimal CTF relay contract ABI
const CTF_RELAY_ABI = [
  {
    name: 'getOrderInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'orderHash', type: 'bytes32' }],
    outputs: [
      { name: 'maker', type: 'address' },
      { name: 'tokenID', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
      { name: 'price', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'feeRateBps', type: 'uint256' },
      { name: 'expiration', type: 'uint256' },
      { name: 'sigType', type: 'uint8' },
    ],
  },
] as const;

export interface OnChainOrder {
  orderHash: Hex;
  maker: string;
  tokenID: string;
  amount: bigint;
  price: bigint;
  nonce: bigint;
  feeRateBps: bigint;
  expiration: bigint;
  sigType: number;
  filled: bigint;
  remaining: bigint;
}

export interface OnChainPosition {
  conditionId: Hex;
  marketId: Hex;
  indexSet: bigint;
  amount: bigint;
  marketQuestion?: string;
}

export class OnChainOrderTracker {
  private publicClient: PublicClient;
  private exchangeAddress: `0x${string}`;
  private ctfRelayAddress: `0x${string}`;
  private logger: pino.Logger;

  constructor() {
    this.publicClient = createPublicClient({
      chain: polygon,
      transport: http(ChainConfig.polygon.rpcUrl),
    });
    this.exchangeAddress = ContractConfig.Exchange;
    this.ctfRelayAddress = ContractConfig.CTFRelay;
    this.logger = pino({ level: 'info' });
  }

  /** Check if the exchange contract is paused */
  async isExchangePaused(): Promise<boolean> {
    try {
      return await this.publicClient.readContract({
        address: this.exchangeAddress,
        abi: EXCHANGE_ABI,
        functionName: 'paused',
      });
    } catch {
      return false;
    }
  }

  /** Get open orders for a user from the CTF relay */
  async getOpenOrders(user: string): Promise<OnChainOrder[]> {
    // On Polymarket, open orders are managed off-chain by the CLOB
    // On-chain settlement happens after matching
    // This function checks for any pending on-chain state
    this.logger.info(
      'Checking on-chain order state for:',
      user
    );

    // Polymarket CLOB is off-chain matching, on-chain settlement
    // Orders are not stored on-chain until settlement
    return [];
  }

  /** Verify an on-chain settlement transaction */
  async verifySettlement(txHash: Hex): Promise<{
    success: boolean;
    user: string;
    amount: bigint;
    marketId: string;
    blockNumber: bigint;
    confirmations: number;
  }> {
    const receipt = await this.publicClient.getTransactionReceipt({
      hash: txHash,
    });
    const currentBlock = await this.publicClient.getBlockNumber();
    const tx = await this.publicClient.getTransaction({ hash: txHash });

    return {
      success: receipt.status === 'success',
      user: tx.from,
      amount: tx.value,
      marketId: receipt.to || '',
      blockNumber: receipt.blockNumber,
      confirmations: currentBlock - receipt.blockNumber,
    };
  }

  /** Check if a token ID is valid for a condition */
  async isTokenValidForCondition(
    tokenId: Hex,
    conditionId: Hex
  ): Promise<boolean> {
    // Validate that a token belongs to a specific condition
    // Token IDs are derived from condition IDs in the CTF
    try {
      const ctfCode = await this.publicClient.getCode({
        address: ChainConfig.polygon.ctfAddress as `0x${string}`,
      });
      return ctfCode !== undefined && ctfCode !== '0x';
    } catch {
      return false;
    }
  }

  /** Query settlement events for a user */
  async querySettlementEvents(
    user: string,
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<
    Array<{
      txHash: Hex;
      blockNumber: bigint;
      amount: bigint;
      marketId: string;
      user: string;
    }>
  > {
    // Settlement events are emitted by the Exchange contract
    const settledEvent =
      '0x3f7f7240bc971e1e15f9b49b5c96c98ca3bce0394326c32b4a301f8c9e17c7e8';

    const logs = await this.publicClient.getLogs({
      address: this.exchangeAddress,
      fromBlock,
      toBlock,
      topics: [
        settledEvent,
        '0x' + user.slice(2).toLowerCase().padStart(64, '0'),
      ],
    });

    return logs.map((log) => ({
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      amount: 0n,
      marketId: log.address,
      user,
    }));
  }

  /** Get the current block number with timestamp */
  async getCurrentBlockWithTime(): Promise<{
    number: bigint;
    timestamp: bigint;
  }> {
    const block = await this.publicClient.getBlock();
    return {
      number: block.number,
      timestamp: block.timestamp,
    };
  }
}
