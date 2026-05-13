import pino from 'pino';
import type { EscalationTicket } from '../config';

export interface IncidentData {
  id: string;
  title: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  description: string;
  startedAt: string;
  detectedBy: string;
  affectedUsers: number;
  affectedSystems: string[];
  affectedMarkets?: string[];
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'closed';
}

export class IncidentCommunicator {
  private logger: pino.Logger;

  constructor(logger?: pino.Logger) {
    this.logger = logger || pino({ level: 'info' });
  }

  /** Draft a customer-facing incident notification */
  draftIncidentNotification(incident: IncidentData, template: 'email' | 'dashboard' | 'status_page'): string {
    const templates: Record<string, (i: IncidentData) => string> = {
      email: this.emailTemplate,
      dashboard: this.dashboardTemplate,
      status_page: this.statusPageTemplate,
    };
    return templates[template](incident);
  }

  /** Draft an update during incident investigation */
  draftIncidentUpdate(incident: IncidentData, update: string): string {
    return [
      `## Incident Update: ${incident.title}`,
      '',
      `**Time:** ${new Date().toISOString()}`,
      `**Severity:** ${incident.severity}`,
      `**Status:** ${incident.status}`,
      '',
      update,
      '',
      'We will provide the next update as soon as more information is available.',
    ].join('\n');
  }

  /** Draft a resolution notice */
  draftResolutionNotice(incident: IncidentData, resolution: string): string {
    return [
      `## Incident Resolved: ${incident.title}`,
      '',
      `**Started:** ${incident.startedAt}`,
      `**Resolved:** ${new Date().toISOString()}`,
      `**Severity:** ${incident.severity}`,
      `**Affected Users:** ~${incident.affectedUsers}`,
      '',
      `**Resolution:** ${resolution}`,
      '',
      'We apologize for any inconvenience this may have caused.',
      '',
      'If you experienced any issues not covered above, please contact support with your wallet address.',
    ].join('\n');
  }

  /** Calculate impact metrics for an incident */
  calculateImpact(incident: IncidentData, totalActiveUsers: number): {
    userPercentage: string;
    marketPercentage?: string;
    severityLabel: string;
    communicationFrequency: 'every_5_min' | 'every_15_min' | 'every_30_min' | 'hourly';
  } {
    const userPercentage = ((incident.affectedUsers / totalActiveUsers) * 100).toFixed(2);
    let severityLabel: string;
    let communicationFrequency: 'every_5_min' | 'every_15_min' | 'every_30_min' | 'hourly';

    switch (incident.severity) {
      case 'P0':
        severityLabel = 'Critical — System-wide outage';
        communicationFrequency = 'every_5_min';
        break;
      case 'P1':
        severityLabel = 'High — Significant impact on major users';
        communicationFrequency = 'every_15_min';
        break;
      case 'P2':
        severityLabel = 'Medium — Affects a subset of users';
        communicationFrequency = 'every_30_min';
        break;
      case 'P3':
        severityLabel = 'Low — Minor issue';
        communicationFrequency = 'hourly';
        break;
      default:
        severityLabel = 'Informational';
        communicationFrequency = 'hourly';
    }

    let marketPercentage: string | undefined;
    if (incident.affectedMarkets?.length) {
      marketPercentage = `${incident.affectedMarkets.length} markets affected`;
    }

    return {
      userPercentage,
      marketPercentage,
      severityLabel,
      communicationFrequency,
    };
  }

  /** Draft a post-incident report */
  draftPostIncidentReport(incident: IncidentData, rootCause: string, lessonsLearned: string[]): string {
    return [
      `# Post-Incident Report: ${incident.title}`,
      '',
      `**Report Date:** ${new Date().toISOString()}`,
      `**Incident ID:** ${incident.id}`,
      `**Duration:** ${incident.startedAt} → ${new Date().toISOString()}`,
      `**Severity:** ${incident.severity}`,
      `**Affected Users:** ${incident.affectedUsers}`,
      `**Affected Systems:** ${incident.affectedSystems.join(', ')}`,
      '',
      `## Root Cause\n\n${rootCause}`,
      '',
      '## Timeline',
      '',
      `- ${incident.startedAt} — Incident detected by ${incident.detectedBy}`,
      `- ${incident.startedAt} — Investigation began`,
      `- ${new Date().toISOString()} — Resolution applied`,
      `- ${new Date().toISOString()} — Verification complete`,
      '',
      '## Lessons Learned',
      '',
      ...lessonsLearned.map((lesson) => `- ${lesson}`),
      '',
      '## Preventative Actions',
      '',
      '1. Add monitoring for affected systems',
      '2. Improve error handling for identified failure modes',
      '3. Update runbooks and escalation procedures',
      '4. Schedule follow-up review in 1 week',
      '',
      '---',
      `*Reported by: ${incident.detectedBy}*`,
    ].join('\n');
  }

  private emailTemplate = (incident: IncidentData): string => [
    `Subject: [${incident.severity}] ${incident.title}`,
    '',
    `Dear Polymarket user,`,
    '',
    `We are currently experiencing an issue that may affect your trading experience.`,
    '',
    `**Issue:** ${incident.description}`,
    `**Severity:** ${incident.severity}`,
    `**Affected Systems:** ${incident.affectedSystems.join(', ')}`,
    `**Estimated Impact:** ~${incident.affectedUsers} users`,
    '',
    `Our engineering team is actively working on a resolution. We will provide updates every ${incident.severity === 'P0' ? '5 minutes' : incident.severity === 'P1' ? '15 minutes' : '30 minutes'}.`,
    '',
    `You can track the status at: https://status.polymarket.com`,
    '',
    `Thank you for your patience.`,
    `— Polymarket CX Team`,
  ].join('\n');

  private dashboardTemplate = (incident: IncidentData): string => [
    `## ${incident.title}`,
    '',
    `Status: **${incident.status}**`,
    `Severity: **${incident.severity}**`,
    `Affected: **${incident.affectedUsers} users**`,
    `Started: **${incident.startedAt}**`,
    '',
    incident.description,
    '',
    `Systems: ${incident.affectedSystems.join(', ')}`,
  ].join('\n');

  private statusPageTemplate = (incident: IncidentData): string => [
    `**${incident.status.toUpperCase()}**: ${incident.title}`,
    '',
    `We are ${incident.severity === 'P0' ? 'experiencing' : 'investigating'} a ${incident.severity.toLowerCase()}-severity issue that may affect:`,
    '',
    `- ${incident.affectedSystems.join('\n- ')}`,
    '',
    `~${incident.affectedUsers} users may be affected.`,
    '',
    `Next update in: ${incident.severity === 'P0' ? '5 minutes' : incident.severity === 'P1' ? '15 minutes' : '30 minutes'}`,
  ].join('\n');
}
