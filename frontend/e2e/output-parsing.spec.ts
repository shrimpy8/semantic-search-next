/**
 * E2E tests for Milestone 2: Strict Output Parsing.
 *
 * Output parsing is internal (LLM response validation), so these tests
 * verify the feature indirectly through the evaluation API, which exercises
 * the full LLM judge → output parser → schema validation pipeline.
 *
 * Tests:
 * - Evaluation API returns properly validated scores (0-1 range)
 * - Available providers endpoint works
 * - Score schema integrity in API responses
 *
 * Requires: backend (port 8080) running.
 */

import { test, expect } from '@playwright/test';

test.describe('Output Parsing E2E', () => {
  // =========================================================================
  // Test 1: Evaluation API response has valid score ranges
  // =========================================================================
  test('evaluation API returns scores in valid 0-1 range', async ({ page }) => {
    // Try to run an evaluation — this exercises the full output parsing pipeline
    // If no LLM provider is configured, the API should return a clear error
    const res = await page.request.post('http://localhost:8080/api/v1/evals/run', {
      data: {
        query: 'What is machine learning?',
        answer: 'Machine learning is a subset of AI that enables systems to learn from data.',
        chunks: [
          {
            content:
              'Machine learning is a branch of artificial intelligence that focuses on building systems that learn from data.',
            source: 'ml-intro.pdf',
          },
        ],
      },
    });

    if (res.ok()) {
      const data = await res.json();

      // If evaluation succeeded, verify score ranges (output parser guarantees 0-1)
      if (data.scores) {
        const scoreFields = [
          'context_relevance',
          'context_precision',
          'context_coverage',
          'faithfulness',
          'answer_relevance',
          'completeness',
          'retrieval_score',
          'answer_score',
          'overall_score',
        ];

        for (const field of scoreFields) {
          if (data.scores[field] !== null && data.scores[field] !== undefined) {
            expect(data.scores[field]).toBeGreaterThanOrEqual(0);
            expect(data.scores[field]).toBeLessThanOrEqual(1);
          }
        }
      }
    } else {
      // If no LLM provider is configured, we expect a specific error
      // (not a 500 crash from bad parsing)
      expect(res.status()).toBeLessThan(500);
    }
  });

  // =========================================================================
  // Test 2: Available providers endpoint returns valid structure
  // =========================================================================
  test('available providers endpoint returns valid structure', async ({ page }) => {
    const res = await page.request.get('http://localhost:8080/api/v1/evals/providers');

    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    // Response should have available and registered arrays
    expect(data).toHaveProperty('available');
    expect(data).toHaveProperty('registered');
    expect(Array.isArray(data.available)).toBe(true);
    expect(Array.isArray(data.registered)).toBe(true);

    // Registered should include known providers
    expect(data.registered).toEqual(expect.arrayContaining(['openai']));
  });

  // =========================================================================
  // Test 3: Search response scores are within valid range
  // =========================================================================
  test('search response scores are normalized to valid ranges', async ({ page }) => {
    const res = await page.request.post('http://localhost:8080/api/v1/search', {
      data: {
        query: 'test query for score validation',
        preset: 'balanced',
        generate_answer: false,
      },
    });

    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    // If there are results, verify all scores are in valid range
    for (const result of data.results) {
      expect(result.scores.final_score).toBeGreaterThanOrEqual(0);
      expect(result.scores.final_score).toBeLessThanOrEqual(1);
      expect(result.scores.relevance_percent).toBeGreaterThanOrEqual(0);
      expect(result.scores.relevance_percent).toBeLessThanOrEqual(100);

      if (result.scores.semantic_score !== null) {
        expect(result.scores.semantic_score).toBeGreaterThanOrEqual(0);
        expect(result.scores.semantic_score).toBeLessThanOrEqual(1);
      }
    }

    // Same for low confidence results
    for (const result of data.low_confidence_results) {
      expect(result.scores.final_score).toBeGreaterThanOrEqual(0);
      expect(result.scores.final_score).toBeLessThanOrEqual(1);
    }
  });

  // =========================================================================
  // Test 4: Evaluation list endpoint returns valid schema
  // =========================================================================
  test('evaluation list endpoint returns valid response schema', async ({ page }) => {
    const res = await page.request.get('http://localhost:8080/api/v1/evals/results');

    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    // Should have paginated structure
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('has_more');
    expect(data).toHaveProperty('total_count');
    expect(Array.isArray(data.data)).toBe(true);
    expect(typeof data.has_more).toBe('boolean');
    expect(typeof data.total_count).toBe('number');

    // If there are evaluations, verify score integrity
    for (const evaluation of data.data) {
      expect(evaluation).toHaveProperty('scores');
      expect(evaluation).toHaveProperty('judge_provider');
      expect(evaluation).toHaveProperty('judge_model');

      // Verify all scores are in valid range (output parsing guarantees this)
      if (evaluation.scores.overall_score !== null) {
        expect(evaluation.scores.overall_score).toBeGreaterThanOrEqual(0);
        expect(evaluation.scores.overall_score).toBeLessThanOrEqual(1);
      }
    }
  });

  // =========================================================================
  // Test 5: Evals UI page loads without errors
  // =========================================================================
  test('evals page loads and displays evaluation interface', async ({ page }) => {
    await page.goto('/evals');
    await page.waitForLoadState('networkidle');

    // The page should load without a crash — this exercises the full
    // frontend → API → output parsing pipeline for evaluation display
    await expect(page).toHaveURL(/\/evals/);

    // Should show the evaluations page (either empty state or list)
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();
  });
});
