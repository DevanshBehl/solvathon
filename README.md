# Hostel Monitoring System

A production-grade scalable monorepo for intelligent hostel surveillance, leveraging the mediasoup component architecture and an independent ML inference mechanism.

## System Architecture

This project is a Turborepo monorepo encompassing the following elements:
- `apps/web`: Next.js 14 application providing the command center UI and the authentication framework.
- `apps/media-server`: Node.js mediasoup application functioning as the SFU and maintaining the WebSocket communication channels and Redis integration.
- `packages/db`: A shared Prisma ORM providing access to the PostgreSQL database for the other packages.
- `packages/config`: Defines universally applicable configurations across packages like the styling theme.
- `packages/types`: The domain level definitions.
- `packages/ui`: The presentation layer containing common react elements.

## Installation and Setup

### Prerequisites

You need the following installed:
- Node.js (v18+)
- PostgreSQL
- Redis
- C++ build tools (required for compiling the mediasoup native add-on)
- FFmpeg (required for ingesting RTSP camera streams into mediasoup)

### Initial Setup

1.  **Clone and Install:**
    ```bash
    git clone https://github.com/your-username/hostel-monitor.git
    cd hostel-monitor
    npm install
    ```

2.  **Environment Variables:**
    Copy the sample configuration file and populate the actual database URLs.
    ```bash
    cp .env.example .env
    ```
    *Critical Note on `ANNOUNCED_IP`:* Edit `.env` and set `ANNOUNCED_IP` to the IP address from which your browser will access the server. For local development, this is usually your machine's LAN IP address (e.g., `192.168.1.100`), unless you're accessing `localhost` exclusively from the same machine, in which case `127.0.0.1` works. mediasoup requires this to establish WebRTC media channels.

3.  **Database Seeding:**
    Initialize the database with the schema and populate it with sample hostels and camera nodes.
    ```bash
    npm run db:push
    npm run db:seed
    ```

4.  **Running the System:**
    Use Turborepo to initiate all services concurrently:
    ```bash
    npm run dev
    ```

## ML Integration Guide

The system offers a centralized webhook where your ML Inference pipeline should push detected anomalies. The API accepts a specific structured payload:

*Endpoint:* `POST {NEXTAUTH_URL}/api/alerts/ml`
*Authentication:* Requires an `x-api-key` header corresponding to the `ML_API_KEY` set in your `.env`.

*Payload Definition:*
See `apps/web/lib/ml-interface.ts` for the exact TypeScript typings. Here's a JSON structure example:

```json
{
  "cameraId": "cuid_of_camera",
  "alertType": "FIGHT",
  "severity": "CRITICAL",
  "description": "Two individuals tracked engaging in physical altercation.",
  "thumbnail": "base64_encoded_jpeg_string"
}
```

The system automatically resolves camera positioning context from the database and uses the internal Redis pub-sub mechanism to instantly update the client-side displays via WebSockets.

## Adding Cameras

Camera feeds are emulated in the initial seed data. To add actual network cameras, you need to alter the database containing the RTSP URLs.
1. Sign into the application.
2. Edit a camera object either through a script communicating with the Prisma ORM or directly in the database. Provide the correct `rtspUrl`.

The mediasoup `media-server` dynamically spins up `ffmpeg` ingest mechanisms. The system expects H.264 / VP8 encoded streams inside the RTSP transport. The default system configuration automatically deciphers the source streams and prepares them for browser WebRTC delivery.
