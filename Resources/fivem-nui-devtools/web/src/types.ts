export interface VisibilityState {
  visible: boolean;
  connected: boolean;
  interactive: boolean;
  providerCount: number;
}

export interface DiagnosticsSample {
  version: number;
  source: string;
  timestamp: number;
  messagesPerSecond: number;
  incomingPerSecond: number;
  outgoingPerSecond: number;
  averageResponseMs: number;
  bytesPerSecond: number;
  totalMessages: number;
  totalBytes: number;
  largestPayloadBytes: number;
  completedRequests: number;
  failedMessages: number;
  counters?: Record<string, number>;
  timings?: Record<string, number>;
  operations?: DiagnosticOperation[];
}

export interface DiagnosticOperation {
  sequence: number;
  timestamp: number;
  direction: string;
  type: string;
  event: string;
  payloadBytes: number;
  durationMs?: number;
  status: string;
  correlationId?: string;
  errorCode?: string;
}

export interface ProviderState {
  latest: DiagnosticsSample;
  history: DiagnosticsSample[];
  operations: DiagnosticOperation[];
  receivedAt: number;
}

export interface ResourceInfo {
  name: string;
  state: string;
  version?: string | null;
  author?: string | null;
  description?: string | null;
  dependencies?: string[];
  hasNui: boolean;
  isDiagnosticsProvider: boolean;
}

export interface ResourceLifecycleEntry {
  timestamp: number;
  resource: string;
  state: string;
}

export interface ResourceInventory {
  timestamp: number;
  resources: ResourceInfo[];
  lifecycle?: ResourceLifecycleEntry[];
}

export interface DiagnosticAlert {
  resource: string;
  severity: 'info' | 'warn' | 'error' | string;
  code: string;
  message: string;
  timestamp: number;
}

export interface SessionState {
  isRecording: boolean;
  frameCount: number;
  durationMs: number;
}

export type ChartMetric = 'messagesPerSecond' | 'averageResponseMs' | 'bytesPerSecond';
export type Tab = 'overview' | 'details' | 'timeline' | 'resources';
export type ResourceSubtab = 'inventory' | 'lifecycle';
