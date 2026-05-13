import pino from 'pino';
import { createPublicClient, http } from 'viem';
import { polygon } from 'viem/chains';
import { TokenConfig, ChainConfig } from '../config';

const USDC_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
] as const;

export interface BalanceReconciliation {
  address: string;
  onChainUSDC: { raw: string; formatted: string; blockNumber: bigint };
  clobBalance: { raw: string; formatted: string; source: string } | null;
  dataApiBalance: { raw: string; formatted: string; source: string } | null;
  discrepancy: string | null;
  matched: boolean;
  recommendations: string[];
}

export class BalanceReconciler {
  private logger: pino.Logger;
  private rpcUrl: string;
  private USDCE: `0x${string}`;

  constructor(rpcUrl?: string) {
    this.logger = pino({ level: 'info' });
    this.rpcUrl = rpcUrl || ChainConfig.polygon.rpcUrl;
    this.USDCE = TokenConfig.USDCE as `0x${string}`;
  }

  async reconcile(params: {
    address: string;
    clobBalance?: string;
    dataApiBalance?: string;
  }): Promise<BalanceReconciliation> {
    this.logger.info({ address: params.address }, 'Reconciling balances');
    const client = createPublicClient({ chain: polygon, transport: http(this.rpcUrl) });

    const [balance, decimals, blockNumber] = await Promise.all([
      client.readContract({ address: this.USDCE, abi: USDC_ABI, functionName: 'balanceOf', args: [params.address as `0x${string}`] }),
      client.readContract({ address: this.USDCE, abi: USDC_ABI, functionName: 'decimals' }),
      client.getBlockNumber(),
    ]);

    const onChainRaw = balance.toString();
    const onChainFormatted = (Number(balance) / Math.pow(10, Number(decimals))).toFixed(6);
    const recommendations: string[] = [];
    let discrepancy: string | null = null;

    if (params.clobBalance) {
      const diff = Math.abs(parseFloat(onChainFormatted) - parseFloat(params.clobBalance));
      if (diff > 0.01) {
        discrepancy = `On-chain: ${onChainFormatted} vs CLOB: ${params.clobBalance} (diff: ${diff.toFixed(6)})`;
        recommendations.push('CLOB may not have processed on-chain settlement yet');
        recommendations.push('Check transaction confirmation count on Polygonscan');
      }
    }

    if (params.dataApiBalance) {
      const diff = Math.abs(parseFloat(onChainFormatted) - parseFloat(params.dataApiBalance));
      if (diff > 0.01) {
        if (!discrepancy) discrepancy = `On-chain: ${onChainFormatted} vs Data API: ${params.dataApiBalance} (diff: ${diff.toFixed(6)})`;
        recommendations.push('Data API may be caching stale data');
      }
    }

    return {
      address: params.address,
      onChainUSDC: { raw: onChainRaw, formatted: onChainFormatted, blockNumber },
      clobBalance: params.clobBalance ? { raw: params.clobBalance, formatted: parseFloat(params.clobBalance).toFixed(6), source: 'CLOB API' } : null,
      dataApiBalance: params.dataApiBalance ? { raw: params.dataApiBalance, formatted: parseFloat(params.dataApiBalance).toFixed(6), source: 'Data API' } : null,
      discrepancy,
      matched: !discrepancy,
      recommendations,
    };
  }

  async quickCheck(address: string): Promise<{ usdc: string; blockNumber: bigint; isUSDCE: boolean }> {
    const client = createPublicClient({ chain: polygon, transport: http(this.rpcUrl) });
    const [balance, decimals, blockNumber] = await Promise.all([
      client.readContract({ address: this.USDCE, abi: USDC_ABI, functionName: 'balanceOf', args: [address as `0x${string}`] }),
      client.readContract({ address: this.USDCE, abi: USDC_ABI, functionName: 'decimals' }),
      client.getBlockNumber(),
    ]);
    return {
      usdc: (Number(balance) / Math.pow(10, Number(decimals))).toFixed(6),
      blockNumber,
      isUSDCE: this.USDCE === '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as `0x${string}`,
    };
  }
}
