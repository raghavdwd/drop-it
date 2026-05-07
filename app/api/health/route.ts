import { NextRequest, NextResponse } from "next/server";

/**
 * 
 * @param request - The incoming request object of type NextRequest.
 * @returns A JSON response containing the status "ok" and the current timestamp in ISO format.
 * @description This function handles GET requests to the health endpoint. It returns a JSON response indicating that the service is healthy along with the current timestamp.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}