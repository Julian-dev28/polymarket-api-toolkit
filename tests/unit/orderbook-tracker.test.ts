import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { OrderbookTracker } from '../../src/clob-client/orderbook-tracker';
import type { OrderbookEntry } from '../../src/config';
import type { OrderbookDiff } from '../../src/clob-client/orderbook-tracker';

describe('OrderbookTracker', () => {
  let tracker: OrderbookTracker;

  beforeEach(() => {
    tracker = new OrderbookTracker();
  });

  // ---- updateOrderbook ----
  describe('updateOrderbook', () => {
    it('should apply a snapshot with bids and asks', () => {
      const snapshot = {
        bids: [
          { price: '0.60', size: '100', orders: [{ orderID: 'o1', side: 'BUY' }] },
          { price: '0.55', size: '200', orders: [] },
        ] as OrderbookEntry[],
        asks: [
          { price: '0.70', size: '150', orders: [] },
          { price: '0.75', size: '300', orders: [] },
        ] as OrderbookEntry[],
      };
      tracker.update(snapshot);
      expect(tracker.getBestBid()?.price).toBe('0.60');
      expect(tracker.getBestAsk()?.price).toBe('0.70');
      expect(tracker.getSnapshot().bids.length).toBe(2);
      expect(tracker.getSnapshot().asks.length).toBe(2);
    });

    it('should clear previous state on new snapshot', () => {
      tracker.update({
        bids: [{ price: '0.60', size: '100', orders: [] }],
        asks: [{ price: '0.70', size: '150', orders: [] }],
      } as any);
      tracker.update({
        bids: [],
        asks: [],
      } as any);
      expect(tracker.getBestBid()).toBeUndefined();
      expect(tracker.getBestAsk()).toBeUndefined();
    });

    it('should trigger onSnapshot callback', () => {
      const callback = vi.fn();
      tracker.onSnapshot(callback);
      tracker.update({ bids: [], asks: [] } as any);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0]).toHaveProperty('timestamp');
      expect(callback.mock.calls[0][0]).toHaveProperty('bids');
      expect(callback.mock.calls[0][0]).toHaveProperty('asks');
    });

    it('should handle missing bids/asks gracefully', () => {
      tracker.update({ asks: [] } as any);
      expect(tracker.getBestBid()).toBeUndefined();
    });

    it('should handle completely empty snapshot', () => {
      tracker.update({} as any);
      expect(tracker.getBestBid()).toBeUndefined();
      expect(tracker.getBestAsk()).toBeUndefined();
    });
  });

  // ---- applyDiff ----
  describe('applyDiff', () => {
    it('should add a bid via diff', () => {
      tracker.update({
        bids: [{ price: '0.60', size: '100', orders: [] }],
        asks: [],
      } as any);
      tracker.applyDiff({
        bids: [{ action: 'add', price: '0.65', size: '50' }],
      });
      expect(tracker.getBestBid()?.price).toBe('0.65');
    });

    it('should remove a bid via diff', () => {
      tracker.update({
        bids: [
          { price: '0.60', size: '100', orders: [] },
          { price: '0.55', size: '200', orders: [] },
        ],
        asks: [],
      } as any);
      tracker.applyDiff({
        bids: [{ action: 'remove', price: '0.60', size: '0' }],
      });
      expect(tracker.getBestBid()?.price).toBe('0.55');
    });

    it('should handle ask diffs', () => {
      tracker.update({
        bids: [],
        asks: [{ price: '0.70', size: '150', orders: [] }],
      } as any);
      tracker.applyDiff({
        asks: [{ action: 'remove', price: '0.70', size: '0' }],
      });
      expect(tracker.getBestAsk()).toBeUndefined();
    });

    it('should trigger onDiff callback', () => {
      const callback = vi.fn();
      tracker.onDiff(callback);
      tracker.applyDiff({ bids: [{ action: 'add', price: '0.65', size: '50' }] });
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  // ---- getMidprice ----
  describe('getMidprice', () => {
    it('should calculate midprice correctly', () => {
      tracker.update({
        bids: [{ price: '0.60', size: '100', orders: [] }],
        asks: [{ price: '0.80', size: '100', orders: [] }],
      } as any);
      expect(tracker.getMidprice()).toBeCloseTo(0.70, 5);
    });

    it('should return null with empty book', () => {
      expect(tracker.getMidprice()).toBeNull();
    });

    it('should return null with only bids', () => {
      tracker.update({
        bids: [{ price: '0.60', size: '100', orders: [] }],
        asks: [],
      } as any);
      expect(tracker.getMidprice()).toBeNull();
    });

    it('should return null with only asks', () => {
      tracker.update({
        bids: [],
        asks: [{ price: '0.70', size: '100', orders: [] }],
      } as any);
      expect(tracker.getMidprice()).toBeNull();
    });
  });

  // ---- getSpread ----
  describe('getSpread', () => {
    it('should calculate absolute and percent spread', () => {
      tracker.update({
        bids: [{ price: '0.60', size: '100', orders: [] }],
        asks: [{ price: '0.80', size: '100', orders: [] }],
      } as any);
      const spread = tracker.getSpread();
      expect(spread).not.toBeNull();
      expect(spread!.absolute).toBeCloseTo(0.20, 5);
      // percent = (0.20 / 0.70) * 100 = 28.57...
      expect(spread!.percent).toBeCloseTo(28.57143, 2);
    });

    it('should return null with empty book', () => {
      expect(tracker.getSpread()).toBeNull();
    });

    it('should handle zero-spread (bestBid === bestAsk)', () => {
      tracker.update({
        bids: [{ price: '0.50', size: '100', orders: [] }],
        asks: [{ price: '0.50', size: '100', orders: [] }],
      } as any);
      const spread = tracker.getSpread();
      expect(spread).not.toBeNull();
      expect(spread!.absolute).toBeCloseTo(0, 5);
      expect(spread!.percent).toBeCloseTo(0, 5);
    });
  });

  // ---- getOrderbookDepth ----
  describe('getOrderbookDepth', () => {
    it('should calculate depth and notional', () => {
      tracker.update({
        bids: [
          { price: '0.60', size: '100', orders: [] },
          { price: '0.50', size: '200', orders: [] },
        ],
        asks: [
          { price: '0.70', size: '150', orders: [] },
          { price: '0.80', size: '50', orders: [] },
        ],
      } as any);
      const depth = tracker.getOrderbookDepth();
      expect(depth.bidDepth).toBeCloseTo(300, 5);
      expect(depth.bidNotional).toBeCloseTo(160, 5); // 0.60*100 + 0.50*200 = 60+100 = 160
      expect(depth.askDepth).toBeCloseTo(200, 5);
      expect(depth.askNotional).toBeCloseTo(145, 5); // 0.70*150 + 0.80*50 = 105+40 = 145
    });

    it('should handle empty book', () => {
      const depth = tracker.getOrderbookDepth();
      expect(depth.bidDepth).toBe(0);
      expect(depth.askDepth).toBe(0);
      expect(depth.bidNotional).toBe(0);
      expect(depth.askNotional).toBe(0);
    });
  });

  // ---- getBestBid / getBestAsk ----
  describe('getBestBid / getBestAsk', () => {
    it('should return highest bid price', () => {
      tracker.update({
        bids: [
          { price: '0.50', size: '100', orders: [] },
          { price: '0.60', size: '100', orders: [] },
          { price: '0.55', size: '100', orders: [] },
        ],
        asks: [],
      } as any);
      const bestBid = tracker.getBestBid();
      expect(bestBid?.price).toBe('0.60');
    });

    it('should return lowest ask price', () => {
      tracker.update({
        bids: [],
        asks: [
          { price: '0.80', size: '100', orders: [] },
          { price: '0.70', size: '100', orders: [] },
          { price: '0.75', size: '100', orders: [] },
        ],
      } as any);
      const bestAsk = tracker.getBestAsk();
      expect(bestAsk?.price).toBe('0.70');
    });

    it('should return undefined for empty sides', () => {
      tracker.update({ bids: [], asks: [] } as any);
      expect(tracker.getBestBid()).toBeUndefined();
      expect(tracker.getBestAsk()).toBeUndefined();
    });
  });

  // ---- getSnapshot ----
  describe('getSnapshot', () => {
    it('should return aggregated snapshot', () => {
      tracker.update({
        bids: [{ price: '0.60', size: '100', orders: [{ orderID: 'o1', side: 'BUY' }] }],
        asks: [{ price: '0.70', size: '150', orders: [{ orderID: 'o2', side: 'SELL' }, { orderID: 'o3', side: 'SELL' }] }],
      } as any);
      const snap = tracker.getSnapshot();
      expect(snap.bids).toHaveLength(1);
      expect(snap.asks).toHaveLength(1);
      expect(snap.bids[0].price).toBe(0.6);
      expect(snap.bids[0].size).toBe(100);
      expect(snap.bids[0].orderCount).toBe(1);
      expect(snap.asks[0].orderCount).toBe(2);
      expect(typeof snap.timestamp).toBe('string');
    });
  });

  // ---- onSnapshot / onDiff callbacks ----
  describe('onSnapshot / onDiff callbacks', () => {
    it('should allow registering snapshot callback', () => {
      const cb = vi.fn();
      tracker.onSnapshot(cb);
      expect(tracker).toBeDefined();
    });

    it('should allow registering diff callback', () => {
      const cb = vi.fn();
      tracker.onDiff(cb);
      expect(tracker).toBeDefined();
    });
  });

  // ---- clear ----
  describe('clear', () => {
    it('should remove all bids and asks', () => {
      tracker.update({
        bids: [{ price: '0.60', size: '100', orders: [] }],
        asks: [{ price: '0.70', size: '150', orders: [] }],
      } as any);
      tracker.clear();
      expect(tracker.getBestBid()).toBeUndefined();
      expect(tracker.getBestAsk()).toBeUndefined();
    });
  });
});
