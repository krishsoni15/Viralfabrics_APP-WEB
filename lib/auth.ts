import { jwtVerify } from "jose";
import dbConnect from "./dbConnect";
import SystemConfig, { ISystemConfigModel } from "@/models/SystemConfig";

export interface TokenPayload {
  id: string;
  username: string;
  role: string;
  name?: string;
  phoneNumber?: string;
  address?: string;
  partyId?: string;
  iat?: number; // Issued at timestamp
  loginTime?: number; // Original login timestamp (for logout-all check)
}

export async function verifyToken(token: string, checkLogoutAll: boolean = true): Promise<TokenPayload | null> {
  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    
    if (!JWT_SECRET) {
      return null;
    }

    const secretKey = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secretKey);
    
    if (!payload || typeof payload !== "object") {
      return null;
    }

    // Check if token was issued before logout all timestamp
    if (checkLogoutAll) {
      try {
        // ⚡ OPTIMIZATION: Check cache first (avoids database query)
        const { getCachedLogoutAllTimestamp } = await import('@/lib/logoutAllCache');
        let logoutAllTimestamp = getCachedLogoutAllTimestamp();
        
        // If cache miss, fetch from database
        if (logoutAllTimestamp === undefined) {
          await dbConnect();
          logoutAllTimestamp = await (SystemConfig as ISystemConfigModel).getLogoutAllTimestamp();
          
          // Cache the result
          const { setCachedLogoutAllTimestamp } = await import('@/lib/logoutAllCache');
          setCachedLogoutAllTimestamp(logoutAllTimestamp);
        }
        
        if (logoutAllTimestamp) {
          // Use loginTime if available (original login), otherwise use iat (token issue time)
          const loginTime = (payload as any).loginTime ? (payload as any).loginTime * 1000 : (payload.iat ? payload.iat * 1000 : 0);
          const logoutAllTime = logoutAllTimestamp.getTime();
          
          // If original login was before logout all, token is invalid
          if (loginTime < logoutAllTime) {
            return null;
          }
        }
      } catch (error) {
        // If we can't check (database connection issue), allow the token (fail open for availability)
        // This prevents false logouts when database is temporarily unavailable
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('database') || errorMessage.includes('connection') || errorMessage.includes('MongoDB')) {
          // Database connection error - fail open (don't logout)
          console.warn('Could not check logout all timestamp (database error), allowing token:', errorMessage);
        } else {
          // Other errors - still fail open but log
          console.warn('Could not check logout all timestamp:', errorMessage);
        }
      }
    }

    return {
      id: (payload as Record<string, unknown>).id as string,
      username: (payload as Record<string, unknown>).username as string,
      role: (payload as Record<string, unknown>).role as string,
      name: (payload as Record<string, unknown>).name as string | undefined,
      phoneNumber: (payload as Record<string, unknown>).phoneNumber as string | undefined,
      address: (payload as Record<string, unknown>).address as string | undefined,
      partyId: (payload as Record<string, unknown>).partyId as string | undefined,
      iat: payload.iat as number | undefined,
      loginTime: (payload as Record<string, unknown>).loginTime as number | undefined,
    };
  } catch (error) {
    return null;
  }
}
