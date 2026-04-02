import type { AlertType, Severity } from '@hostel-monitor/types';

/**
 * ML integration point — implemented by ML engineer.
 * Call POST /api/alerts/ml with x-api-key header.
 */
export interface MLAlertRequest {
  /** The ID of the camera where the event was detected */
  cameraId: string;
  /** The type of event detected */
  alertType: AlertType;
  /** Event severity. Defaults to HIGH if not specified. */
  severity?: Severity;
  /** Optional natural text description of what was detected */
  description: string;
  /** Optional base64 encoded JPEG thumbnail of the detected frame */
  thumbnail?: string;
}

export interface MLAlertResponse {
  ok: boolean;
  alertId?: string;
  error?: string;
}
