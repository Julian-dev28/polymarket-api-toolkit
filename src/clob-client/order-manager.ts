import type { OrderResponse, OrderSide } from '../config';

export interface OrderParams {
  tokenID: string;
  price: number;
  size: number;
  side: OrderSide;
  nonce?: number;
  orderType?: 'GTC' | 'GTD' | 'FOK' | 'FAK';
  startTime?: number;
  endTime?: number;
}

export interface OrderState {
  orderID: string;
  params: OrderParams;
  status: 'DRAFT' | 'PRESIGNED' | 'SIGNING' | 'BROADCASTING' | 'PENDING' | 'SETTLED' | 'CLOSED' | 'FAILED' | 'CANCELLED' | 'EARLY_CANCELLED';
  createdAt: number;
  updatedAt: number;
  filledSize?: number;
  remainingSize?: number;
  error?: string;
}

export class OrderManager {
  private orders: Map<string, OrderState> = new Map();

  createOrder(params: OrderParams): OrderState {
    const order: OrderState = {
      orderID: crypto.randomUUID(),
      params,
      status: 'DRAFT',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      remainingSize: params.size,
    };
    this.orders.set(order.orderID, order);
    return order;
  }

  signOrder(orderId: string): OrderState | undefined {
    const order = this.orders.get(orderId);
    if (!order) return undefined;
    order.status = 'PRESIGNED';
    order.updatedAt = Date.now();
    return order;
  }

  async postOrder(orderId: string, clobClient: any): Promise<OrderResponse> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status !== 'PRESIGNED') throw new Error(`Order ${orderId} is not signed`);
    
    order.status = 'BROADCASTING';
    order.updatedAt = Date.now();

    try {
      const response = await clobClient.placeOrder({
        tokenID: order.params.tokenID,
        price: order.params.price,
        size: order.params.size,
        side: order.params.side,
        nonce: order.params.nonce || Math.floor(Date.now() / 1000),
      });

      order.status = response.status as any;
      order.updatedAt = Date.now();
      
      if (response.status === 'FAILED' || response.error) {
        order.error = response.error || 'Order failed';
      }
      
      return response;
    } catch (err) {
      order.status = 'FAILED';
      order.error = err instanceof Error ? err.message : 'Unknown error';
      order.updatedAt = Date.now();
      throw err;
    }
  }

  async cancelOrder(orderId: string, clobClient: any): Promise<{ status: string }> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    try {
      const response = await clobClient.cancelOrder(orderId);
      order.status = 'CANCELLED';
      order.updatedAt = Date.now();
      return response;
    } catch (err) {
      order.status = 'FAILED';
      order.updatedAt = Date.now();
      throw err;
    }
  }

  async cancelAllOrders(clobClient: any): Promise<{ cancelledOrders: string[] }> {
    const pendingOrders = Array.from(this.orders.values())
      .filter((o) => o.status === 'PENDING' || o.status === 'SETTLED');
    
    const cancelled: string[] = [];
    for (const order of pendingOrders) {
      try {
        await this.cancelOrder(order.orderID, clobClient);
        cancelled.push(order.orderID);
      } catch {
        // Continue cancelling others
      }
    }
    return { cancelledOrders: cancelled };
  }

  getOrder(orderId: string): OrderState | undefined {
    return this.orders.get(orderId);
  }

  getAllOrders(status?: string): OrderState[] {
    if (status) {
      return Array.from(this.orders.values()).filter((o) => o.status === status);
    }
    return Array.from(this.orders.values());
  }

  getOpenOrders(): OrderState[] {
    return this.getAllOrders().filter(
      (o) => ['PENDING', 'SETTLED', 'BROADCASTING'].includes(o.status)
    );
  }

  getOrdersByToken(tokenID: string): OrderState[] {
    return Array.from(this.orders.values()).filter(
      (o) => o.params.tokenID === tokenID
    );
  }

  getOrdersBySide(side: OrderSide): OrderState[] {
    return Array.from(this.orders.values()).filter(
      (o) => o.params.side === side
    );
  }

  getFillSummary(): { totalOrders: number; filled: number; failed: number; pending: number; cancelled: number } {
    const orders = Array.from(this.orders.values());
    return {
      totalOrders: orders.length,
      filled: orders.filter((o) => o.status === 'CLOSED').length,
      failed: orders.filter((o) => o.status === 'FAILED').length,
      pending: orders.filter((o) => ['PENDING', 'SETTLED'].includes(o.status)).length,
      cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
    };
  }

  clearCompleted(): void {
    for (const [id, order] of this.orders) {
      if (['CLOSED', 'CANCELLED', 'FAILED'].includes(order.status)) {
        this.orders.delete(id);
      }
    }
  }
}
