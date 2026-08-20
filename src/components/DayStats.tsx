export function DayStats({
  stats,
  projects
}: {
  stats: {
    turnCount: number;
    projectCount: number;
    filesTouched: number;
    commandsRun: number;
    toolFailures: number;
    todosCreated: number;
    todosCompleted: number;
    sessionCount: number;
  };
  projects: string[];
}) {
  const rows: Array<[string, number | string]> = [
    ['Claude sessions', stats.sessionCount],
    ['Work items', stats.turnCount],
    ['Files touched', stats.filesTouched],
    ['Commands run', stats.commandsRun],
    ['TODOs created', stats.todosCreated],
    ['TODOs completed', stats.todosCompleted]
  ];
  if (stats.toolFailures) rows.push(['Tool failures', stats.toolFailures]);
  return (
    <section className="mt-6 rule border-t md:border md:rounded-lg md:p-5">
      <h2 className="serif text-lg font-bold uppercase tracking-wider mb-4">By The Numbers</h2>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[10px] mono uppercase tracking-widest text-muted leading-tight">{k}</dt>
            <dd className="serif text-3xl font-black leading-none mt-1 tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {projects.length > 0 && (
        <div className="mt-5 pt-4 hairline-top">
          <div className="text-[10px] mono uppercase tracking-widest text-muted mb-2">Projects touched</div>
          <ul className="flex flex-wrap gap-1.5">
            {projects.map((p) => (
              <li key={p} className="text-xs mono rule border rounded-full px-2 py-0.5">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
