import pino from 'pino';

export type Severity = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
export type TicketCategory =
  | 'api_failure'
  | 'order_issue'
  | 'deposit_problem'
  | 'balance_discrepancy'
  | 'position_issue'
  | 'sdk_error'
  | 'ws_disconnect'
  | 'on_chain_issue'
  | 'integration_failure'
  | 'performance_issue'
  | 'other';
export type TicketStatus =
  | 'NEW'
  | 'TRIAGED'
  | 'IN_PROGRESS'
  | 'PENDING_USER'
  | 'RESOLVED'
  | 'CLOSED';

export type ApiRequest = { method: string; url: string; headers?: Record<string, string>; body?: unknown };
export type ApiResponse = { status: number; data: unknown; timestamp: string };

export interface EvidenceCollection {
  apiRequests?: ApiRequest[];
  apiResponses?: ApiResponse[];
  errorLogs?: string[];
  txHashes?: string[];
  screenshots?: string[];
  timestamps?: string[];
  orderIds?: string[];
  userAddresses?: string[];
  walletInfo?: { address: string; chain?: string };
}

export interface BugReport {
  id: string;
  title: string;
  severity: Severity;
  category: TicketCategory;
  user: string | null;
  description: string;
  stepsToReproduce: string[];
  expectedBehavior: string;
  actualBehavior: string;
  evidence: EvidenceCollection;
  rootCauseAnalysis: string | null;
  affectedSystems: string[];
  workaround: string | null;
  status: TicketStatus;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolution: string | null;
  linkedTickets: string[];
  internalNotes: Array<{ author: string; note: string; timestamp: string }>;
}

export class TicketGenerator {
  private logger: pino.Logger;

  constructor(logger?: pino.Logger) {
    this.logger = logger || pino({ level: 'info' });
  }

  /** Generate a structured bug report from error details */
  generateTicket(params: {
    title: string;
    category: TicketCategory;
    severity?: Severity;
    description: string;
    stepsToReproduce: string[];
    expectedBehavior: string;
    actualBehavior: string;
    evidence?: EvidenceCollection;
    user?: string | null;
    affectedSystems?: string[];
    workaround?: string | null;
  }): BugReport {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const ticket: BugReport = {
      id,
      title: params.title,
      severity: params.severity || this.defaultSeverity(params.category),
      category: params.category,
      user: params.user ?? null,
      description: params.description,
      stepsToReproduce: params.stepsToReproduce,
      expectedBehavior: params.expectedBehavior,
      actualBehavior: params.actualBehavior,
      evidence: params.evidence || {},
      rootCauseAnalysis: null,
      affectedSystems: params.affectedSystems || [params.category],
      workaround: params.workaround ?? null,
      status: 'NEW',
      assignedTo: null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      resolution: null,
      linkedTickets: [],
      internalNotes: [],
    };

    this.logger.info({ id, title: ticket.title, severity: ticket.severity }, 'Generated escalation ticket');
    return ticket;
  }

  /** Auto-detect severity from error codes */
  detectSeverityFromError(errorMessage: string): Severity {
    const lower = errorMessage.toLowerCase();

    if (
      lower.includes('timeout') ||
      lower.includes('rate limit') ||
      lower.includes('rate_limited')
    ) {
      return 'P2';
    }
    if (
      lower.includes('insufficient') ||
      lower.includes('rejected') ||
      lower.includes('blocked')
    ) {
      return 'P1';
    }
    if (
      lower.includes('service unavailable') ||
      lower.includes('503') ||
      lower.includes('502') ||
      lower.includes('fatal')
    ) {
      return 'P0';
    }
    if (
      lower.includes('invalid') ||
      lower.includes('price too') ||
      lower.includes('tick size')
    ) {
      return 'P3';
    }
    return 'P4';
  }

  /** Generate a Jira-ready markdown report */
  toMarkdown(report: BugReport): string {
    const md = [
      `# ${report.title}`,
      '',
      `**ID:** \`${report.id}\``,
      `**Severity:** ${report.severity}`,
      `**Category:** ${report.category}`,
      `**Status:** ${report.status}`,
      report.user ? `**User:** ${report.user}` : '',
      '',
      '## Description',
      '',
      report.description,
      '',
      '## Steps to Reproduce',
      '',
      ...report.stepsToReproduce.map((step, i) => `${i + 1}. ${step}`),
      '',
      '## Expected Behavior',
      '',
      report.expectedBehavior,
      '',
      '## Actual Behavior',
      '',
      report.actualBehavior,
      '',
      report.rootCauseAnalysis
        ? `## Root Cause Analysis\n\n${report.rootCauseAnalysis}\n`
        : '',
      report.workaround ? `## Workaround\n\n${report.workaround}\n` : '',
      '',
      '## Evidence',
      '',
      ...this.evidenceToMarkdown(report.evidence),
      '',
      '## Affected Systems',
      '',
      ...report.affectedSystems.map((s) => `- ${s}`),
      '',
      '---',
      `*Generated: ${report.createdAt}*`,
    ].filter(Boolean);

    return md.join('\n');
  }

  /** Generate a JSON report for programmatic consumption */
  toJson(report: BugReport): string {
    return JSON.stringify(report, null, 2);
  }

  /** Generate a structured bug report from a CLOB API error */
  fromApiError(params: {
    title: string;
    apiError: unknown;
    request: unknown;
    response?: unknown;
    userId?: string;
  }): BugReport {
    const error = params.apiError as Record<string, unknown>;
    const request = params.request as Record<string, unknown>;
    const response = params.response as Record<string, unknown>;
    const severity = this.detectSeverityFromError(
      (error as any).message || (error as any) as string || String(error)
    );

    const ticket = this.generateTicket({
      title: params.title,
      category: 'api_failure',
      severity,
      description: `API request failed: ${(error as any).message || (error as any) as string || 'Unknown error'}`,
      stepsToReproduce: [
        'Send request to Polymarket CLOB/Data API',
        'Receive error response',
      ],
      expectedBehavior: 'Successful API response with expected data',
      actualBehavior: `${(error as any).message || (error as any) as string || 'Unknown error'}`,
      user: params.userId || null,
      affectedSystems: ['CLOB API', 'Data API'],
      evidence: {
        apiRequests: [
          {
            method: (request as any).method || 'GET',
            url: (request as any).url || '',
            headers: (request as any).headers,
            body: (request as any).body,
          },
        ],
        apiResponses: [
          {
            status: (response as any)?.status || (error as any).status || 0,
            data: (response as any)?.data || error,
            timestamp: new Date().toISOString(),
          },
        ],
        errorLogs: [
          (error as any).message || String(error),
        ],
      },
    });

    return ticket;
  }

  /** Generate a bug report from a failed order */
  fromFailedOrder(params: {
    orderId: string;
    orderParams: Record<string, unknown>;
    error: Error;
    userId?: string;
  }): BugReport {
    return this.generateTicket({
      title: `Order ${params.orderId} failed: ${params.error.message || String(params.error) || 'Unknown'}`,
      category: 'order_issue',
      severity: 'P1',
      description: `Order placement failed for token ${params.orderParams.tokenID}`,
      stepsToReproduce: [
        `Call placeOrder with tokenID=${params.orderParams.tokenID}`,
        `Price: ${params.orderParams.price}, Side: ${params.orderParams.side}, Size: ${params.orderParams.size}`,
        'Receive error response',
      ],
      expectedBehavior: 'Order accepted and broadcasted successfully',
      actualBehavior: `${params.error.message || String(params.error) || 'Unknown error'}`,
      user: params.userId || null,
      affectedSystems: ['CLOB API', 'Order Matching Engine'],
      evidence: {
        apiRequests: [
          {
            method: 'POST',
            url: '/orders',
            body: params.orderParams,
          },
        ],
        apiResponses: [
          {
            status: 0,
            data: params.error,
            timestamp: new Date().toISOString(),
          },
        ],
        orderIds: [params.orderId],
        errorLogs: [JSON.stringify(params.error, null, 2)],
      },
    });
  }

  /** Generate a bug report from a deposit discrepancy */
  fromDepositDiscrepancy(params: {
    userAddress: string;
    expectedAmount: string;
    actualAmount: string;
    txHash?: string;
    chain?: string;
  }): BugReport {
    return this.generateTicket({
      title: `Deposit discrepancy for ${params.userAddress}: expected ${params.expectedAmount} USDC, got ${params.actualAmount}`,
      category: 'deposit_problem',
      severity: 'P1',
      description: `User ${params.userAddress} expected to receive ${params.expectedAmount} USDC but account shows ${params.actualAmount}`,
      stepsToReproduce: [
        `User initiates deposit of ${params.expectedAmount} USDC`,
        `Transaction hash: ${params.txHash || 'N/A'}`,
        `Expected balance after deposit: ${params.expectedAmount}`,
        'Check Polymarket account balance',
        `Actual balance: ${params.actualAmount}`,
      ],
      expectedBehavior: `User balance should reflect ${params.expectedAmount} USDC deposit`,
      actualBehavior: `User balance shows ${params.actualAmount} USDC`,
      user: params.userAddress,
      affectedSystems: ['Bridge', 'Polygon RPC', 'Account Service'],
      workaround: 'User can check status on polygon explorer',
      evidence: {
        txHashes: params.txHash ? [params.txHash] : [],
        walletInfo: {
          address: params.userAddress,
          chain: params.chain || 'polygon',
        },
      },
    });
  }

  /** Generate a bug report from a WebSocket disconnect */
  fromWSDisconnect(params: {
    tokenID: string;
    disconnectCount: number;
    lastErrorMessage?: string;
    userId?: string;
  }): BugReport {
    return this.generateTicket({
      title: `WebSocket disconnected ${params.disconnectCount}x for token ${params.tokenID}`,
      category: 'ws_disconnect',
      severity: 'P2',
      description: `WebSocket connection has disconnected ${params.disconnectCount} times for token ${params.tokenID}${params.lastErrorMessage ? ': ' + params.lastErrorMessage : ''}`,
      stepsToReproduce: [
        'Connect to WebSocket',
        'Subscribe to orderbook/trades for token',
        `Disconnected ${params.disconnectCount} times`,
      ],
      expectedBehavior: 'Stable WebSocket connection with automatic reconnection',
      actualBehavior: `Connection unstable, ${params.disconnectCount} disconnects${params.lastErrorMessage ? ': ' + params.lastErrorMessage : ''}`,
      user: params.userId || null,
      affectedSystems: ['WebSocket Service', 'CLOB API'],
    });
  }

  /** Generate a bug report from a balance discrepancy */
  fromBalanceDiscrepancy(params: {
    address: string;
    clobBalance: string;
    onChainBalance: string;
    txHash?: string;
  }): BugReport {
    return this.generateTicket({
      title: `Balance discrepancy: CLOB shows ${params.clobBalance} USDC, on-chain shows ${params.onChainBalance} USDC`,
      category: 'balance_discrepancy',
      severity: 'P1',
      description: `Address ${params.address} has different balances between CLOB and on-chain`,
      stepsToReproduce: [
        'Check CLOB balance via API',
        `CLOB shows ${params.clobBalance} USDC`,
        'Check on-chain balance via Polygon RPC',
        `On-chain shows ${params.onChainBalance} USDC`,
      ],
      expectedBehavior: 'CLOB and on-chain balances should match',
      actualBehavior: `CLOB: ${params.clobBalance}, On-chain: ${params.onChainBalance}`,
      user: params.address,
      affectedSystems: ['CLOB', 'Polygon RPC', 'USDC Contract'],
      evidence: {
        txHashes: params.txHash ? [params.txHash] : [],
        walletInfo: { address: params.address },
      },
    });
  }

  private defaultSeverity(category: TicketCategory): Severity {
    const severityMap: Record<TicketCategory, Severity> = {
      api_failure: 'P2',
      order_issue: 'P1',
      deposit_problem: 'P1',
      balance_discrepancy: 'P1',
      position_issue: 'P2',
      sdk_error: 'P3',
      ws_disconnect: 'P2',
      on_chain_issue: 'P1',
      integration_failure: 'P2',
      performance_issue: 'P3',
      other: 'P4',
    };
    return severityMap[category];
  }

  private evidenceToMarkdown(evidence: EvidenceCollection): string[] {
    const lines: string[] = [];

    if (evidence.apiRequests?.length) {
      lines.push('### API Requests');
      lines.push('');
      for (const req of evidence.apiRequests) {
        lines.push(`- **${req.method}** \`${req.url}\``);
        if (req.body) lines.push(`  Body: \`${JSON.stringify(req.body)}\``);
      }
      lines.push('');
    }

    if (evidence.apiResponses?.length) {
      lines.push('### API Responses');
      lines.push('');
      for (const res of evidence.apiResponses) {
        lines.push(`- Status: ${res.status} | ${new Date(res.timestamp).toISOString()}`);
        lines.push(`  Response: \`${JSON.stringify(res.data).slice(0, 200)}\``);
      }
      lines.push('');
    }

    if (evidence.errorLogs?.length) {
      lines.push('### Error Logs');
      lines.push('');
      lines.push('```');
      lines.push(...evidence.errorLogs);
      lines.push('```');
      lines.push('');
    }

    if (evidence.txHashes?.length) {
      lines.push('### Transaction Hashes');
      lines.push('');
      for (const hash of evidence.txHashes) {
        lines.push(`- \`${hash.slice(0, 20)}...\` [Polygonscan](https://polygonscan.com/tx/${hash})`);
      }
      lines.push('');
    }

    if (evidence.orderIds?.length) {
      lines.push('### Order IDs');
      lines.push('');
      for (const id of evidence.orderIds) {
        lines.push(`- \`${id}\``);
      }
      lines.push('');
    }

    if (evidence.walletInfo) {
      lines.push('### Wallet Info');
      lines.push('');
      lines.push(`- Address: \`${evidence.walletInfo.address}\``);
      if (evidence.walletInfo.chain) lines.push(`- Chain: ${evidence.walletInfo.chain}`);
      lines.push('');
    }

    return lines;
  }

  /** Update ticket with root cause analysis */
  updateRootCause(report: BugReport, analysis: string): BugReport {
    report.rootCauseAnalysis = analysis;
    report.updatedAt = new Date().toISOString();
    return report;
  }

  /** Update ticket status */
  updateStatus(report: BugReport, status: TicketStatus): BugReport {
    report.status = status;
    report.updatedAt = new Date().toISOString();
    if (status === 'RESOLVED' || status === 'CLOSED') {
      report.resolvedAt = new Date().toISOString();
    }
    return report;
  }

  /** Add internal note */
  addNote(report: BugReport, author: string, note: string): BugReport {
    report.internalNotes.push({
      author,
      note,
      timestamp: new Date().toISOString(),
    });
    report.updatedAt = new Date().toISOString();
    return report;
  }
}
