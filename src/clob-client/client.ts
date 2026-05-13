import axios, { AxiosInstance, AxiosError } from 'axios';
import { PolymarketEndpoints, ClobConfig, ApiErrorCodes } from '../config';
import type { OrderbookSnapshot, Trade, Candle, MidpriceResponse, SpreadResponse, OrderResponse } from '../config';
import pino from 'pino';

export class ClobClient {
  private http: AxiosInstance;
  private logger: pino.Logger = pino({ level: 'info' });

  private apiKey?: string;
  private apiSecret?: string;
  private passphrase?: string;
  private nonce?: string;

  constructor(config?: { apiKey?: string; apiSecret?: string; passphrase?: string }) {
    this.apiKey = config?.apiKey;
    this.apiSecret = config?.apiSecret;
    this.passphrase = config?.passphrase;

    this.http = axios.create({
      baseURL: PolymarketEndpoints.CLOB.baseUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.logger = pino({
      level: 'info',
      transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.http.interceptors.request.use(async (config) => {
      // Sign authenticated requests with HMAC-SHA256
      if (this.apiKey && config.url && !config.url.includes('/health')) {
        try {
          this.nonce = await this.fetchNonce();
          const timestamp = new Date().toISOString();
          const method = config.method?.toUpperCase() || 'GET';
          const path = config.url;
          const body = config.data ? JSON.stringify(config.data) : '';
          
          const message = `${method}${path}${timestamp}${this.nonce}${body}`;
          const crypto = await import('crypto');
          const hmac = crypto.createHmac('sha256', this.apiSecret!);
          const signature = hmac.update(message).digest('hex');

          config.headers['X-CLOB-APIKEY'] = this.apiKey;
          config.headers['X-CLOB-TIMESTAMP'] = timestamp;
          config.headers['X-CLOB-SIGN'] = signature;
          if (this.passphrase) {
            config.headers['X-CLOB-PASSPHRASE'] = this.passphrase;
          }
        } catch (err) {
          this.logger.warn({ err: String(err) }, 'Failed to sign request');
        }
      }
      return config;
    });

    this.http.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const apiError = this.classifyApiError(error);
        this.logger.error({
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method,
          code: apiError.code,
          message: apiError.message,
        }, 'CLOB API error');
        return Promise.reject(apiError);
      },
    );
  }

  private async fetchNonce(): Promise<string> {
    const res = await this.http.get<string>(PolymarketEndpoints.CLOB.nonce);
    return String(res.data);
  }

  private classifyApiError(error: AxiosError): { code: string; message: string } {
    const status = error.response?.status;
    const data = error.response?.data as any;
    const message = data?.err || data?.error || error.message || '';

    if (status === 401) return { code: ApiErrorCodes.INVALID_API_CREDS, message: 'Invalid API credentials' };
    if (status === 403) return { code: ApiErrorCodes.BLOCKED_MARKET, message: 'Market blocked' };
    if (status === 422 && message.includes('price')) return { code: ApiErrorCodes.PRICE_TOO_LOW, message: 'Price out of valid range' };
    if (status === 422 && message.includes('size')) return { code: ApiErrorCodes.MIN_SIZE_VIOLATION, message: 'Size below minimum' };
    if (status === 422 && message.includes('notional')) return { code: ApiErrorCodes.MIN_NOTIONAL_VIOLATION, message: 'Notional below minimum' };
    if (status === 422 && message.includes('fee')) return { code: ApiErrorCodes.TICK_SIZE_VIOLATION, message: 'Fee calculation error' };
    if (status === 429) return { code: ApiErrorCodes.RATE_LIMITED, message: 'Rate limited' };
    if (status === 503) return { code: ApiErrorCodes.SERVICE_UNAVAILABLE, message: 'Service unavailable' };
    if (error.code === 'ECONNABORTED') return { code: ApiErrorCodes.TIMEOUT, message: 'Request timeout' };
    if (!error.response) return { code: ApiErrorCodes.WALLET_DISCONNECTED, message: 'Network error' };
    
    return { code: ApiErrorCodes.FEED_ERROR, message: message || `HTTP ${status}` };
  }

  // ── Market Data (Public - no auth required) ──────────────

  async getMidprice(tokenID: string): Promise<MidpriceResponse> {
    const res = await this.http.get(PolymarketEndpoints.CLOB.midPrice(tokenID));
    return MidpriceResponseSchema.parse(res.data);
  }

  async getSpread(tokenID: string): Promise<SpreadResponse> {
    const res = await this.http.get(PolymarketEndpoints.CLOB.spread(tokenID));
    return SpreadResponseSchema.parse(res.data);
  }

  async getOrderbook(tokenID: string): Promise<OrderbookSnapshot> {
    const res = await this.http.get(PolymarketEndpoints.CLOB.orderbook(tokenID));
    return OrderbookSnapshotSchema.parse(res.data);
  }

  async getAllOrderbooks(): Promise<Record<string, OrderbookSnapshot>> {
    const res = await this.http.get(PolymarketEndpoints.CLOB.orderbookAll);
    return res.data as Record<string, OrderbookSnapshot>;
  }

  async getCandles(tokenID: string, timeframe?: string): Promise<Candle[]> {
    const url = timeframe 
      ? `${PolymarketEndpoints.CLOB.candles(tokenID)}&timeframe=${timeframe}`
      : PolymarketEndpoints.CLOB.candles(tokenID);
    const res = await this.http.get(url);
    return res.data.map((c: any) => CandleSchema.parse(c));
  }

  async getTrades(tokenID?: string, opts?: { sortBy?: string; order?: 'asc' | 'desc'; cursor?: string; limit?: number }): Promise<Trade[]> {
    let url = PolymarketEndpoints.CLOB.trades(
      tokenID, opts?.sortBy, opts?.order, opts?.cursor, opts?.limit
    );
    const res = await this.http.get(url);
    return (res.data as any[]).map((t: any) => TradeSchema.parse(t));
  }

  async getLastTradePrice(tokenID: string): Promise<string> {
    const res = await this.http.get(PolymarketEndpoints.CLOB.lastTradePrice(tokenID));
    return res.data.price;
  }

  async getTickSize(tokenID: string): Promise<string> {
    const res = await this.http.get(PolymarketEndpoints.CLOB.tickSize(tokenID));
    return res.data.tick_size;
  }

  async isNegRisk(tokenID: string): Promise<boolean> {
    const res = await this.http.get(PolymarketEndpoints.CLOB.negRisk(tokenID));
    return res.data.neg_risk;
  }

  async getFee(tokenID: string): Promise<string> {
    const res = await this.http.get(PolymarketEndpoints.CLOB.fee(tokenID));
    return res.data.fee;
  }

  async getRiskLimits(tokenID: string): Promise<any> {
    const res = await this.http.get(PolymarketEndpoints.CLOB.riskLimits(tokenID));
    return res.data;
  }

  // ── Trading Operations (Authenticated) ───────────────────

  async placeOrder(order: {
    tokenID: string;
    price: number;
    size: number;
    side: 'BUY' | 'SELL';
    nonce?: number;
  }): Promise<OrderResponse> {
    const res = await this.http.post('/orders', order);
    return OrderResponseSchema.parse(res.data);
  }

  async cancelOrder(orderID: string): Promise<{ status: string }> {
    const res = await this.http.delete(`/orders/${orderID}`);
    return res.data;
  }

  async cancelAllOrders(): Promise<{ status: string; cancelledOrders: string[] }> {
    const res = await this.http.delete('/orders');
    return res.data;
  }

  async getOrders(status?: string, cursor?: string, limit?: number): Promise<any[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', String(limit));
    const res = await this.http.get(`/orders?${params.toString()}`);
    return res.data;
  }

  async getOpenOrders(): Promise<any[]> {
    return this.getOrders('PENDING');
  }

  async getOrderHistory(opts?: { status?: string; cursor?: string; limit?: number }): Promise<any[]> {
    return this.getOrders(opts?.status, opts?.cursor, opts?.limit);
  }

  // ── Health & Utility ─────────────────────────────────────

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const res = await this.http.get(PolymarketEndpoints.CLOB.health);
    return res.data;
  }

  async getServerInfo(): Promise<any> {
    const res = await this.http.get(PolymarketEndpoints.CLOB.servers);
    return res.data;
  }

  /** Execute a request with automatic retry on transient errors */
  async withRetry<T>(fn: () => Promise<T>, maxRetries: number = ClobConfig.maxRetries): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const code = (err as any)?.code;
        if (code === ApiErrorCodes.RATE_LIMITED || code === ApiErrorCodes.SERVICE_UNAVAILABLE) {
          const delay = ClobConfig.retryDelayMs * Math.pow(2, i);
          this.logger.warn(`Retrying in ${delay}ms (attempt ${i + 1}/${maxRetries})...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        // Non-retryable errors
        break;
      }
    }
    throw lastError;
  }
}

// ── Data API Client (read-only, no auth needed) ────────────

export class DataApiClient {
  private http: AxiosInstance;
  constructor() {
    this.http = axios.create({
      baseURL: PolymarketEndpoints.DATA.baseUrl,
      timeout: 30000,
    });
  }

  async getEvents(): Promise<any[]> {
    const res = await this.http.get(PolymarketEndpoints.DATA.events);
    return res.data;
  }

  async getEvent(id: string): Promise<any> {
    const res = await this.http.get(PolymarketEndpoints.DATA.event(id));
    return res.data;
  }

  async getMarkets(opts?: { status?: string; cursor?: string; limit?: number }): Promise<any[]> {
    const params = new URLSearchParams();
    if (opts?.status) params.set('status', opts.status);
    if (opts?.cursor) params.set('cursor', opts.cursor);
    if (opts?.limit) params.set('limit', String(opts.limit));
    const res = await this.http.get(`${PolymarketEndpoints.DATA.markets}?${params.toString()}`);
    return res.data;
  }

  async getMarket(id: string): Promise<any> {
    const res = await this.http.get(PolymarketEndpoints.DATA.market(id));
    return res.data;
  }

  async getPositions(user: string): Promise<any[]> {
    const res = await this.http.get(PolymarketEndpoints.DATA.positions(user));
    return res.data;
  }

  async getTrades(opts?: { user?: string; market?: string; cursor?: string; limit?: number }): Promise<any[]> {
    const params = new URLSearchParams();
    if (opts?.user) params.set('user', opts.user);
    if (opts?.market) params.set('market', opts.market);
    if (opts?.cursor) params.set('cursor', opts.cursor);
    if (opts?.limit) params.set('limit', String(opts.limit));
    const res = await this.http.get(`${PolymarketEndpoints.DATA.trades()}?${params.toString()}`);
    return res.data;
  }

  async getHolderData(market: string): Promise<any> {
    const res = await this.http.get(PolymarketEndpoints.DATA.holderData(market));
    return res.data;
  }

  async getOpenInterest(market: string): Promise<any> {
    const res = await this.http.get(PolymarketEndpoints.DATA.openInterest(market));
    return res.data;
  }

  async getLeaderboard(opts?: { days?: number }): Promise<any[]> {
    const params = new URLSearchParams();
    if (opts?.days) params.set('days', String(opts.days));
    const res = await this.http.get(`${PolymarketEndpoints.DATA.leaderboard}?${params.toString()}`);
    return res.data;
  }

  async getBuilderAnalytics(opts?: { builder?: string; days?: number }): Promise<any> {
    const params = new URLSearchParams();
    if (opts?.builder) params.set('builder', opts.builder);
    if (opts?.days) params.set('days', String(opts.days));
    const res = await this.http.get(`${PolymarketEndpoints.DATA.builderAnalytics}?${params.toString()}`);
    return res.data;
  }

  async builderActivity(builder: string): Promise<any[]> {
    const res = await this.http.get(PolymarketEndpoints.DATA.builderActivity(builder));
    return res.data;
  }

  async healthCheck(): Promise<any> {
    const res = await this.http.get(`${PolymarketEndpoints.DATA.baseUrl}/health`);
    return res.data;
  }
}

// ── Gamma API Client (market discovery, conditions, resolution) ─

export class GammaApiClient {
  private http: AxiosInstance;
  constructor() {
    this.http = axios.create({
      baseURL: PolymarketEndpoints.GAMMA.baseUrl,
      timeout: 30000,
    });
  }

  async getEvents(status?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const res = await this.http.get(`${PolymarketEndpoints.GAMMA.events}?${params.toString()}`);
    return res.data;
  }

  async getEvent(id: string): Promise<any> {
    const res = await this.http.get(PolymarketEndpoints.GAMMA.event(id));
    return res.data;
  }

  async getMarkets(opts?: { status?: string; event?: string; cursor?: string; limit?: number }): Promise<any[]> {
    const params = new URLSearchParams();
    if (opts?.status) params.set('status', opts.status);
    if (opts?.event) params.set('event', opts.event);
    if (opts?.cursor) params.set('cursor', opts.cursor);
    if (opts?.limit) params.set('limit', String(opts.limit));
    const res = await this.http.get(`${PolymarketEndpoints.GAMMA.markets}?${params.toString()}`);
    return res.data;
  }

  async getMarket(id: string): Promise<any> {
    const res = await this.http.get(PolymarketEndpoints.GAMMA.market(id));
    return res.data;
  }

  async getConditions(): Promise<any[]> {
    const res = await this.http.get(PolymarketEndpoints.GAMMA.conditions);
    return res.data;
  }

  async getCondition(id: string): Promise<any> {
    const res = await this.http.get(PolymarketEndpoints.GAMMA.condition(id));
    return res.data;
  }

  async getConditionOutcomes(conditionId: string): Promise<any[]> {
    const res = await this.http.get(PolymarketEndpoints.GAMMA.outcomes(conditionId));
    return res.data;
  }

  async getConditionTokens(conditionId: string): Promise<any[]> {
    const res = await this.http.get(PolymarketEndpoints.GAMMA.tokens(conditionId));
    return res.data;
  }

  async getMarketResolver(marketId: string): Promise<any> {
    const res = await this.http.get(PolymarketEndpoints.GAMMA.resolver(marketId));
    return res.data;
  }

  async getActivity(opts?: { market?: string; limit?: number }): Promise<any[]> {
    const params = new URLSearchParams();
    if (opts?.market) params.set('market', opts.market);
    if (opts?.limit) params.set('limit', String(opts.limit));
    const res = await this.http.get(`${PolymarketEndpoints.GAMMA.activity}?${params.toString()}`);
    return res.data;
  }

  /** Resolve a market by checking its resolver contract and block number */
  async checkMarketResolution(marketId: string): Promise<{ resolved: boolean; winner?: string; blockNumber?: number }> {
    const market = await this.getMarket(marketId);
    const resolverAddress = market?.resolver;
    if (!resolverAddress) return { resolved: false };
    
    // Check if resolver has set the result
    return { resolved: true, winner: market?.result, blockNumber: market?.blockNumber };
  }
}

// ── WebSocket Client (real-time orderbook + trade streaming) ─

export class ClobWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private onMessageHandlers: Map<string, (data: any) => void> = new Map();
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private logger: pino.Logger = pino({ level: 'info' });

  private isConnected = false;

  constructor(url?: string, options?: { reconnectInterval?: number; maxAttempts?: number }) {
    this.url = url || `${PolymarketEndpoints.WS.baseUrl}/ws`;
    this.reconnectInterval = options?.reconnectInterval || ClobConfig.wsReconnectIntervalMs;
    this.maxReconnectAttempts = options?.maxAttempts || ClobConfig.wsMaxReconnectAttempts;
    this.logger = pino({ level: 'info' });
    this.connect();
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.logger.info('WebSocket connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Route to appropriate handler
          const type = data.type || data.event || 'unknown';
          const handler = this.onMessageHandlers.get(type);
          if (handler) handler(data);
        } catch (err) {
          this.logger.error({ err: String(err) }, 'Failed to parse WS message');
        }
      };

      this.ws.onerror = (error) => {
        this.logger.error({ error: String(error) }, 'WebSocket error');
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.logger.warn(`WebSocket closed (code: ${event.code})`);
        this.attemptReconnect();
      };
    } catch (err) {
      this.logger.error({ err: String(err) }, 'Failed to create WebSocket');
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      return;
    }
    this.reconnectAttempts++;
    this.logger.info(`Reconnecting in ${this.reconnectInterval}ms (attempt ${this.reconnectAttempts})...`);
    this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectInterval);
  }

  public subscribeOrderbook(tokenID: string, handler: (data: any) => void): void {
    // Subscribe to specific orderbook channel
    const message = JSON.stringify({
      type: 'subscribe',
      channel: 'orderbook',
      markets: [tokenID],
    });
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
      this.onMessageHandlers.set(`orderbook:${tokenID}`, handler);
    }
  }

  public subscribeTrades(tokenID: string, handler: (data: any) => void): void {
    const message = JSON.stringify({
      type: 'subscribe',
      channel: 'trades',
      markets: [tokenID],
    });
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
      this.onMessageHandlers.set(`trades:${tokenID}`, handler);
    }
  }

  public subscribeAllOrderbooks(handler: (data: any) => void): void {
    const message = JSON.stringify({ type: 'subscribe', channel: 'orderbook', markets: 'all' });
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }
    this.onMessageHandlers.set('orderbook:all', handler);
  }

  public unsubscribe(handlerKey: string): void {
    this.onMessageHandlers.delete(handlerKey);
  }

  public isConnectedCheck(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  public send(data: any): void {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.onMessageHandlers.clear();
  }
}

// Schema imports for zod parsing
import { CandleSchema, MidpriceResponseSchema, SpreadResponseSchema, OrderbookSnapshotSchema, TradeSchema, OrderResponseSchema } from '../config/schemas';
