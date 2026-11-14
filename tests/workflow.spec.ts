import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

// The deploy workflow must run a pull request's events one at a time.
// If "Close preview environment" can overtake a deploy that is still
// uploading, the preview is created after it was closed and is never removed.

type Job = { if?: string; steps: { uses?: string; with?: Record<string, unknown> }[] };
type Workflow = {
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
  jobs: Record<string, Job>;
};

const workflow = yaml.load(
  readFileSync('.github/workflows/azure-static-web-apps.yml', 'utf8'),
) as Workflow;

const swaSteps = (job: Job) =>
  job.steps.filter((s) => s.uses?.startsWith('Azure/static-web-apps-deploy@'));

test.describe('deploy workflow', () => {
  test('serialises runs per pull request and never cancels a running one', () => {
    expect(workflow.concurrency?.group).toContain('github.event.pull_request.number');
    expect(workflow.concurrency?.['cancel-in-progress']).toBe(false);
  });

  test('no job overrides the workflow concurrency group', () => {
    for (const job of Object.values(workflow.jobs)) {
      expect(job).not.toHaveProperty('concurrency');
    }
  });

  test('has one upload job and one close job, split on the closed action', () => {
    const jobs = Object.values(workflow.jobs);
    const upload = jobs.filter((j) => swaSteps(j).some((s) => s.with?.action === 'upload'));
    const close = jobs.filter((j) => swaSteps(j).some((s) => s.with?.action === 'close'));
    expect(upload).toHaveLength(1);
    expect(close).toHaveLength(1);
    expect(upload[0].if).toContain("!= 'closed'");
    expect(close[0].if).toContain("== 'closed'");
  });
});
