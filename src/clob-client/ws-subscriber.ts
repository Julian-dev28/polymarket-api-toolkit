import pino from 'pino';
import { PolymarketEndpoints, ClobConfig } from '../config';

interface WsMessageHandler {
  channel: string;
  callback: (data: any) => void;
}

export class WebSocketSubscriber {
  private ws: WebSocket | null = null;
  private handlers: WsMessageHandler[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private logger: pino.Logger;
  private isConnected = false;
  private url: string;
  private maxReconnectAttempts: number;
  private reconnectInterval: number;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options?: {
    url?: string;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
  }) {
    this.url = options?.url || `${PolymarketEndpoints.WS.baseUrl}/ws`;
    this.maxReconnectAttempts = options?.maxReconnectAttempts || ClobConfig.wsMaxReconnectAttempts;
    this.reconnectInterval = options?.reconnectInterval || ClobConfig.wsReconnectIntervalMs;
    this.logger = pino({ level: 'info' });
    this.connect();
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.url);
      this.logger.info('Attempting WebSocket connection...');

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.logger.info('WebSocket connected successfully');
        this.startHealthCheck();
        this.resubscribeAll();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        this.logger.error({ error: String(error) }, 'WebSocket error');
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.stopHealthCheck();
        this.logger.warn({ code: event.code, reason: event.reason }, 'WebSocket closed');
        this.attemptReconnect();
      };
    } catch (err) {
      this.logger.error({ err: String(err) }, 'Failed to create WebSocket');
      this.attemptReconnect();
    }
  }

  private handleMessage(raw: string): void {
    try {
      const data = JSON.parse(raw);
      const type = data.type || data.event || 'unknown';

      this.logger.debug({ type, channel: data.channel }, 'WS message received');

      for (const handler of this.handlers) {
        // Match exact channel or all
        if (handler.channel === type || handler.channel === 'all') {
          try {
            handler.callback(data);
          } catch (err) {
            this.logger.error({ err: String(err) }, 'Handler error');
          }
        }
      }
    } catch (err) {
      this.logger.error({ err: String(err) }, 'Failed to parse WS message');
    }
  }

  private resubscribeAll(): void {
    // Re-subscribe to all channels after reconnect
    const channels = new Set(this.handlers.map((h) => h.channel));
    for (const channel of channels) {
      this.resubscribeChannel(channel);
    }
  }

  private resubscribeChannel(channel: string): void {
    if (!this.isConnected || !this.ws) return;

    const message = JSON.stringify({
      type: 'subscribe',
      channel: channel,
    });
    this.ws.send(message);
    this.logger.info(`Resubscribed to ${channel}`);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached. Giving up.');
      return;
    }
    this.reconnectAttempts++;
    this.logger.info(`Reconnecting in ${this.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectInterval);
  }

  public subscribe(channel: string, callback: (data: any) => void): string {
    const handlerId = crypto.randomUUID();
    this.handlers.push({ channel, callback });

    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.resubscribeChannel(channel);
    }

    return handlerId;
  }

  public unsubscribe(_handlerId: string): void {
    this.handlers = this.handlers.filter((h) => h.callback !== undefined);
  }

  public unsubscribeAll(): void {
    this.handlers = [];
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  public send(data: any): void {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public isConnectedCheck(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  public getStats(): { handlerCount: number; reconnectAttempts: number; connected: boolean } {
    return {
      handlerCount: this.handlers.length,
      reconnectAttempts: this.reconnectAttempts,
      connected: this.isConnected,
    };
  }

  public disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHealthCheck();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.handlers = [];
    this.logger.info('WebSocket disconnected');
  }
}
