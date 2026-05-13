import pino from 'pino';
import { createPublicClient, http, type Hex } from 'viem';
import { polygon } from 'viem/chains';
import { ContractConfig, TokenConfig } from '../config';

const USDC_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
] as const;

const CTF_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }, { name: 'id', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
] as const;

export interface PositionSummary {
  address: string;
  usdc: { balance: string; token: string };
  ctfPositions: Array<{ tokenID: string; balance: string }>;
  totalMarkets: number;
  queriedAt: string;
  blockNumber: bigint;
}

export class PositionLookupCli {
  private logger: pino.Logger;
  private client: any;

  constructor() {
    this.logger = pino({ level: 'info' });
    this.client = createPublicClient({ chain: polygon, transport: http() });
  }

  async getPositionSummary(address: string, tokenIDs: string[]): Promise<PositionSummary> {
    this.logger.info('Looking up positions for:', address);

    const usdcBalance = await this.client.readContract({
      address: TokenConfig.USDCE,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });
    const decimals = await this.client.readContract({
      address: TokenConfig.USDCE,
      abi: USDC_ABI,
      functionName: 'decimals',
    });
    const usdcFormatted = Number(usdcBalance) / Math.pow(10, Number(decimals));

    const ctfPositions: Array<{ tokenID: string; balance: string }> = [];
    for (const tokenID of tokenIDs) {
      try {
        const balance = await this.client.readContract({
          address: ContractConfig.CTF,
          abi: CTF_ABI,
          functionName: 'balanceOf',
          args: [address as `0x${string}`, BigInt(tokenID)],
        });
        ctfPositions.push({
          tokenID,
          balance: Number(balance).toString(),
        });
      } catch {
        ctfPositions.push({ tokenID, balance: '0' });
      }
    }

    const blockNumber = await this.client.getBlockNumber();

    return {
      address,
      usdc: { balance: usdcFormatted.toFixed(6), token: TokenConfig.USDCE },
      ctfPositions,
      totalMarkets: ctfPositions.filter((p) => parseInt(p.balance) > 0).length,
      queriedAt: new Date().toISOString(),
      blockNumber,
    };
  }

  formatSummary(summary: PositionSummary): string {
    let output = '';
    output += `Position Summary for ${summary.address}\n`;
    output += `Queried at: ${summary.queriedAt} (Block: ${summary.blockNumber})\n\n`;
    output += `USDC.e Balance: ${summary.usdc.balance} (${summary.usdc.token})\n`;
    output += `Markets with positions: ${summary.totalMarkets}\n\n`;
    output += 'CTF Positions:\n';
    for (const pos of summary.ctfPositions) {
      const balanceNum = parseInt(pos.balance);
      const status = balanceNum > 0 ? `✓ ${pos.balance}` : 'empty';
      output += `  ${pos.tokenID.slice(0, 18)}... : ${status}\n`;
    }
    return output;
  }
}
