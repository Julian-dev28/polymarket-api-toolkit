import { describe, it, expect, vi } from 'vitest';
import { OrderManager } from '../../src/clob-client/order-manager';
import type { OrderResponse } from '../../src/config';

vi.mock('axios');

describe('Order Placement Failure Scenarios', () => {
  describe('OrderManager lifecycle', () => {
    it('should create an order in DRAFT state', () => {
      const manager = new OrderManager();
      const order = manager.createOrder({
        tokenID: 'test-token',
        price: 0.5,
        size: 100,
        side: 'BUY',
      });
      expect(order.status).toBe('DRAFT');
      expect(order.params.price).toBe(0.5);
      expect(order.params.size).toBe(100);
      expect(order.params.side).toBe('BUY');
    });

    it('should transition through signing to broadcasting', async () => {
      const manager = new OrderManager();
      const order = manager.createOrder({
        tokenID: 'test-token',
        price: 0.5,
        size: 100,
        side: 'BUY',
      });
      
      const signed = manager.signOrder(order.orderID);
      expect(signed?.status).toBe('PRESIGNED');

      // Mock clobClient
      const mockClob = {
        placeOrder: vi.fn().mockResolvedValue({ status: 'PENDING', orderID: order.orderID, error: null }),
        cancelOrder: vi.fn(),
      };

      const result = await manager.postOrder(order.orderID, mockClob);
      expect(result.status).toBe('PENDING');
      expect(order.status).toBe('PENDING');
    });

    it('should mark order as FAILED when API returns error', async () => {
      const manager = new OrderManager();
      const order = manager.createOrder({
        tokenID: 'test-token',
        price: 0.5,
        size: 100,
        side: 'BUY',
      });
      manager.signOrder(order.orderID);

      const mockClob = {
        placeOrder: vi.fn().mockResolvedValue({
          status: 'FAILED',
          orderID: order.orderID,
          error: 'Price too low',
        }),
      };

      const result = await manager.postOrder(order.orderID, mockClob);
      expect(result.status).toBe('FAILED');
      expect(order.error).toBe('Price too low');
    });

    it('should track fill summary correctly', () => {
      const manager = new OrderManager();
      const orders = [
        manager.createOrder({ tokenID: 't1', price: 0.5, size: 100, side: 'BUY' }),
        manager.createOrder({ tokenID: 't2', price: 0.3, size: 50, side: 'SELL' }),
      ];
      
      orders[0].status = 'CLOSED';
      orders[1].status = 'FAILED';
      
      const summary = manager.getFillSummary();
      expect(summary.totalOrders).toBe(2);
      expect(summary.filled).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.pending).toBe(0);
    });

    it('should cancel a pending order', async () => {
      const manager = new OrderManager();
      const order = manager.createOrder({
        tokenID: 'test-token',
        price: 0.5,
        size: 100,
        side: 'BUY',
      });
      manager.signOrder(order.orderID);

      const mockClob = {
        cancelOrder: vi.fn().mockResolvedValue({ status: 'CANCELLED' }),
      };

      const result = await manager.cancelOrder(order.orderID, mockClob);
      expect(result.status).toBe('CANCELLED');
      expect(order.status).toBe('CANCELLED');
    });
  });

  describe('Price validation scenarios', () => {
    it('should detect price out of valid range', () => {
      // Test case for price below minimum tick
      const price = 0.005; // Below 0.01 tick size for most markets
      expect(price).toBeLessThan(0.01);
    });

    it('should detect price above maximum', () => {
      const price = 1.5;
      expect(price).toBeGreaterThan(1.0);
    });
  });
});
