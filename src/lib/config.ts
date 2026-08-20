import fs from 'node:fs';
import { DD_CONFIG_PATH, ensureDirs } from './paths';

export interface DailyDoseConfig {
  tracking_enabled: boolean;
  store_user_prompts: boolean;
  store_assistant_responses: boolean;
  store_command_metadata: boolean;
  store_raw_transcripts: boolean;
  theme: 'auto' | 'light' | 'dark';
  max_open_todos_in_context: number;
  max_recent_activities_in_context: number;
  version: number;
}

export const DEFAULT_CONFIG: DailyDoseConfig = {
  tracking_enabled: true,
  store_user_prompts: true,
  store_assistant_responses: true,
  store_command_metadata: true,
  store_raw_transcripts: false,
  theme: 'auto',
  max_open_todos_in_context: 10,
  max_recent_activities_in_context: 5,
  version: 1
};

export function loadConfig(): DailyDoseConfig {
  try {
    ensureDirs();
    if (!fs.existsSync(DD_CONFIG_PATH)) {
      fs.writeFileSync(DD_CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
      return { ...DEFAULT_CONFIG };
    }
    const raw = fs.readFileSync(DD_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(cfg: Partial<DailyDoseConfig>): DailyDoseConfig {
  ensureDirs();
  const current = loadConfig();
  const merged = { ...current, ...cfg };
  fs.writeFileSync(DD_CONFIG_PATH, JSON.stringify(merged, null, 2));
  return merged;
}
