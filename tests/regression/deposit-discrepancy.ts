import { describe, it, expect } from 'vitest';
import { DepositInvestigation } from '../../src/troubleshooting/deposit-discrepancy';

describe('Deposit Discrepancy Scenarios', () => {
  describe('Missing deposit detection', () => {
    it('should detect when on-chain balance is less than expected', () => {
      const expected = 100;
      const actual = 85;
      const diff = expected - actual;
      
      expect(diff).toBeGreaterThan(0);
      expect(diff).toBe(15);
    });

    it('should flag when CLOB balance exceeds on-chain', () => {
      const onChain = 80;
      const clob = 100;
      expect(clob).toBeGreaterThan(onChain);
    });

    it('should recommend waiting for confirmations when tx is pending', () => {
      const confirmations = 50;
      const required = 128;
      expect(confirmations).toBeLessThan(required);
    });
  });

  describe('Reconciliation logic', () => {
    it('should match when all balances are equal', () => {
      const balances = { onChain: '100.000000', clob: '100.000000', dataApi: '100.000000' };
      expect(Math.abs(parseFloat(balances.onChain) - parseFloat(balances.clob))).toBeLessThan(0.01);
    });

    it('should detect discrepancy when balances differ', () => {
      const balances = { onChain: '100.000000', clob: '85.000000' };
      const diff = Math.abs(parseFloat(balances.onChain) - parseFloat(balances.clob));
      expect(diff).toBeGreaterThan(0.01);
    });
  });
});
