# Hostel Monitoring System - Live Video Routing & Architecture

This document provides an in-depth technical breakdown of the recent changes and architectural design of the **Hostel Monitor Live Feed System**. The system integrates a brutalist Next.js Dashboard with a custom Node.js/Mediasoup SFU (Selective Forwarding Unit) to stream multiple concurrent camera feeds onto highly specific interactive XY coordinates of a hostel floor map.

---

## 1. Core Objectives & Context

The goal of these modifications was to finalize a state-of-the-art WebRTC video streaming infrastructure designed for an enterprise-level SaaS monitoring dashboard. Constraints included:
1. **Hardware limitations during development**: We do not possess 50+ localized active RTSP cameras. 
2. **The "Proxy" Requirement**: We needed a mechanism to activate a laptop's local webcam on the "Global Dashboard" and trick the backend into assigning this single active feed to a specific physical Database Camera (e.g., `Cam A-101` on Floor 1).
3. **Localized Area Streaming**: Clients viewing Floor 1 should only establish WebRTC consumers for cameras strictly physically located on Floor 1, minimizing bandwidth overhead.

---

## 2. WebRTC IP Networking Setup

To allow cross-device WebRTC testing over a local network (e.g., streaming from Laptop A to Laptop B), strict network bindings were implemented.

### Environment Variable Requirements
**File:** `apps/media-server/.env` & `apps/web/.env`
```env
# The external LAN IP that the signaling server binds to
# Mediasoup strictly requires this physical IP to establish the UDP punch-through for WebRTC.
ANNOUNCED_IP="10.226.171.77"

# Must perfectly mirror the physical IP so the Next.js client knows where to connect
NEXT_PUBLIC_MEDIA_SERVER_WS_URL="ws://10.226.171.77:4000"
```
**Important Security Context**: Web browser constraints dictate that `navigator.mediaDevices.getUserMedia` (the API required to run the "Broadcast Node") ONLY fires in a Secure Context. This means the client *must* access the Next.js app via `localhost`, `127.0.0.1`, or over HTTPS. If accessed directly via `http://10.226.171.77:3000` from an external device, the webcam capture hook will fail. As such, the local ingest machine strictly uses `localhost`, while receiver-viewers can connect via the local IP.

---

## 3. The Proxy Mechanism: Webcam-to-Physical Map Logic

This is arguably the most complex logic added to the application. It acts as a bridge between the "System Ingest" and the "Web Viewers."

**File:** `apps/media-server/src/signaling/ws-server.ts`

When the server initializes and a camera broadcast is generated, the backend executes the following mapping pipeline:

1. **DB Hydration**: `ensureCameraQueueLoaded()` queries MongoDB for every `Hostel` → `Floor` → `Camera` and creates a flat sequence queue `cameraAssignmentQueue[]`.
2. **Intercepting `PRODUCE`**: When a browser client hits "Initialize Webcam", the SFU creates a raw Video track under a temporary `laptop_{clientId}` ID.
3. **The Duplication Hack**: Instead of routing the laptop camera natively, the signaling server polls the queue:
    ```typescript
    const assignedCam = cameraAssignmentQueue[nextCameraSlot % cameraAssignmentQueue.length];
    
    // Register the WebRTC producer again entirely masked under the physical camera's ID
    producerMap.set(assignedCam.id, {
      producer, // the exact same memory reference to the laptop's Producer
      workerId: client.workerIndex || 0,
      transportId: ...,
      consumerCount: 0,
    });
    ```
4. **Targeted Floor Broadcast**: The socket server specifically routes a `PRODUCER_ADDED` payload targeting the exact `assignedCam.floorNumber` and `assignedCam.hostelId`, convincing any client currently viewing that floor that "Cam A-101" just came online.

---

## 4. WebRTC Front-End Synchronization Pipeline

To make the UI feel reactive and prevent browser freezing, the stream decoding happens through heavily detached React Hooks that orchestrate the SFU handshake.

**File:** `apps/web/hooks/useSFU.ts`
The sequence runs as follows for a viewer joining a floor:
1. **Capabilities Exchange**: `GET_ROUTER_RTP_CAPABILITIES` (Client learns the server's VP8 architecture).
2. **Transport Creation**: `CREATE_RECV_TRANSPORT` -> Client establishes a single bundled DTLS WebRtcTransport instance for the entire floor map.
3. **The Subscribe Loop**: The WebSocket sends `JOIN_FLOOR: { hostelId: 'A', floorNumber: 1 }`. 
4. **Event Intake**: The signaling server pumps down `{ type: 'PRODUCER_ADDED', payload: { producerId, cameraId } }`.
5. **Consumption Matrix**:
    ```typescript
    const params = await request('CONSUME', { producerId, transportId });
    const consumer = await transport.consume({ id: params.consumerId, ... });
    ```
    This actively routes the multiplexed RTP streams into physical `MediaStreamTrack` entities stored in a React Map: `tracks.get(cameraId)`.

---

## 5. UI Implementation & Brutalist Aesthetics

**File:** `apps/web/app/hostel/[hostelId]/floor/[floorNumber]/page.tsx`

The layout is structurally separated into three domains to ensure high performance constraints without DOM re-paints.

*   **Tactical Map Overlay (`SVG`)**: Cameras are layered over the root `<img>` layout utilizing normalized `posX` and `posY` percentage coordinates ensuring consistent rendering regardless of screen size. The nodes execute `AnimatePresence` pinging to highlight Critical Alert thresholds (`bg-alert-red` vs `bg-online-green`).
*   **Live Grid Box**: `useSFU` isolates the `tracks` map array, mounting an iterative block of `<CameraFeedCard>` elements. Each card takes a direct `<video autoPlay inline muted srcObject={new MediaStream([track])}>` reference.
*   **Connection Resilience**: If the laptop producer fails or ffmpeg is not successfully installed (`ENOENT`), the UI prevents crashing and gracefully renders the static "Slot — Awaiting / Connecting..." dashed UI grid.

### FFmpeg Fallback Engine
**File:** `apps/media-server/src/mediasoup/ingest.ts`
When an actual client goes to a Floor Map and a given camera hasn't been "overridden" by a laptop feed, the server natively tries to pull real data from its `rtspUrl`. It spawns a background `child_process` bound to `ffmpeg` that translates `RTSP TCP` into raw `VP8 RTP` bytes pushed straight into mediasoup. Note: This mandates that `$ brew install ffmpeg` is present natively on the operating environment.
