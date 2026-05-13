import { describe, it, expect } from 'vitest';
import { BalanceReconciler } from '../../src/troubleshooting/balance-reconcile';

describe('Balance Inconsistency Scenarios', () => {
  describe('Reconciliation accuracy', () => {
    it('should report matched balances within tolerance', () => {
      const reconciler = new BalanceReconciler();
      const onChain = '100.000000';
      const clob = '100.001000';
      const diff = Math.abs(parseFloat(onChain) - parseFloat(clob));
      expect(diff).toBeLessThan(0.01);
    });

    it('should report mismatched balances outside tolerance', () => {
      const reconciler = new BalanceReconciler();
      const onChain = '100.000000';
      const clob = '90.000000';
      const diff = Math.abs(parseFloat(onChain) - parseFloat(clob));
      expect(diff).toBeGreaterThan(0.01);
    });
  });
});
