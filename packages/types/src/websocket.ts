// ============================================
// WebSocket Message Types for mediasoup SFU
// ============================================

/** Union of all WebSocket message types for SFU signaling + app events */
export type WSMessageType =
  | 'GET_ROUTER_RTP_CAPABILITIES'
  | 'ROUTER_RTP_CAPABILITIES'
  | 'CREATE_RECV_TRANSPORT'
  | 'RECV_TRANSPORT_CREATED'
  | 'CONNECT_RECV_TRANSPORT'
  | 'RECV_TRANSPORT_CONNECTED'
  | 'CONSUME'
  | 'CONSUMED'
  | 'RESUME_CONSUMER'
  | 'PRODUCER_ADDED'
  | 'PRODUCER_REMOVED'
  | 'JOIN_FLOOR'
  | 'LEAVE_FLOOR'
  | 'JOIN_HOSTEL'
  | 'ALERT'
  | 'CAMERA_STATUS'
  | 'PING'
  | 'PONG'
  | 'ERROR';

/** Generic WebSocket message envelope */
export interface WSMessage<T = unknown> {
  type: WSMessageType;
  /** Optional correlation ID for request/response matching */
  id?: string;
  payload: T;
  timestamp: number;
}

// ============================================
// Payload Interfaces
// ============================================

/** GET_ROUTER_RTP_CAPABILITIES — client requests router capabilities */
export interface GetRouterRtpCapabilitiesPayload {}

/** ROUTER_RTP_CAPABILITIES — server responds with capabilities */
export interface RouterRtpCapabilitiesPayload {
  rtpCapabilities: Record<string, unknown>;
}

/** CREATE_RECV_TRANSPORT — client requests a receiving transport */
export interface CreateRecvTransportPayload {}

/** RECV_TRANSPORT_CREATED — server responds with transport params */
export interface RecvTransportCreatedPayload {
  transportId: string;
  iceParameters: Record<string, unknown>;
  iceCandidates: Record<string, unknown>[];
  dtlsParameters: Record<string, unknown>;
}

/** CONNECT_RECV_TRANSPORT — client sends DTLS params to connect */
export interface ConnectRecvTransportPayload {
  transportId: string;
  dtlsParameters: Record<string, unknown>;
}

/** RECV_TRANSPORT_CONNECTED — server confirms transport connected */
export interface RecvTransportConnectedPayload {
  transportId: string;
}

/** CONSUME — client requests to consume a specific producer */
export interface ConsumePayload {
  producerId: string;
  transportId: string;
  rtpCapabilities: Record<string, unknown>;
}

/** CONSUMED — server responds with consumer params */
export interface ConsumedPayload {
  consumerId: string;
  producerId: string;
  kind: 'video';
  rtpParameters: Record<string, unknown>;
  cameraId: string;
}

/** PRODUCER_ADDED — server notifies a new camera stream is available */
export interface ProducerAddedPayload {
  producerId: string;
  cameraId: string;
  cameraLabel: string;
  hostelId: string;
  floorNumber: number;
}

/** PRODUCER_REMOVED — server notifies a camera stream went offline */
export interface ProducerRemovedPayload {
  producerId: string;
  cameraId: string;
}

/** RESUME_CONSUMER — client tells server to resume a paused consumer */
export interface ResumeConsumerPayload {
  consumerId: string;
}

/** JOIN_FLOOR — client subscribes to a specific floor's events */
export interface JoinFloorPayload {
  hostelId: string;
  floorNumber: number;
}

/** LEAVE_FLOOR — client unsubscribes from a floor */
export interface LeaveFloorPayload {
  hostelId: string;
  floorNumber: number;
}

/** JOIN_HOSTEL — client subscribes to hostel-level events */
export interface JoinHostelPayload {
  hostelId: string;
}

/** ALERT — pushed from server when ML detects an incident */
export interface AlertPayload {
  alertId: string;
  cameraId: string;
  cameraLabel: string;
  hostelId: string;
  floorNumber: number;
  alertType: AlertType;
  severity: Severity;
  description: string;
  thumbnail?: string;
  posX: number;
  posY: number;
}

/** CAMERA_STATUS — pushed from server on camera on/offline change */
export interface CameraStatusPayload {
  cameraId: string;
  isOnline: boolean;
}

/** PING — client sends keepalive */
export interface PingPayload {}

/** PONG — server responds to keepalive */
export interface PongPayload {}

/** ERROR — server sends error */
export interface ErrorPayload {
  message: string;
  code?: string;
}

// ============================================
// Shared Enums (mirroring Prisma)
// ============================================

export type AlertType =
  | 'FIGHT'
  | 'LIQUOR'
  | 'SMOKING'
  | 'ANIMAL_MONKEY'
  | 'ANIMAL_DOG'
  | 'UNAUTHORIZED_PERSON'
  | 'WEAPON';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Role = 'SUPER_ADMIN' | 'WARDEN' | 'SECURITY';

/** Emoji mapping for alert types */
export const ALERT_TYPE_EMOJI: Record<AlertType, string> = {
  FIGHT: '👊',
  LIQUOR: '🍺',
  SMOKING: '🚬',
  ANIMAL_MONKEY: '🐒',
  ANIMAL_DOG: '🐕',
  UNAUTHORIZED_PERSON: '🚷',
  WEAPON: '🔫',
};

/** Human-readable labels for alert types */
export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  FIGHT: 'Fight Detected',
  LIQUOR: 'Liquor Detected',
  SMOKING: 'Smoking Detected',
  ANIMAL_MONKEY: 'Monkey Spotted',
  ANIMAL_DOG: 'Dog Spotted',
  UNAUTHORIZED_PERSON: 'Unauthorized Person',
  WEAPON: 'Weapon Detected',
};

/** Severity color mapping */
export const SEVERITY_COLOR: Record<Severity, string> = {
  LOW: '#6b7280',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
  CRITICAL: '#dc2626',
};
