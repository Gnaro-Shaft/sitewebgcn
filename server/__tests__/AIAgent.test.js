// Pure-function tests for AIAgent — no DB, no network.
// Approach: load AIAgent + the AIUsage model normally (Mongoose models don't
// open a DB connection at import time), then vi.spyOn the static methods
// before each test. This bypasses Vitest's CJS/ESM mock interop quirks.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Budget env vars BEFORE AIAgent is loaded — it reads them at module init
process.env.AI_MONTHLY_BUDGET_USD = '5';
process.env.AI_YEARLY_BUDGET_USD = '50';

const AIUsage = require('../models/AIUsage');
const AIAgent = require('../services/AIAgent');

describe('AIAgent.computeCost', () => {
  it('computes cost from input + output tokens', () => {
    // Pricing: $3/Mtok input, $15/Mtok output
    // 1000 input + 2000 output = 0.003 + 0.030 = $0.033
    const cost = AIAgent.computeCost({ input_tokens: 1000, output_tokens: 2000 });
    expect(cost).toBeCloseTo(0.033, 6);
  });

  it('handles missing token fields gracefully', () => {
    expect(AIAgent.computeCost({})).toBe(0);
    expect(AIAgent.computeCost({ input_tokens: 1000 })).toBeCloseTo(0.003, 6);
    expect(AIAgent.computeCost({ output_tokens: 1000 })).toBeCloseTo(0.015, 6);
  });

  it('returns 0 when both fields are 0', () => {
    expect(AIAgent.computeCost({ input_tokens: 0, output_tokens: 0 })).toBe(0);
  });

  it('matches the pricing constants exposed by the module', () => {
    // Sanity check the contract: $3 input, $15 output per million tokens
    expect(AIAgent.PRICING.input).toBeCloseTo(3 / 1_000_000, 10);
    expect(AIAgent.PRICING.output).toBeCloseTo(15 / 1_000_000, 10);
  });
});

describe('AIAgent.checkBudget', () => {
  let getCurrentSpy;
  let getYearSpendingSpy;

  beforeEach(() => {
    getCurrentSpy = vi.spyOn(AIUsage, 'getCurrent');
    getYearSpendingSpy = vi.spyOn(AIUsage, 'getYearSpending');
  });

  it('passes when within both budgets', async () => {
    getCurrentSpy.mockResolvedValue({ spendingUsd: 1.5 });
    getYearSpendingSpy.mockResolvedValue(10);

    const result = await AIAgent.checkBudget();

    expect(result.monthlySpent).toBe(1.5);
    expect(result.monthlyRemaining).toBeCloseTo(3.5, 6); // 5 - 1.5
    expect(result.yearlySpent).toBe(10);
    expect(result.yearlyRemaining).toBe(40); // 50 - 10
  });

  it('throws when monthly budget is exhausted', async () => {
    getCurrentSpy.mockResolvedValue({ spendingUsd: 5.01 });
    getYearSpendingSpy.mockResolvedValue(10);

    await expect(AIAgent.checkBudget()).rejects.toThrow(/Monthly AI budget exceeded/);
  });

  it('throws when monthly budget is exactly at limit (no further calls allowed)', async () => {
    getCurrentSpy.mockResolvedValue({ spendingUsd: 5 });
    getYearSpendingSpy.mockResolvedValue(10);

    // The guard uses >= so $5 exactly is "exhausted"
    await expect(AIAgent.checkBudget()).rejects.toThrow(/Monthly AI budget exceeded/);
  });

  it('throws when yearly budget is exhausted', async () => {
    getCurrentSpy.mockResolvedValue({ spendingUsd: 1 });
    getYearSpendingSpy.mockResolvedValue(50);

    await expect(AIAgent.checkBudget()).rejects.toThrow(/Yearly AI budget exceeded/);
  });

  it('checks monthly before yearly (monthly wins on duplicate breach)', async () => {
    getCurrentSpy.mockResolvedValue({ spendingUsd: 999 });
    getYearSpendingSpy.mockResolvedValue(999);

    await expect(AIAgent.checkBudget()).rejects.toThrow(/Monthly AI budget/);
  });
});
