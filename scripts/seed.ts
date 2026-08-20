#!/usr/bin/env tsx
import { getDb } from '../src/lib/db/client';
import { upsertSession } from '../src/lib/db/repositories/sessions';
import { startTurn, finalizeTurn } from '../src/lib/db/repositories/turns';
import { recordToolEvent } from '../src/lib/db/repositories/toolEvents';
import { recordFileChange } from '../src/lib/db/repositories/fileChanges';
import { createTodo, updateTodo } from '../src/lib/db/repositories/todos';
import { addDays, todayLocal } from '../src/lib/time';

function localMidnightIso(dayKey: string, hours: number, minutes: number): string {
  const [y, m, d] = dayKey.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d, hours, minutes, 0, 0);
  return dt.toISOString();
}

function isDbAlreadySeeded(): boolean {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as c FROM sessions').get() as { c: number };
  return row.c > 0;
}

function seedDay(dayKey: string, spec: Array<{
  hour: number;
  minute: number;
  duration: number;
  project: string;
  branch?: string;
  prompt: string;
  response: string;
  title?: string;
  summary?: string;
  files?: string[];
  commands?: string[];
  failed?: number;
}>) {
  for (const item of spec) {
    const session = upsertSession({
      claude_session_id: `seed-${dayKey}-${item.hour}-${item.project}`,
      project_name: item.project,
      cwd: `/tmp/${item.project}`,
      git_root: `/tmp/${item.project}`,
      git_branch: item.branch || 'main',
      source: 'startup'
    });
    const started = localMidnightIso(dayKey, item.hour, item.minute);
    const ended = new Date(new Date(started).getTime() + item.duration * 60_000).toISOString();

    const db = getDb();
    const turn = startTurn({
      session_id: session.id,
      claude_session_id: session.claude_session_id,
      prompt_id: `seed-${dayKey}-${item.hour}-${item.minute}`,
      user_prompt: item.prompt,
      project_name: item.project,
      git_branch: item.branch || 'main',
      cwd: `/tmp/${item.project}`
    });
    db.prepare('UPDATE turns SET started_at = ?, created_at = ?, updated_at = ? WHERE id = ?').run(
      started,
      started,
      started,
      turn.id
    );
    if (item.files) {
      for (const f of item.files) {
        recordFileChange({
          session_id: session.id,
          turn_id: turn.id,
          prompt_id: turn.prompt_id,
          file_path: f,
          operation: 'modified'
        });
      }
    }
    if (item.commands) {
      for (const c of item.commands) {
        recordToolEvent({
          session_id: session.id,
          turn_id: turn.id,
          prompt_id: turn.prompt_id,
          tool_name: 'Bash',
          event_type: 'success',
          input_summary: `Ran ${c}`
        });
      }
    }
    if (item.failed) {
      for (let i = 0; i < item.failed; i++) {
        recordToolEvent({
          session_id: session.id,
          turn_id: turn.id,
          prompt_id: turn.prompt_id,
          tool_name: 'Bash',
          event_type: 'failure',
          input_summary: 'Ran npm test',
          output_summary: 'exit code 1'
        });
      }
    }

    finalizeTurn(turn.id, {
      assistant_response: item.response,
      title: item.title,
      summary: item.summary,
      status: 'completed',
      ended_at: ended,
      files_modified: item.files,
      commands_run: item.commands?.map((c) => `Ran ${c}`),
      tool_failures: item.failed || 0
    });
    db.prepare('UPDATE turns SET ended_at = ? WHERE id = ?').run(ended, turn.id);
  }
}

function seedTodos() {
  const today = todayLocal();
  createTodo({
    title: 'Investigate BigQuery max staleness configuration',
    description: 'Follow up on yesterday’s materialized view investigation',
    priority: 'high',
    project_name: 'reporting-service',
    tags: ['bigquery'],
    source: 'ui'
  });
  createTodo({
    title: 'Compare old vs new query cost after refresh fix',
    priority: 'medium',
    project_name: 'reporting-service',
    source: 'ui'
  });
  const t3 = createTodo({
    title: 'Add Kafka retry tests',
    priority: 'medium',
    project_name: 'kafka-service',
    source: 'claude',
    tags: ['kafka']
  });
  updateTodo(t3.id, { status: 'completed' });
  createTodo({
    title: 'Investigate Redis connection timeout',
    priority: 'medium',
    project_name: 'reporting-service',
    source: 'ui'
  });
  void today;
}

function main() {
  if (isDbAlreadySeeded() && !process.argv.includes('--force')) {
    console.log('[INFO] Database already contains data. Re-run with --force to add seed samples.');
    return;
  }
  const today = todayLocal();
  const yesterday = addDays(today, -1);
  const threeDaysAgo = addDays(today, -3);
  const weekAgo = addDays(today, -7);

  seedDay(today, [
    {
      hour: 9,
      minute: 31,
      duration: 44,
      project: 'reporting-service',
      branch: 'main',
      prompt: 'Debug why our BigQuery materialized view isn’t refreshing.',
      response:
        'The refresh is being blocked by pending CDC upserts. The watermark hasn’t advanced past the last DML batch, so the MV job is skipping the refresh window.',
      title: 'Investigated BigQuery MV refresh failure',
      summary:
        'Diagnosed the MV refresh issue and identified pending CDC/upsert application as the likely blocker. Suggested inspecting max_staleness and CDC watermark.',
      files: ['sql/mv/user_agency_client_mapping.sql', 'ops/bigquery/refresh_diagnostics.sql'],
      commands: ['bq query --nouse_legacy_sql', 'bq show -j <jobid>']
    },
    {
      hour: 11,
      minute: 20,
      duration: 26,
      project: 'kam-service',
      branch: 'feature/timezone-fix',
      prompt: 'Fix API timezone handling for schedules crossing midnight.',
      response:
        'Root cause: overnight window computed negative duration when end < start in local time. Updated the window handler to add 24h when the offset is negative.',
      title: 'Fixed overnight time window bug',
      summary: 'Identified negative duration for schedules crossing midnight and corrected window handling.',
      files: ['src/schedules/window.ts', 'tests/schedules/window.spec.ts'],
      commands: ['npm test -- schedules/window']
    },
    {
      hour: 15,
      minute: 5,
      duration: 33,
      project: 'kafka-service',
      branch: 'main',
      prompt: 'Add retry logic to our Kafka publisher.',
      response:
        'Added exponential backoff with jitter to the Kafka publisher. Bounded max attempts to 5 and integrated the existing dead-letter path.',
      title: 'Implemented Kafka publisher retries',
      summary: 'Added exponential backoff with jitter, bounded retries, and DLQ integration to the Kafka publisher.',
      files: ['src/publisher/kafka.ts', 'tests/publisher/kafka.spec.ts'],
      commands: ['npm run lint', 'npm test -- publisher/kafka']
    }
  ]);

  seedDay(yesterday, [
    {
      hour: 10,
      minute: 12,
      duration: 55,
      project: 'reporting-service',
      branch: 'main',
      prompt: 'Explain why the pipeline is running slower today.',
      response:
        'A hot partition on the ingestion topic was serialising work through a single consumer. Reassigned partitions to smooth throughput.',
      title: 'Diagnosed slow pipeline throughput',
      summary: 'Traced slowdown to a hot Kafka partition and rebalanced consumers.',
      files: ['ops/kafka/topics.tf'],
      commands: ['kubectl logs deploy/pipeline', 'terraform plan']
    },
    {
      hour: 16,
      minute: 40,
      duration: 15,
      project: 'infra',
      branch: 'main',
      prompt: 'Update Helm values for higher HPA target.',
      response: 'Raised targetCPUUtilizationPercentage from 70 to 85 and readinessPeriod to 15s.',
      title: 'Tuned HPA targets',
      summary: 'Increased HPA targetCPU to 85% and readiness period to 15s to reduce oscillation.',
      files: ['helm/values/prod/reporting.yaml'],
      commands: ['helm diff']
    }
  ]);

  seedDay(threeDaysAgo, [
    {
      hour: 14,
      minute: 5,
      duration: 20,
      project: 'reporting-service',
      branch: 'main',
      prompt: 'Investigate Redis latency spikes overnight.',
      response: 'Latency spikes coincide with backup jobs. Suggested moving backups to a replica window.',
      title: 'Investigated Redis latency spikes',
      summary: 'Correlated spikes with backup jobs and proposed moving backups to a replica window.',
      commands: ['redis-cli --latency']
    }
  ]);

  seedDay(weekAgo, [
    {
      hour: 9,
      minute: 5,
      duration: 40,
      project: 'reporting-service',
      branch: 'main',
      prompt: 'Add materialized view for user-agency mapping.',
      response: 'Created the MV with 30-minute max staleness and staged the refresh schedule.',
      title: 'Added user-agency mapping MV',
      summary: 'Created MV with 30 min max staleness and staged refresh schedule.',
      files: ['sql/mv/user_agency_client_mapping.sql'],
      commands: ['bq mk --materialized_view']
    }
  ]);

  seedTodos();

  console.log('[ OK ] Seed data written.');
}

main();
