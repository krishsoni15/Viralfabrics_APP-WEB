import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Party from "@/models/Party";
import { requireSuperAdmin, getSession } from "@/lib/session";
import bcrypt from "bcryptjs";
import { type NextRequest } from "next/server";
import { logCreate } from "@/lib/logger";
import { apiRateLimiter, writeRateLimiter, checkRateLimitOrError } from "@/lib/rateLimit";

// Professional in-memory cache for users data
export const usersCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for better performance

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Rate limiting check
    const rateLimitError = await checkRateLimitOrError(req, apiRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Log the session info
    const session = await getSession(req);
    console.log("DEBUG: GET /api/users session:", session);

    // Require superadmin access
    await requireSuperAdmin(req);

    // Check cache first
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25'), 1), 100); // Enforce max 100
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1); // Enforce min page 1
    const cacheKey = `users-${limit}-${page}-${session?.role}`;
    
    const cached = usersCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return new Response(JSON.stringify({
        success: true,
        data: cached.data,
        message: 'Users loaded from cache'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          'X-Cache': 'HIT',
          'X-Response-Time': `${Date.now() - startTime}ms`
        }
      });
    }

    await dbConnect();
    
    const skip = (page - 1) * limit;
    
    const query = session?.role === 'master' ? {} : { role: { $ne: 'master' } };

    // Super simple and fast query - no complex operations
    // ⚡ SECURITY: Exclude master users from the list only if requested by non-master account
    const users = await User.find(query, {
      _id: 1,
      name: 1,
      username: 1,
      phoneNumber: 1,
      address: 1,
      role: 1,
      isActive: 1,
      partyId: 1,
      createdAt: 1
    })
    .populate('partyId', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean()
    .maxTimeMS(3000); // 3 second timeout to prevent timeouts
    
    // Simple count - exclude master role if not requested by master
    const totalCount = await User.countDocuments(query).maxTimeMS(3000);

    // No need to map since we're already selecting only needed fields

    // Minimal headers for speed
    const headers = {
      'Content-Type': 'application/json',
    };

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    
    const responseData = {
      users,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount,
        limit: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };

    // Update cache
    usersCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });
    
    return new Response(JSON.stringify({
      success: true,
      data: responseData,
      message: 'Users fetched successfully'
    }), { 
      status: 200, 
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'X-Cache': 'MISS',
        'X-Response-Time': `${Date.now() - startTime}ms`
      }
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return new Response(JSON.stringify({ 
          success: false,
          message: "Unauthorized" 
        }), { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return new Response(JSON.stringify({ 
          success: false,
          message: "Access denied - Superadmin access required" 
        }), { status: 403 });
      }
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ 
      success: false,
      message 
    }), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting check for write operations
    const rateLimitError = await checkRateLimitOrError(req, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    const session = await requireSuperAdmin(req);

    const { name, username, password, role: newUserRole, phoneNumber, address, partyId } = await req.json();

    // Validation
    const errors: string[] = [];
    
    if (!name || !name.trim()) {
      errors.push("Name is required");
    }
    
    if (!username || !username.trim()) {
      errors.push("Username is required");
    }
    
    // No password validation restrictions - user can set any password
    if (!password) {
      errors.push("Password is required");
    }
    
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ success: false, message: errors.join(", ") }), 
        { status: 400 }
      );
    }

    await dbConnect();

    const existing = await User.findOne({ username: username.trim() });
    if (existing) {
      return new Response(JSON.stringify({ message: "Username already exists" }), { status: 400 });
    }

    // Determine final role to be saved
    let targetRole = "user";
    if (newUserRole === "superadmin") {
      targetRole = "superadmin";
    } else if (newUserRole === "admin") {
      targetRole = "admin";
    } else if (newUserRole === "party") {
      targetRole = "party";
    } else if (newUserRole === "master" && session.role === "master") {
      targetRole = "master";
    }

    // Don't hash password here - let the User model pre-save middleware handle it
    const userData: Record<string, any> = {
      name: name.trim(),
      username: username.trim(),
      password: password, // Plain password - will be hashed by model middleware
      role: targetRole,
      phoneNumber: phoneNumber ? phoneNumber.trim() : undefined,
      address: address ? address.trim() : undefined,
    };

    if (targetRole === "party" && partyId) {
      userData.partyId = partyId;
    }
    
    const created = await User.create(userData);

    const userSafe = {
      _id: created._id,
      name: created.name,
      username: created.username,
      phoneNumber: created.phoneNumber,
      address: created.address,
      role: created.role,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };

    // Log user creation
    await logCreate('user', created._id.toString(), { username: created.username, role: created.role }, req);

    // Clear in-memory users cache
    usersCache.clear();

    // ⚡ FIX: Properly invalidate Next.js cache
    const { revalidateTag, revalidatePath } = await import('next/cache');
    revalidateTag('users');
    revalidatePath('/users');

    return new Response(JSON.stringify({ message: "User created", user: userSafe }), { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return new Response(JSON.stringify({ message: "Access denied - Superadmin access required" }), { status: 403 });
      }
      // Handle MongoDB duplicate key errors
      if (error.message.includes('E11000')) {
        if (error.message.includes('username')) {
          return new Response(
            JSON.stringify({ message: "Username already exists" }), 
            { status: 400 }
          );
        }
      }
    }
    
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ message }), { status: 500 });
  }
}
