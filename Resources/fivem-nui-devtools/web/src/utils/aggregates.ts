import type { DiagnosticsSample, ProviderState, ResourceInfo } from '../types';
import { finite, resourceGroup } from './format';

/**
 * Computes an aggregated telemetry sample across all active diagnostic providers.
 */
export function computeAggregateSample(
  providers: Record<string, ProviderState>,
  timestamp: number
): DiagnosticsSample | null {
  const entries = Object.values(providers);
  if (entries.length === 0) return null;

  let totalMessages = 0;
  let totalBytes = 0;
  let largestPayloadBytes = 0;
  let completedRequests = 0;
  let failedMessages = 0;
  let messagesPerSecond = 0;
  let incomingPerSecond = 0;
  let outgoingPerSecond = 0;
  let bytesPerSecond = 0;
  let responseTimeSum = 0;
  const counters: Record<string, number> = {};
  const timings: Record<string, number> = {};

  for (const { latest } of entries) {
    totalMessages += latest.totalMessages;
    totalBytes += latest.totalBytes;
    largestPayloadBytes = Math.max(largestPayloadBytes, latest.largestPayloadBytes);
    completedRequests += latest.completedRequests;
    failedMessages += latest.failedMessages;
    messagesPerSecond += latest.messagesPerSecond;
    incomingPerSecond += latest.incomingPerSecond;
    outgoingPerSecond += latest.outgoingPerSecond;
    bytesPerSecond += latest.bytesPerSecond;
    responseTimeSum += latest.averageResponseMs * latest.completedRequests;

    if (latest.counters) {
      for (const [k, v] of Object.entries(latest.counters)) {
        counters[k] = (counters[k] ?? 0) + v;
      }
    }
    if (latest.timings) {
      for (const [k, v] of Object.entries(latest.timings)) {
        timings[k] = (timings[k] ?? 0) + v;
      }
    }
  }

  return {
    version: 1,
    source: 'all',
    timestamp,
    messagesPerSecond,
    incomingPerSecond,
    outgoingPerSecond,
    averageResponseMs: completedRequests > 0 ? responseTimeSum / completedRequests : 0,
    bytesPerSecond,
    totalMessages,
    totalBytes,
    largestPayloadBytes,
    completedRequests,
    failedMessages,
    counters,
    timings,
    operations: []
  };
}

/**
 * Computes the inbound traffic percentage share (0-100%).
 */
export function computeInboundShare(sample?: DiagnosticsSample): number {
  if (!sample) return 50;
  const incoming = finite(sample.incomingPerSecond);
  const outgoing = finite(sample.outgoingPerSecond);
  const total = incoming + outgoing;
  return total > 0 ? (incoming / total) * 100 : 50;
}

/**
 * Computes the health success percentage (0-100%).
 */
export function computeHealthPercent(sample?: DiagnosticsSample): number {
  if (!sample) return 100;
  const attempts = sample.completedRequests + sample.failedMessages;
  return attempts > 0 ? (sample.completedRequests / attempts) * 100 : 100;
}

/**
 * Aggregates count statistics for discovered FiveM resources by lifecycle group.
 */
export function computeResourceCounts(resources: ResourceInfo[] = []): {
  total: number;
  started: number;
  transitioning: number;
  inactive: number;
} {
  let started = 0;
  let transitioning = 0;
  let inactive = 0;
  for (const r of resources) {
    const g = resourceGroup(r.state);
    if (g === 'started') started++;
    else if (g === 'transitioning') transitioning++;
    else inactive++;
  }
  return { total: resources.length, started, transitioning, inactive };
}
