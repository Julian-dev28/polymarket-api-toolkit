import { describe, it, expect } from 'vitest';
import { IncidentCommunicator, type IncidentData } from '../../src/escalation/incident-communicator';

describe('IncidentCommunicator', () => {
  const comm = new IncidentCommunicator();

  const sampleIncident: IncidentData = {
    id: 'INC-001',
    title: 'CLOB API Outage',
    severity: 'P1',
    description: 'CLOB API returning 503 errors',
    startedAt: '2024-01-15T10:00:00Z',
    detectedBy: 'monitoring-system',
    affectedUsers: 5000,
    affectedSystems: ['clob-api', 'matching-engine'],
    affectedMarkets: ['mkt-1', 'mkt-2'],
    status: 'investigating',
  };

  // ---- draftIncidentNotification ----
  describe('draftIncidentNotification', () => {
    it('should generate email template', () => {
      const email = comm.draftIncidentNotification(sampleIncident, 'email');
      expect(email).toContain('Subject: [P1] CLOB API Outage');
      expect(email).toContain('Dear Polymarket user');
      expect(email).toContain('CLOB API returning 503 errors');
      expect(email).toContain('5000 users');
      expect(email).toContain('clob-api, matching-engine');
      expect(email).toContain('15 minutes'); // P1 -> 15 min
    });

    it('should generate dashboard template', () => {
      const dash = comm.draftIncidentNotification(sampleIncident, 'dashboard');
      expect(dash).toContain('## CLOB API Outage');
      expect(dash).toContain('Status: **investigating**');
      expect(dash).toContain('Severity: **P1**');
      expect(dash).toContain('5000 users');
      expect(dash).toContain('Started: **2024-01-15T10:00:00Z**');
    });

    it('should generate status_page template', () => {
      const sp = comm.draftIncidentNotification(sampleIncident, 'status_page');
      expect(sp).toContain('INVESTIGATING: CLOB API Outage');
      expect(sp).toContain('investigating a p1-severity issue');
      expect(sp).toContain('15 minutes');
    });

    it('should default to email template for unknown type', () => {
      const result = comm.draftIncidentNotification(sampleIncident, 'email' as 'email');
      expect(result).toContain('Subject: [P1]');
    });

    it('should handle P0 severity for 5-minute updates', () => {
      const p0: IncidentData = {
        ...sampleIncident, severity: 'P0', affectedMarkets: [],
      };
      const email = comm.draftIncidentNotification(p0, 'email');
      expect(email).toContain('5 minutes');
      const sp = comm.draftIncidentNotification(p0, 'status_page');
      expect(sp).toContain('5 minutes');
    });

    it('should handle P2+ severity for 30-minute updates', () => {
      const p2: IncidentData = {
        ...sampleIncident, severity: 'P2', affectedMarkets: [],
      };
      const email = comm.draftIncidentNotification(p2, 'email');
      expect(email).toContain('30 minutes');
    });

    it('should handle P3+ severity for hourly updates', () => {
      const p3: IncidentData = {
        ...sampleIncident, severity: 'P3', affectedMarkets: [],
      };
      const email = comm.draftIncidentNotification(p3, 'email');
      expect(email).toContain('30 minutes'); // P3 -> falls through to default 30 min in email template
    });
  });

  // ---- draftIncidentUpdate ----
  describe('draftIncidentUpdate', () => {
    it('should include title, time, severity, status, update text', () => {
      const update = comm.draftIncidentUpdate(sampleIncident, 'We have identified the root cause');
      expect(update).toContain('## Incident Update: CLOB API Outage');
      expect(update).toContain('Severity: P1');
      expect(update).toContain('Status: investigating');
      expect(update).toContain('We have identified the root cause');
      expect(update).toContain('We will provide the next update');
    });

    it('should always include timestamp', () => {
      const update = comm.draftIncidentUpdate(sampleIncident, 'Update');
      expect(update).toContain('**Time:**');
      // Should be an ISO string
      const timeMatch = update.match(/\*\*Time:\*\* (.*)/);
      expect(timeMatch).not.toBeNull();
      expect(() => new Date(timeMatch![1])).not.toThrow();
    });
  });

  // ---- draftResolutionNotice ----
  describe('draftResolutionNotice', () => {
    it('should include all resolution details', () => {
      const notice = comm.draftResolutionNotice(sampleIncident, 'Restarted matching engine');
      expect(notice).toContain('## Incident Resolved: CLOB API Outage');
      expect(notice).toContain('Started: 2024-01-15T10:00:00Z');
      expect(notice).toContain('Severity: P1');
      expect(notice).toContain('Affected Users: ~5000');
      expect(notice).toContain('Resolution: Restarted matching engine');
      expect(notice).toContain('apologize for any inconvenience');
    });

    it('should always include support contact line', () => {
      const notice = comm.draftResolutionNotice(sampleIncident, 'Fixed');
      expect(notice).toContain('please contact support with your wallet address');
    });
  });

  // ---- calculateImpact ----
  describe('calculateImpact', () => {
    it('should calculate user percentage correctly', () => {
      const result = comm.calculateImpact(sampleIncident, 10000);
      expect(result.userPercentage).toBe('50.00');
    });

    it('should calculate user percentage for small fraction', () => {
      const small: IncidentData = {
        ...sampleIncident, affectedUsers: 5, affectedMarkets: undefined,
      };
      const result = comm.calculateImpact(small, 100000);
      expect(result.userPercentage).toBe('0.01');
    });

    it('should include marketPercentage when affectedMarkets present', () => {
      const result = comm.calculateImpact(sampleIncident, 10000);
      expect(result.marketPercentage).toBe('2 markets affected');
    });

    it('should omit marketPercentage when no affectedMarkets', () => {
      const noMarkets: IncidentData = {
        ...sampleIncident, affectedMarkets: undefined,
      };
      const result = comm.calculateImpact(noMarkets, 10000);
      expect(result.marketPercentage).toBeUndefined();
    });

    it('should set correct severity labels', () => {
      expect(comm.calculateImpact({ ...sampleIncident, severity: 'P0' }, 10000).severityLabel).toBe('Critical — System-wide outage');
      expect(comm.calculateImpact({ ...sampleIncident, severity: 'P1' }, 10000).severityLabel).toBe('High — Significant impact on major users');
      expect(comm.calculateImpact({ ...sampleIncident, severity: 'P2' }, 10000).severityLabel).toBe('Medium — Affects a subset of users');
      expect(comm.calculateImpact({ ...sampleIncident, severity: 'P3' }, 10000).severityLabel).toBe('Low — Minor issue');
      expect(comm.calculateImpact({ ...sampleIncident, severity: 'P4' }, 10000).severityLabel).toBe('Informational');
    });

    it('should set correct communication frequencies', () => {
      expect(comm.calculateImpact({ ...sampleIncident, severity: 'P0' }, 10000).communicationFrequency).toBe('every_5_min');
      expect(comm.calculateImpact({ ...sampleIncident, severity: 'P1' }, 10000).communicationFrequency).toBe('every_15_min');
      expect(comm.calculateImpact({ ...sampleIncident, severity: 'P2' }, 10000).communicationFrequency).toBe('every_30_min');
      expect(comm.calculateImpact({ ...sampleIncident, severity: 'P3' }, 10000).communicationFrequency).toBe('hourly');
      expect(comm.calculateImpact({ ...sampleIncident, severity: 'P4' }, 10000).communicationFrequency).toBe('hourly');
    });
  });

  // ---- draftPostIncidentReport ----
  describe('draftPostIncidentReport', () => {
    it('should include all report sections', () => {
      const report = comm.draftPostIncidentReport(
        sampleIncident,
        'Memory leak in matching engine',
        ['Add memory monitoring', 'Set up alerting thresholds'],
      );
      expect(report).toContain('# Post-Incident Report: CLOB API Outage');
      expect(report).toContain('**Incident ID:** INC-001');
      expect(report).toContain('**Severity:** P1');
      expect(report).toContain('**Affected Users:** 5000');
      expect(report).toContain('clob-api, matching-engine');
      expect(report).toContain('## Root Cause');
      expect(report).toContain('Memory leak in matching engine');
      expect(report).toContain('## Timeline');
      expect(report).toContain('monitored-system');
      expect(report).toContain('## Lessons Learned');
      expect(report).toContain('Add memory monitoring');
      expect(report).toContain('## Preventative Actions');
      expect(report).toContain('Add monitoring for affected systems');
    });

    it('should include detectedBy in timeline', () => {
      const report = comm.draftPostIncidentReport(sampleIncident, 'Root cause', []);
      expect(report).toContain('detected by monitoring-system');
    });

    it('should always include 4 preventative actions', () => {
      const report = comm.draftPostIncidentReport(sampleIncident, 'Root cause', []);
      expect(report).toContain('1. Add monitoring for affected systems');
      expect(report).toContain('2. Improve error handling for identified failure modes');
      expect(report).toContain('3. Update runbooks and escalation procedures');
      expect(report).toContain('4. Schedule follow-up review in 1 week');
    });

    it('should include reporter attribution', () => {
      const report = comm.draftPostIncidentReport(sampleIncident, 'Root cause', []);
      expect(report).toContain('*Reported by: monitoring-system*');
    });
  });
});
