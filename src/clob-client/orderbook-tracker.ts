import type { OrderbookEntry } from '../config';

export interface OrderbookLevel {
  price: number;
  size: number;
  orderCount: number;
  orders: Array<{ orderID: string; side: string }>;
}

export interface OrderbookDiff {
  action: 'add' | 'remove';
  price: string;
  size: string;
}

export class OrderbookTracker {
  private bids: Map<string, OrderbookEntry> = new Map();
  private asks: Map<string, OrderbookEntry> = new Map();
  private previousSnapshot: { bids: Map<string, OrderbookEntry>; asks: Map<string, OrderbookEntry> } | null = null;
  private onSnapshotCallback: ((snapshot: any) => void) | null = null;
  private onDiffCallback: ((diff: OrderbookDiff) => void) | null = null;

  update(snapshot: any): void {
    this.previousSnapshot = {
      bids: new Map(this.bids),
      asks: new Map(this.asks),
    };

    this.bids.clear();
    this.asks.clear();

    for (const entry of snapshot.bids || []) {
      this.bids.set(entry.price, entry);
    }
    for (const entry of snapshot.asks || []) {
      this.asks.set(entry.price, entry);
    }

    if (this.onSnapshotCallback) {
      this.onSnapshotCallback(this.getSnapshot());
    }
  }

  applyDiff(diffs: { bids?: OrderbookDiff[]; asks?: OrderbookDiff[] }): void {
    this.previousSnapshot = {
      bids: new Map(this.bids),
      asks: new Map(this.asks),
    };

    if (diffs.bids) {
      for (const diff of diffs.bids) {
        if (diff.action === 'remove') {
          this.bids.delete(diff.price);
        } else {
          this.bids.set(diff.price, {
            price: diff.price,
            size: 0,
            orders: [],
          } as OrderbookEntry);
        }
      }
    }

    if (diffs.asks) {
      for (const diff of diffs.asks) {
        if (diff.action === 'remove') {
          this.asks.delete(diff.price);
        } else {
          this.asks.set(diff.price, {
            price: diff.price,
            size: 0,
            orders: [],
          } as OrderbookEntry);
        }
      }
    }

    if (this.onDiffCallback) {
      this.onDiffCallback(diffs.asks?.[0] || diffs.bids?.[0] || { action: 'update' } as any);
    }
  }

  getSnapshot(): any {
    return {
      bids: this.aggregateLevels(Array.from(this.bids.values())),
      asks: this.aggregateLevels(Array.from(this.asks.values())),
      timestamp: new Date().toISOString(),
    };
  }

  getMidprice(): number | null {
    const bestBid = this.bids.size > 0 ? Math.max(...Array.from(this.bids.values()).map((e) => parseFloat(e.price))) : 0;
    const bestAsk = this.asks.size > 0 ? Math.min(...Array.from(this.asks.values()).map((e) => parseFloat(e.price))) : 0;
    if (bestBid === 0 || bestAsk === 0) return null;
    return (bestBid + bestAsk) / 2;
  }

  getSpread(): { absolute: number; percent: number } | null {
    const mid = this.getMidprice();
    if (!mid) return null;
    const bestBid = Math.max(...Array.from(this.bids.values()).map((e) => parseFloat(e.price)));
    const bestAsk = Math.min(...Array.from(this.asks.values()).map((e) => parseFloat(e.price)));
    return {
      absolute: bestAsk - bestBid,
      percent: ((bestAsk - bestBid) / mid) * 100,
    };
  }

  getOrderbookDepth(): { bidDepth: number; askDepth: number; bidNotional: number; askNotional: number } {
    let bidDepth = 0;
    let askDepth = 0;
    for (const entry of this.bids.values()) {
      bidDepth += parseFloat(entry.size);
      bidNotional += parseFloat(entry.size) * parseFloat(entry.price);
    }
    for (const entry of this.asks.values()) {
      askDepth += parseFloat(entry.size);
      askNotional += parseFloat(entry.size) * parseFloat(entry.price);
    }
    return {
      bidDepth,
      askDepth,
      bidNotional,
      askNotional,
    };
  }

  private aggregateLevels(entries: OrderbookEntry[]): OrderbookLevel[] {
    const aggregated: OrderbookLevel[] = [];
    for (const entry of entries) {
      aggregated.push({
        price: parseFloat(entry.price),
        size: parseFloat(entry.size),
        orderCount: entry.orders?.length || 0,
        orders: (entry.orders || []).map((o: any) => ({
          orderID: o.orderID,
          side: o.side,
        })),
      });
    }
    return aggregated;
  }

  getBestBid(): OrderbookEntry | undefined {
    if (this.bids.size === 0) return undefined;
    return Array.from(this.bids.values()).reduce((max, e) => 
      parseFloat(e.price) > parseFloat(max.price) ? e : max
    );
  }

  getBestAsk(): OrderbookEntry | undefined {
    if (this.asks.size === 0) return undefined;
    return Array.from(this.asks.values()).reduce((min, e) =>
      parseFloat(e.price) < parseFloat(min.price) ? e : min
    );
  }

  onSnapshot(callback: (snapshot: any) => void): void {
    this.onSnapshotCallback = callback;
  }

  onDiff(callback: (diff: OrderbookDiff) => void): void {
    this.onDiffCallback = callback;
  }

  clear(): void {
    this.bids.clear();
    this.asks.clear();
    this.previousSnapshot = null;
  }
}
