#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { ClobClient, DataApiClient, GammaApiClient, TicketGenerator,
  ErrorPatternAggregator, BalanceReconciler, DepositDiscrepancyTroubleshooter,
  MarketMakerDebugger, PositionLookupCli, ApiFailureDebugger } from '../config';
import type { PolymarketConfig } from '../config';

const program = new Command();

program
  .name('pma')
  .description('Polymarket Agent — Escalation Engineering Toolkit')
  .version('1.0.0');

// ── Health Check ──────────────────────────────────────────────
program
  .command('health')
  .description('Check health of all Polymarket APIs')
  .action(async () => {
    const spinner = ora('Checking API health...').start();
    try {
      const clob = new ClobClient();
      const data = new DataApiClient();
      const gamma = new GammaApiClient();
      const [clobHealth, dataHealth] = await Promise.allSettled([
        clob.healthCheck(),
        data.healthCheck(),
      ]);

      console.log('\n=== API Health Status ===\n');
      console.log(`CLOB API:    ${clobHealth.status === 'fulfilled' ? chalk.green('OK') : chalk.red('FAIL')}`);
      console.log(`Data API:    ${dataHealth.status === 'fulfilled' ? chalk.green('OK') : chalk.red('FAIL')}\n`);

      if (clobHealth.status === 'rejected') {
        console.log(chalk.red('CLOB Error:'), (clobHealth.reason as Error).message);
      }
    } catch (err) {
      spinner.fail('Health check failed');
      console.error(err);
    }
  });

// ── Market Lookup ─────────────────────────────────────────────
program
  .command('market <id>')
  .description('Get market details by ID')
  .option('--verbose', 'Show full market data')
  .action(async (id, opts) => {
    const spinner = ora('Fetching market...').start();
    try {
      const dataApi = new DataApiClient();
      const market = await dataApi.getMarket(id);

      spinner.succeed('Market found');
      console.log(`\n${market.question || market.slug}\n`);
      console.log(`Status: ${market.status}`);
      console.log(`Volume: ${market.volume}`);
      console.log(`24h Change: ${market.percentChange24h}%`);
      console.log(`Open Interest: ${market.openInterest}`);

      if (opts.verbose) {
        console.log('\n--- Full Market Data ---');
        console.log(JSON.stringify(market, null, 2));
      }
    } catch (err) {
      spinner.fail('Market not found');
      console.error(err);
    }
  });

// ── Balance Check ─────────────────────────────────────────────
program
  .command('balance <address>')
  .description('Check USDC balance for an address')
  .option('--clob <balance>', 'CLOB balance for reconciliation')
  .option('--data-api <balance>', 'Data API balance for reconciliation')
  .action(async (address, opts) => {
    const spinner = ora('Checking balance...').start();
    try {
      const reconciler = new BalanceReconciler();
      const result = await reconciler.reconcile({
        address,
        clobBalance: opts.clob,
        dataApiBalance: opts.dataApi,
      });

      spinner.succeed('Balance check complete');
      console.log(`\nAddress: ${address}\n`);
      console.log(`On-chain USDC: ${result.onChainUSDC.formatted}`);

      if (result.clobBalance) {
        console.log(`CLOB Balance:  ${result.clobBalance.formatted}`);
      }
      if (result.dataApiBalance) {
        console.log(`Data API:      ${result.dataApiBalance.formatted}`);
      }

      if (result.discrepancy) {
        console.log(chalk.red(`\nDiscrepancy: ${result.discrepancy}`));
        if (result.recommendations.length > 0) {
          console.log(chalk.yellow('\nRecommendations:'));
          for (const rec of result.recommendations) {
            console.log(`  - ${rec}`);
          }
        }
      } else {
        console.log(chalk.green('\nAll balances match'));
      }
    } catch (err) {
      spinner.fail('Balance check failed');
      console.error(err);
    }
  });

// ── Deposit Investigation ─────────────────────────────────────
program
  .command('deposit <address>')
  .description('Investigate a missing deposit')
  .requiredOption('--expected <amount>', 'Expected deposit amount')
  .requiredOption('--clob-balance <amount>', 'Current CLOB balance')
  .option('--tx-hash <hash>', 'Transaction hash')
  .action(async (address, opts) => {
    const spinner = ora('Investigating deposit...').start();
    try {
      const troubleshooter = new DepositDiscrepancyTroubleshooter();
      const result = await troubleshooter.investigateDeposit({
        userAddress: address,
        expectedAmount: opts.expected,
        clobBalance: opts.clobBalance,
        txHash: opts.txHash,
      });

      spinner.succeed('Investigation complete');
      console.log(`\nUser: ${address}\n`);
      console.log(`Expected: ${result.expectedAmount} USDC`);
      console.log(`On-chain: ${result.onChainBalance} USDC`);
      if (result.clobBalance) {
        console.log(`CLOB:     ${result.clobBalance} USDC`);
      }

      if (result.discrepancies.length > 0) {
        console.log(chalk.red('\nDiscrepancies found:'));
        for (const d of result.discrepancies) {
          console.log(chalk.red(`  - ${d}`));
        }
      }

      if (result.recommendations.length > 0) {
        console.log(chalk.yellow('\nRecommendations:'));
        for (const rec of result.recommendations) {
          console.log(chalk.yellow(`  - ${rec}`));
        }
      }
    } catch (err) {
      spinner.fail('Investigation failed');
      console.error(err);
    }
  });

// ── Generate Ticket ──────────────────────────────────────────
program
  .command('ticket')
  .description('Generate a structured bug report')
  .option('--title <title>', 'Ticket title')
  .option('--category <category>', 'Category: api_failure, order_issue, deposit_problem, balance_discrepancy')
  .option('--description <desc>', 'Description')
  .option('--expected <expected>', 'Expected behavior')
  .option('--actual <actual>', 'Actual behavior')
  .option('--user <user>', 'Affected user')
  .option('--steps <steps>', 'Steps to reproduce (comma-separated)')
  .action(async (opts) => {
    const generator = new TicketGenerator();
    const steps = opts.steps ? opts.steps.split(',').map((s) => s.trim()) : ['Reproduce the issue'];

    const ticket = generator.generateTicket({
      title: opts.title || 'New Escalation',
      category: opts.category || 'other',
      description: opts.description || 'No description provided',
      stepsToReproduce: steps,
      expectedBehavior: opts.expected || 'Expected behavior',
      actualBehavior: opts.actual || 'Actual behavior',
      user: opts.user || null,
    });

    console.log(generator.toMarkdown(ticket));
  });

// ── Error Pattern Analysis ────────────────────────────────────
program
  .command('patterns')
  .description('Analyze error patterns from logs')
  .option('--file <path>', 'Log file path')
  .option('--top <n>', 'Show top N patterns', '10')
  .action(async (opts) => {
    const aggregator = new ErrorPatternAggregator();
    const patterns = aggregator.getTopPatterns(parseInt(opts.top || '10'));

    if (patterns.length === 0) {
      console.log('No error patterns found. Add errors via the API.');
      return;
    }

    console.log('\n=== Error Pattern Analysis ===\n');
    console.log(`Total patterns: ${patterns.length}\n`);

    for (const p of patterns) {
      const sevColor = p.severity === 'P0' || p.severity === 'P1' ? 'red' : p.severity === 'P2' ? 'yellow' : 'grey';
      console.log(chalk[sevColor](`${p.severity} ${p.occurrences}x ${p.errorMessage}`));
      console.log(`  Users affected: ${p.affectedUsers.length}`);
      console.log(`  Trend: ${p.trend}`);
      if (p.suggestedFix) console.log(`  Fix: ${p.suggestedFix}`);
      console.log();
    }

    const feedback = aggregator.generateProductFeedback();
    if (feedback.length > 0) {
      console.log(chalk.blue('\n=== Product Feedback ===\n'));
      for (const f of feedback) {
        console.log(`${f.priority}: ${f.issue}`);
        console.log(`  Impact: ${f.impact}`);
        console.log(`  Recommendation: ${f.recommendation}`);
        console.log();
      }
    }
  });

// ── Market Maker Health ───────────────────────────────────────
program
  .command('mm-health <tokenID>')
  .description('Check market maker health for a token')
  .action(async (tokenID) => {
    const debugger_ = new MarketMakerDebugger();
    const health = await debugger_.checkMarketHealth(tokenID);
    console.log(debugger_.formatHealthReport(health));
  });

// ── Position Lookup ──────────────────────────────────────────
program
  .command('positions <address>')
  .description('Look up CTF positions for an address')
  .option('--tokens <ids>', 'Comma-separated token IDs')
  .action(async (address, opts) => {
    const spinner = ora('Looking up positions...').start();
    try {
      const cli = new PositionLookupCli();
      const tokenIDs = opts.tokens ? opts.tokens.split(',').map((t) => t.trim()) : [];
      const summary = await cli.getPositionSummary(address, tokenIDs);
      spinner.succeed('Position lookup complete');
      console.log(cli.formatSummary(summary));
    } catch (err) {
      spinner.fail('Position lookup failed');
      console.error(err);
    }
  });

// ── API Failure Debug ─────────────────────────────────────────
program
  .command('debug-api <url>')
  .description('Debug a failed API request')
  .option('--method <method>', 'HTTP method', 'GET')
  .action(async (url, opts) => {
    const debugger_ = new ApiFailureDebugger();
    const result = await debugger_.debugApiFailure({
      url,
      method: opts.method,
    });
    console.log('\n=== API Failure Debug ===\n');
    console.log(`Endpoint: ${result.endpoint}`);
    console.log(`Status: ${result.status || 'N/A'}`);
    console.log(`Error: ${result.error || 'N/A'}`);
    console.log(`Category: ${result.errorCategory}`);
    console.log(`Duration: ${result.requestDuration}ms\n`);

    if (result.possibleCauses.length > 0) {
      console.log('Possible causes:');
      for (const c of result.possibleCauses) console.log(`  - ${c}`);
    }
    if (result.suggestedFixes.length > 0) {
      console.log('\nSuggested fixes:');
      for (const f of result.suggestedFixes) console.log(`  - ${f}`);
    }
  });

// ── Interactive Mode ─────────────────────────────────────────
program
  .command('interactive')
  .description('Start interactive troubleshooting mode')
  .action(async () => {
    console.log(chalk.blue('\n=== Polymarket Escalation Toolkit ==='));
    console.log(chalk.gray('Type "help" for commands, "quit" to exit\n'));

    const rl = await import('readline');
    const readline = rl.createInterface({ input: process.stdin, output: process.stdout });
    const prompt = () => new Promise((resolve) => {
      readline.question('\n> ', resolve);
    });

    while (true) {
      const input = (await prompt()).trim().toLowerCase();
      if (input === 'quit' || input === 'exit') break;
      if (input === 'help') {
        console.log('  health       — Check API health');
        console.log('  market <id>  — Look up market');
        console.log('  balance <a>  — Check balance');
        console.log('  ticket       — Generate bug report');
        console.log('  patterns     — Analyze error patterns');
        console.log('  mm-health <t> — Market maker health');
        console.log('  debug-api <u> — Debug API failure');
      } else if (input === 'health') {
        console.log('Run: pma health');
      } else if (input.startsWith('balance ')) {
        console.log(`Run: pma balance ${input.split(' ')[1]}`);
      } else if (input.startsWith('market ')) {
        console.log(`Run: pma market ${input.split(' ')[1]}`);
      } else if (input === 'ticket') {
        console.log('Run: pma ticket --title "..." --category "api_failure" --description "..." --expected "..." --actual "..."');
      } else if (input) {
        console.log(chalk.yellow(`Unknown command: ${input}. Type "help" for commands.`));
      }
    }
    readline.close();
  });

program.parse();
