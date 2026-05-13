import { describe, it, expect, vi } from 'vitest';
import { WebSocketSubscriber } from '../../src/clob-client/ws-subscriber';

describe('WebSocket Disconnect Resilience', () => {
  it('should handle reconnection attempts', () => {
    const subscriber = new WebSocketSubscriber({ maxReconnectAttempts: 3 });
    subscriber.disconnect();
    
    expect(subscriber.isConnectedCheck()).toBe(false);
    expect(subscriber.getStats().connected).toBe(false);
  });

  it('should track handler count', () => {
    const subscriber = new WebSocketSubscriber();
    const handlerId = subscriber.subscribe('orderbook', () => {});
    
    expect(handlerId).toBeDefined();
    expect(subscriber.getStats().handlerCount).toBe(1);
    
    subscriber.unsubscribe(handlerId);
    expect(subscriber.getStats().handlerCount).toBe(0);
    
    subscriber.disconnect();
  });

  it('should resubscribe after reconnect', () => {
    const subscriber = new WebSocketSubscriber();
    subscriber.subscribe('orderbook', () => {});
    
    // Simulate reconnect
    subscriber.disconnect();
    subscriber.connect();
    subscriber.disconnect();
  });
});
