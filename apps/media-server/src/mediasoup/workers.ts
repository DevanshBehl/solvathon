// ============================================
// mediasoup Worker & Router Management
// ============================================
// Creates one Worker per CPU core with round-robin distribution.
// Each Worker gets exactly one Router with VP8 video codec.
// ============================================

import * as mediasoup from 'mediasoup';
import * as os from 'os';
import type { types as mediasoupTypes } from 'mediasoup';

/** VP8 video codec for all routers */
const mediaCodecs: mediasoupTypes.RtpCodecCapability[] = [
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
  },
];

interface WorkerEntry {
  worker: mediasoupTypes.Worker;
  router: mediasoupTypes.Router;
  index: number;
}

const workers: WorkerEntry[] = [];
let nextWorkerIdx = 0;

/**
 * Initialize mediasoup workers — one per CPU core.
 * Call this once on startup.
 */
export async function initializeWorkers(): Promise<void> {
  const numCores = os.cpus().length;
  const rtcMinPort = parseInt(process.env.RTC_MIN_PORT || '40000', 10);
  const rtcMaxPort = parseInt(process.env.RTC_MAX_PORT || '49999', 10);

  console.info(`[mediasoup] Creating ${numCores} workers (ports ${rtcMinPort}-${rtcMaxPort})...`);

  for (let i = 0; i < numCores; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort,
      rtcMaxPort,
    });

    worker.on('died', (error) => {
      console.error(`[mediasoup] Worker ${i} died:`, error);
      // In production, you might want to restart the worker
      setTimeout(() => process.exit(1), 2000);
    });

    const router = await worker.createRouter({ mediaCodecs });

    workers.push({ worker, router, index: i });
    console.info(`[mediasoup] Worker ${i} ready (pid: ${worker.pid})`);
  }
}

/**
 * Round-robin worker selection for load distribution.
 */
export function getNextWorker(): WorkerEntry {
  if (workers.length === 0) {
    throw new Error('No mediasoup workers available. Call initializeWorkers() first.');
  }
  const entry = workers[nextWorkerIdx];
  nextWorkerIdx = (nextWorkerIdx + 1) % workers.length;
  return entry;
}

/**
 * Get a specific worker's router by index.
 */
export function getRouter(workerIndex: number): mediasoupTypes.Router {
  const entry = workers[workerIndex];
  if (!entry) {
    throw new Error(`Worker ${workerIndex} not found`);
  }
  return entry.router;
}

/**
 * Get the first available router (for client capability queries).
 */
export function getDefaultRouter(): mediasoupTypes.Router {
  if (workers.length === 0) {
    throw new Error('No mediasoup workers available');
  }
  return workers[0].router;
}

/**
 * Get all workers (for cleanup).
 */
export function getAllWorkers(): WorkerEntry[] {
  return workers;
}
