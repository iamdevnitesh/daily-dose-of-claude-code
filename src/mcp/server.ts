#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import {
  createTodo,
  updateTodo,
  deleteTodo,
  listTodos,
  getTodo,
  searchTodos,
  findTodoByTitleLike
} from '../lib/db/repositories/todos';
import { searchTurns, getTurn, listRecentTurns } from '../lib/db/repositories/turns';
import { buildDayView } from '../lib/db/repositories/day';
import { setSetting } from '../lib/db/repositories/settings';
import { TodoInput, TodoPatch } from '../lib/schemas';
import { todayLocal, localDayKey } from '../lib/time';
import { log } from '../lib/logger';

const server = new Server(
  {
    name: 'daily-dose',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

const TOOLS = [
  {
    name: 'daily_dose_add_todo',
    description:
      'Add a persistent TODO to the Daily Dose memory. Use whenever the user asks you to remember something to do, track a task, or add a TODO. Do not persist passwords, tokens, or secrets.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short imperative title for the TODO' },
        description: { type: 'string', description: 'Optional longer description' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority (default medium)' },
        due_at: { type: 'string', description: 'Optional ISO timestamp for due date' },
        project: { type: 'string', description: 'Optional project name; defaults to current project if not set' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['title']
    }
  },
  {
    name: 'daily_dose_list_todos',
    description: 'List TODOs. Filter by status (open, in_progress, completed, cancelled, active) and/or project.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'in_progress', 'completed', 'cancelled', 'active'],
          description: 'active = open + in_progress'
        },
        project: { type: 'string' },
        limit: { type: 'number' }
      }
    }
  },
  {
    name: 'daily_dose_update_todo',
    description: 'Update fields on a TODO by id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'cancelled'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        due_at: { type: 'string' },
        project: { type: 'string' }
      },
      required: ['id']
    }
  },
  {
    name: 'daily_dose_complete_todo',
    description:
      'Mark a TODO as completed. Provide id OR a title_query to find and complete a matching TODO by title.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title_query: { type: 'string', description: 'Substring of TODO title if id is unknown' },
        project: { type: 'string' }
      }
    }
  },
  {
    name: 'daily_dose_delete_todo',
    description: 'Delete a TODO by id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    }
  },
  {
    name: 'daily_dose_search_memory',
    description:
      'Full-text search across historical Claude activity (titles, summaries, prompts, responses) and TODOs. Returns matching activities and TODOs.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        project: { type: 'string' },
        limit: { type: 'number' }
      },
      required: ['query']
    }
  },
  {
    name: 'daily_dose_get_day',
    description:
      'Get a full Daily Dose day view (activities, TODOs, stats, projects). date defaults to today (local). Use format YYYY-MM-DD.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD local date; defaults to today' }
      }
    }
  },
  {
    name: 'daily_dose_get_recent_activity',
    description: 'List recent Claude activity across projects.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string' },
        limit: { type: 'number' }
      }
    }
  },
  {
    name: 'daily_dose_remember',
    description:
      'Save a free-form memory note into Daily Dose. Prefer add_todo for actionable items. Use this for notes to recall later.',
    inputSchema: {
      type: 'object',
      properties: {
        note: { type: 'string' },
        project: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['note']
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

function ok(text: string) {
  return { content: [{ type: 'text', text }] };
}

function json(obj: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const a: any = args || {};

  try {
    switch (name) {
      case 'daily_dose_add_todo': {
        const input = TodoInput.parse({
          title: a.title,
          description: a.description,
          priority: a.priority || 'medium',
          due_at: a.due_at,
          project_name: a.project,
          tags: a.tags,
          source: 'claude'
        });
        const row = createTodo(input);
        return ok(`Added TODO ${row.id}: ${row.title}`);
      }
      case 'daily_dose_list_todos': {
        const rows = listTodos({ status: a.status, project: a.project, limit: a.limit ?? 50 });
        return json(rows);
      }
      case 'daily_dose_update_todo': {
        const patch = TodoPatch.parse({
          title: a.title,
          description: a.description,
          status: a.status,
          priority: a.priority,
          due_at: a.due_at,
          project_name: a.project
        });
        const row = updateTodo(a.id, patch);
        if (!row) return ok(`No TODO with id ${a.id}`);
        return ok(`Updated TODO ${row.id}: ${row.title} (${row.status})`);
      }
      case 'daily_dose_complete_todo': {
        let id = a.id as string | undefined;
        if (!id && a.title_query) {
          const match = findTodoByTitleLike(String(a.title_query), a.project);
          if (!match) return ok(`No TODO matched title "${a.title_query}"`);
          id = match.id;
        }
        if (!id) return ok('Provide id or title_query');
        const row = updateTodo(id, { status: 'completed' });
        if (!row) return ok(`No TODO with id ${id}`);
        return ok(`Completed TODO ${row.id}: ${row.title}`);
      }
      case 'daily_dose_delete_todo': {
        const removed = deleteTodo(a.id);
        return ok(removed ? `Deleted TODO ${a.id}` : `No TODO with id ${a.id}`);
      }
      case 'daily_dose_search_memory': {
        const q = String(a.query || '');
        const turns = searchTurns(q, { project: a.project, limit: a.limit ?? 15 }).map((t) => ({
          id: t.id,
          day: localDayKey(t.started_at),
          project: t.project_name,
          title: t.title,
          summary: t.summary
        }));
        const todos = searchTodos(q, a.limit ?? 15).map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          project: t.project_name
        }));
        return json({ activities: turns, todos });
      }
      case 'daily_dose_get_day': {
        const day = a.date ? String(a.date) : todayLocal();
        const view = buildDayView(day);
        return json({
          date: day,
          summary: view.summary,
          stats: view.stats,
          projects: view.projects,
          lead_story_id: view.leadStoryId,
          activities: view.turns.map((t) => ({
            id: t.id,
            started_at: t.started_at,
            ended_at: t.ended_at,
            project: t.project_name,
            branch: t.git_branch,
            title: t.title,
            summary: t.summary,
            status: t.status
          })),
          todos_created: view.todosCreated,
          todos_completed: view.todosCompleted
        });
      }
      case 'daily_dose_get_recent_activity': {
        const rows = listRecentTurns(a.project, a.limit ?? 10).map((t) => ({
          id: t.id,
          day: localDayKey(t.started_at),
          project: t.project_name,
          title: t.title,
          summary: t.summary
        }));
        return json(rows);
      }
      case 'daily_dose_remember': {
        const note = String(a.note || '');
        if (!note.trim()) return ok('Empty note');
        setSetting(`memory:${Date.now().toString(36)}`, JSON.stringify({ note, project: a.project, tags: a.tags }));
        const row = createTodo({
          title: `Memory: ${note.slice(0, 80)}`,
          description: note,
          status: 'completed',
          priority: 'low',
          project_name: a.project ?? null,
          tags: Array.isArray(a.tags) ? ['memory', ...a.tags] : ['memory'],
          source: 'claude'
        });
        return ok(`Saved memory ${row.id}`);
      }
      default:
        return ok(`Unknown tool: ${name}`);
    }
  } catch (err) {
    log.error('mcp', 'tool error', { tool: name, err: err instanceof Error ? err.message : String(err) });
    return ok(`Error: ${err instanceof Error ? err.message : String(err)}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info('mcp', 'server started');
}

main().catch((err) => {
  log.error('mcp', 'fatal', { err: err instanceof Error ? err.stack || err.message : String(err) });
  process.exit(1);
});

const shutdown = () => {
  log.info('mcp', 'shutting down');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Prevent unhandled rejections from crashing
process.on('unhandledRejection', (err) => {
  log.error('mcp', 'unhandled rejection', { err: err instanceof Error ? err.stack || err.message : String(err) });
});
