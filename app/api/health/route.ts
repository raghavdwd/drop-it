/*
 * Health Check API — /api/health
 * ===============================
 * A simple endpoint that returns a JSON response to confirm the server is
 * running. Useful for:
 *   - Deployment health probes (e.g. Docker HEALTHCHECK, Kubernetes liveness).
 *   - Monitoring / uptime checks.
 *   - Quick debugging ("is the app alive?").
 *
 * Next.js App Router handles route.ts files as API routes automatically.
 * The GET export maps to HTTP GET requests to /api/health.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(), // ISO 8601 format for easy parsing
  });
}