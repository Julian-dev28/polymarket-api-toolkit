import pino from 'pino';
import { createPublicClient, http, type Hex } from 'viem';
import { polygon } from 'viem/chains';
import { TokenConfig, ChainConfig } from '../config';

const USDC_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
] as const;

export interface DepositInvestigation {
  userAddress: string;
  expectedAmount: string;
  onChainBalance: string;
  clobBalance?: string;
  discrepancies: string[];
  txHashes: string[];
  lastDeposit?: { txHash: string; amount: string; timestamp: number; confirmed: boolean; confirmations: number };
  recommendations: string[];
}

export class DepositDiscrepancyTroubleshooter {
  private logger: pino.Logger;
  private rpcUrl: string;
  private USDCE: `0x${string}`;

  constructor(rpcUrl?: string) {
    this.logger = pino({ level: 'info' });
    this.rpcUrl = rpcUrl || ChainConfig.polygon.rpcUrl;
    this.USDCE = TokenConfig.USDCE as `0x${string}`;
  }

  async investigateDeposit(params: {
    userAddress: string;
    expectedAmount: string;
    clobBalance: string;
    txHash?: string;
  }): Promise<DepositInvestigation> {
    this.logger.info({ user: params.userAddress, expected: params.expectedAmount }, 'Investigating deposit');
    const client = createPublicClient({ chain: polygon, transport: http(this.rpcUrl) });

    const [balance, decimals] = await Promise.all([
      client.readContract({ address: this.USDCE, abi: USDC_ABI, functionName: 'balanceOf', args: [params.userAddress as `0x${string}`] }),
      client.readContract({ address: this.USDCE, abi: USDC_ABI, functionName: 'decimals' }),
    ]);

    const onChainBalance = Number(balance) / Math.pow(10, Number(decimals));
    const discrepancies: string[] = [];
    const recommendations: string[] = [];

    if (Math.abs(onChainBalance - parseFloat(params.expectedAmount)) > 0.01) {
      discrepancies.push(`On-chain balance (${onChainBalance.toFixed(6)} USDC) differs from expected (${params.expectedAmount} USDC)`);
    }
    if (Math.abs(onChainBalance - parseFloat(params.clobBalance)) > 0.01) {
      discrepancies.push(`On-chain (${onChainBalance.toFixed(6)} USDC) differs from CLOB (${params.clobBalance} USDC)`);
      recommendations.push('CLOB may not have processed on-chain settlement yet — wait for confirmations');
    }

    let lastDepositResult: { txHash: string; amount: string; timestamp: number; confirmed: boolean; confirmations: number } | undefined;
    if (params.txHash) {
      try {
        const [tx, receipt] = await Promise.all([
          client.getTransaction({ hash: params.txHash as Hex }),
          client.getTransactionReceipt({ hash: params.txHash as Hex }),
        ]);
        const currentBlock = await client.getBlockNumber();
        const confirmations = Number(currentBlock - receipt.blockNumber);

        lastDepositResult = {
          txHash: params.txHash,
          amount: (Number(tx.value) / 1e6).toString(),
          timestamp: 0,
          confirmed: receipt.status === 'success',
          confirmations,
        };

        if (!lastDepositResult.confirmed) {
          discrepancies.push('Transaction reverted on-chain');
          recommendations.push('Check tx on Polygonscan for revert reason');
        }
        if (confirmations < 128) {
          discrepancies.push(`Only ${confirmations} confirmations (need 128+ for Polygon bridge)`);
          recommendations.push('Wait for more confirmations before CLOB balance updates');
        }
      } catch {
        recommendations.push(`Tx hash ${params.txHash} not found on Polygon — verify correct chain`);
        discrepancies.push('Transaction not found on Polygon');
      }
    }

    return {
      userAddress: params.userAddress,
      expectedAmount: params.expectedAmount,
      onChainBalance: onChainBalance.toFixed(6),
      clobBalance: params.clobBalance,
      discrepancies,
      txHashes: params.txHash ? [params.txHash] : [],
      lastDeposit: lastDepositResult,
      recommendations,
    };
  }

  async batchCheck(users: Array<{ address: string; expectedAmount: string }>): Promise<Array<{
    address: string; expected: string; actual: string; matched: boolean;
  }>> {
    const client = createPublicClient({ chain: polygon, transport: http(this.rpcUrl) });
    const results = [];
    for (const user of users) {
      try {
        const [balance, decimals] = await Promise.all([
          client.readContract({ address: this.USDCE, abi: USDC_ABI, functionName: 'balanceOf', args: [user.address as `0x${string}`] }),
          client.readContract({ address: this.USDCE, abi: USDC_ABI, functionName: 'decimals' }),
        ]);
        const actual = (Number(balance) / Math.pow(10, Number(decimals))).toFixed(6);
        results.push({ address: user.address, expected: user.expectedAmount, actual, matched: Math.abs(parseFloat(actual) - parseFloat(user.expectedAmount)) < 0.01 });
      } catch {
        results.push({ address: user.address, expected: user.expectedAmount, actual: 'error', matched: false });
      }
    }
    return results;
  }
}
