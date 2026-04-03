// ============================================
// PlainTransport Ingest — FFmpeg → mediasoup
// ============================================
// For each RTSP camera, spawns an FFmpeg process that converts
// the RTSP stream to VP8 RTP and feeds it into mediasoup via
// a PlainTransport. comedia: true lets mediasoup auto-detect
// FFmpeg's source port without manual configuration.
// ============================================

import { spawn, type ChildProcess } from 'child_process';
import type { types as mediasoupTypes } from 'mediasoup';
import { getNextWorker, getRouter } from './workers';

interface ProducerEntry {
  producer: mediasoupTypes.Producer;
  workerId: number;
  transportId: string;
  transport: mediasoupTypes.Transport;
  ffmpegProcess?: ChildProcess | null;
  consumerCount: number;
  autoStopTimer?: NodeJS.Timeout | null;
  retryCount?: number;
}

interface CameraInfo {
  id: string;
  label: string;
  rtspUrl: string;
  floorId: string;
}

/** Global map of active producers by camera ID */
export const producerMap = new Map<string, ProducerEntry>();

/** Auto-stop delay: 45 seconds of zero consumers */
const AUTO_STOP_DELAY_MS = 45_000;
/** Maximum retry attempts for FFmpeg reconnection */
const MAX_RETRIES = 3;
/** Retry delay: 5 seconds */
const RETRY_DELAY_MS = 5_000;

/**
 * Start ingesting an RTSP camera feed into mediasoup.
 * Creates a PlainTransport with comedia, spawns FFmpeg to pipe RTP into it.
 */
export async function startCameraIngest(camera: CameraInfo): Promise<ProducerEntry | null> {
  // If already ingesting, return existing entry
  if (producerMap.has(camera.id)) {
    console.info(`[ingest] Camera ${camera.label} already ingesting, skipping`);
    return producerMap.get(camera.id)!;
  }

  console.info(`[ingest] Starting ingest for ${camera.label} (${camera.rtspUrl})`);

  try {
    // Pick next available worker via round-robin
    const workerEntry = getNextWorker();
    const router = getRouter(workerEntry.index);

    // Create PlainTransport with comedia: true
    // comedia allows mediasoup to learn FFmpeg's RTP source port dynamically
    const transport = await router.createPlainTransport({
      listenIp: { ip: '127.0.0.1' },
      rtcpMux: false,
      comedia: true,
    });

    // Create Producer for VP8 video
    const producer = await transport.produce({
      kind: 'video',
      rtpParameters: {
        codecs: [
          {
            mimeType: 'video/VP8',
            payloadType: 96,
            clockRate: 90000,
          },
        ],
        encodings: [{ ssrc: 11111111 }],
      },
    });

    const entry: ProducerEntry = {
      producer,
      workerId: workerEntry.index,
      transportId: transport.id,
      transport,
      ffmpegProcess: null,
      consumerCount: 0,
      autoStopTimer: null,
      retryCount: 0,
    };

    producerMap.set(camera.id, entry);

    // Spawn FFmpeg to convert RTSP → VP8 RTP
    spawnFFmpeg(camera, entry, transport.tuple.localPort);

    return entry;
  } catch (error) {
    console.error(`[ingest] Failed to start ingest for ${camera.label}:`, error);
    return null;
  }
}

/**
 * Spawn FFmpeg process that pipes RTSP into mediasoup PlainTransport.
 */
function spawnFFmpeg(camera: CameraInfo, entry: ProducerEntry, rtpPort: number): void {
  const args = [
    '-rtsp_transport', 'tcp',
    '-i', camera.rtspUrl,
    '-an',                    // No audio
    '-vcodec', 'libvpx',      // VP8 encoder
    '-b:v', '800k',           // Bitrate
    '-r', '15',               // 15 fps
    '-f', 'rtp',              // RTP output
    '-payload_type', '96',
    '-ssrc', '11111111',
    `rtp://127.0.0.1:${rtpPort}`,
  ];

  console.info(`[ffmpeg] ${camera.label}: ffmpeg ${args.join(' ')}`);

  const ffmpeg = spawn('ffmpeg', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  entry.ffmpegProcess = ffmpeg;

  // Log FFmpeg stderr output (prefixed with camera label)
  ffmpeg.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.includes('Error') || line.includes('error')) {
        console.error(`[ffmpeg] ${camera.label}: ${line}`);
      }
    }
  });

  // Handle FFmpeg process exit
  ffmpeg.on('exit', (code, signal) => {
    console.info(`[ffmpeg] ${camera.label} exited (code=${code}, signal=${signal})`);
    entry.ffmpegProcess = null;

    if (signal === 'SIGTERM') {
      // Intentional stop — clean up
      cleanupProducer(camera.id);
      return;
    }

    // Unexpected exit — retry up to MAX_RETRIES times
    const currentRetries = entry.retryCount || 0;
    if (code !== 0 && currentRetries < MAX_RETRIES) {
      entry.retryCount = currentRetries + 1;
      console.info(`[ffmpeg] ${camera.label}: Retrying (${entry.retryCount}/${MAX_RETRIES}) in ${RETRY_DELAY_MS / 1000}s...`);

      setTimeout(() => {
        if (producerMap.has(camera.id)) {
          spawnFFmpeg(camera, entry, rtpPort);
        }
      }, RETRY_DELAY_MS);
    } else if (currentRetries >= MAX_RETRIES) {
      console.error(`[ffmpeg] ${camera.label}: Max retries exceeded, marking offline`);
      cleanupProducer(camera.id);
      // Here you would update the camera's isOnline status in the DB
    }
  });

  ffmpeg.on('error', (err) => {
    console.error(`[ffmpeg] ${camera.label}: Process error:`, err.message);
  });
}

/**
 * Stop camera ingest — kills FFmpeg, closes producer and transport.
 */
export function stopCameraIngest(cameraId: string): void {
  const entry = producerMap.get(cameraId);
  if (!entry) return;

  console.info(`[ingest] Stopping ingest for camera ${cameraId}`);

  // Kill FFmpeg process
  if (entry.ffmpegProcess && !entry.ffmpegProcess.killed) {
    entry.ffmpegProcess.kill('SIGTERM');
  }

  cleanupProducer(cameraId);
}

/**
 * Clean up producer resources.
 */
function cleanupProducer(cameraId: string): void {
  const entry = producerMap.get(cameraId);
  if (!entry) return;

  // Clear auto-stop timer
  if (entry.autoStopTimer) {
    clearTimeout(entry.autoStopTimer);
  }

  // Close producer and transport
  try {
    entry.producer.close();
    entry.transport.close();
  } catch {
    // Already closed
  }

  producerMap.delete(cameraId);
}

/**
 * Increment consumer count for a camera's producer.
 */
export function incrementConsumerCount(cameraId: string): void {
  const entry = producerMap.get(cameraId);
  if (!entry) return;

  entry.consumerCount++;

  // Cancel auto-stop if it was pending
  if (entry.autoStopTimer) {
    clearTimeout(entry.autoStopTimer);
    entry.autoStopTimer = null;
  }
}

/**
 * Decrement consumer count and start auto-stop timer if zero.
 */
export function decrementConsumerCount(cameraId: string): void {
  const entry = producerMap.get(cameraId);
  if (!entry) return;

  entry.consumerCount = Math.max(0, entry.consumerCount - 1);

  // If no consumers left, start auto-stop timer (45s)
  if (entry.consumerCount === 0 && !entry.autoStopTimer) {
    entry.autoStopTimer = setTimeout(() => {
      const current = producerMap.get(cameraId);
      if (current && current.consumerCount === 0) {
        console.info(`[ingest] Auto-stopping idle camera ${cameraId} (no consumers for ${AUTO_STOP_DELAY_MS / 1000}s)`);
        stopCameraIngest(cameraId);
      }
    }, AUTO_STOP_DELAY_MS);
  }
}

/**
 * Get producer ID for a camera (if active).
 */
export function getProducerId(cameraId: string): string | null {
  const entry = producerMap.get(cameraId);
  return entry ? entry.producer.id : null;
}

/**
 * Get the worker index for a camera's producer.
 */
export function getProducerWorkerId(cameraId: string): number | null {
  const entry = producerMap.get(cameraId);
  return entry ? entry.workerId : null;
}
