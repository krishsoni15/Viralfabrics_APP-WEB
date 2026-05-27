import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/lib/session";

/**
 * Debug endpoint to check environment variables
 * 
 * SECURITY: This endpoint is:
 * - Disabled in production by default
 * - Requires superadmin authentication
 * - Only shows whether variables are SET, not their values
 */
export async function GET(req: NextRequest) {
  // SECURITY: Disable in production unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_ENDPOINT !== 'true') {
    return NextResponse.json(
      { success: false, message: 'Debug endpoint is disabled in production' },
      { status: 404 }
    );
  }

  // SECURITY: Require superadmin authentication
  try {
    await requireSuperAdmin(req);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized - Superadmin access required' },
      { status: 403 }
    );
  }

  // Get all environment variables
  const allEnvVars = process.env;
  const envVarKeys = Object.keys(allEnvVars).sort();
  
  // Only show whether critical variables are set, never show values
  const criticalVars: Record<string, string> = {
    MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'NOT SET',
    JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ? 'SET' : 'NOT SET',
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET',
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME ? 'SET' : 'NOT SET',
    S3_REGION: process.env.S3_REGION ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'NOT SET',
  };
  
  return NextResponse.json({
    success: true,
    debug: {
      nodeEnv: process.env.NODE_ENV,
      totalEnvVars: envVarKeys.length,
      criticalVars,
      // Only show non-sensitive env var names in development
      envVarNames: process.env.NODE_ENV === 'development' ? envVarKeys : undefined,
    }
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  });
}
