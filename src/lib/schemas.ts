import { z } from 'zod';

export const TodoStatus = z.enum(['open', 'in_progress', 'completed', 'cancelled']);
export type TodoStatusT = z.infer<typeof TodoStatus>;

export const TodoPriority = z.enum(['low', 'medium', 'high']);
export type TodoPriorityT = z.infer<typeof TodoPriority>;

export const TodoSource = z.enum(['claude', 'ui']);
export type TodoSourceT = z.infer<typeof TodoSource>;

export const TodoInput = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(4000).optional().nullable(),
  status: TodoStatus.default('open'),
  priority: TodoPriority.default('medium'),
  due_at: z.string().optional().nullable(),
  project_name: z.string().max(200).optional().nullable(),
  tags: z.array(z.string()).max(20).optional(),
  source: TodoSource.default('ui'),
  source_session_id: z.string().optional().nullable(),
  source_prompt_id: z.string().optional().nullable()
});
export type TodoInputT = z.infer<typeof TodoInput>;

export const TodoPatch = TodoInput.partial();
export type TodoPatchT = z.infer<typeof TodoPatch>;

export const SessionStatus = z.enum(['active', 'ended', 'compacted']);
export const TurnStatus = z.enum(['active', 'completed', 'failed', 'interrupted']);
