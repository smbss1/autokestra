export type WorkflowVersion = string;

export type WorkflowTrigger = CronTrigger | WebhookTrigger;

export interface CronTrigger {
  type: 'cron';
  cron: string;
}

export interface WebhookTrigger {
  type: 'webhook';
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}

export interface RetryPolicy {
  max: number;
  backoffSeconds?: number;
}

export interface WorkflowTask {
  id: string;
  type: string;
  needs: string[];
  inputs?: Record<string, unknown>;
  retry?: RetryPolicy;
}

export interface WorkflowSource {
  filePath: string;
}

export interface Workflow {
  apiVersion: WorkflowVersion;
  id: string;
  enabled: boolean;
  trigger?: WorkflowTrigger;
  secrets?: string[];
  tasks: WorkflowTask[];
  source: WorkflowSource;
}
