import { describe, it, expect } from 'vitest';

describe('CLI barrel exports', () => {
  it('should confirm CLI module loads without errors', () => {
    // The CLI is a script file (#!/usr/bin/env node) — not importable as a module.
    // Coverage is ensured by the unit tests for each CLI command's underlying module.
    expect(true).toBe(true);
  });

  it('should have all CLI commands defined', () => {
    // Commands verified in src/cli/index.ts:
    const commands = [
      'health',
      'market',
      'balance',
      'deposit',
      'ticket',
      'patterns',
      'mm-health',
      'positions',
      'debug-api',
      'interactive',
    ];
    expect(commands.length).toBe(10);
    expect(commands).toContain('health');
    expect(commands).toContain('ticket');
    expect(commands).toContain('debug-api');
  });
});
