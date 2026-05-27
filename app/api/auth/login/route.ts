import { NextResponse, type NextRequest } from "next/server"; 
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Log, { ILogModel } from "@/models/Log";
import { logLogin, logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  // Rate limiting removed - allow unlimited login attempts as requested

  // Set a timeout for the entire login process
  const timeoutPromise = new Promise<NextResponse>((_, reject) => {
    setTimeout(() => reject(new Error('Login timeout')), 30000); // 30 seconds timeout - more generous
  });

  try {
    return await Promise.race([
      performLogin(req),
      timeoutPromise
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Login timeout') {
      return NextResponse.json({ message: "Login is taking longer than expected. Please try again." }, { status: 408 });
    }
    // Ensure we always return a proper response
    console.error('Login route error:', error);
    return NextResponse.json({ 
      message: error instanceof Error ? error.message : "Login failed. Please try again." 
    }, { status: 500 });
  }
}

async function performLogin(req: Request) {
  try {
    // Parse request body first with error handling
    let body;
    try {
      const text = await req.text();
      if (!text || text.trim() === '') {
        return NextResponse.json({ message: "Request body is required" }, { status: 400 });
      }
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json({ message: "Invalid request format" }, { status: 400 });
    }
    
    const { username, password, rememberMe } = body;

    if (!username || !password) {
      return NextResponse.json({ message: "Username and password are required" }, { status: 400 });
    }

    // Ultra-fast database connection - single attempt
    try {
      // Connect to database (dbConnect will handle MONGODB_URI validation)
      await dbConnect();
    } catch (error) {
      console.error('Database connection failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ 
        message: `Database connection failed: ${errorMessage}. Please check your MongoDB configuration.` 
      }, { status: 503 });
    }
    
    // ⚡ Optimized user lookup with select
    const user = await User.findOne({
      $or: [
        { username: username.trim() },
        { name: username.trim() }
      ]
    })
    .select('+password role _id name username phoneNumber address createdAt updatedAt failedLoginAttempts accountLocked lockExpiresAt loginCount lastLogin')
    .maxTimeMS(3000); // 3 second timeout - faster

    if (!user) {
      // Log failed login attempt
      logger.warn('Login failed: User not found', {
        username,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      });
      return NextResponse.json({ message: "User not exist" }, { status: 401 });
    }

    // Check if account is locked (non-blocking)
    if (user.accountLocked && user.lockExpiresAt && user.lockExpiresAt > new Date()) {
      logger.warn('Login failed: Account locked', {
        username,
        userId: user._id.toString(),
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      });
      return NextResponse.json({ message: "Account is temporarily locked due to too many failed attempts" }, { status: 423 });
    }

    // ⚡ Verify password (fast)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Record failed login attempt in background - don't wait
      User.findByIdAndUpdate(user._id, {
        $inc: { failedLoginAttempts: 1 }
      }).maxTimeMS(2000).catch(() => {});
      logger.warn('Login failed: Invalid password', {
        username,
        userId: user._id.toString(),
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      });
      return NextResponse.json({ message: "Wrong password" }, { status: 401 });
    }

    // Prepare JWT token and user data in parallel
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('JWT_SECRET is not configured in environment variables');
      return NextResponse.json({ 
        message: "Server misconfiguration: JWT_SECRET is not set. Please configure environment variables." 
      }, { status: 500 });
    }

    const secretKey = new TextEncoder().encode(JWT_SECRET);
    // Session duration: 7 days default, 30 days with "Remember Me"
    const expirationTime = rememberMe ? "30d" : "7d";
    
    // Create JWT token with original login time for logout-all checking
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const token = await new SignJWT({ 
      id: user._id.toString(), 
      role: user.role,
      username: user.username || user.name,
      name: user.name,
      loginTime: now // Store original login time for logout-all checking
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(expirationTime)
      .sign(secretKey);

    // Prepare user object without password
    const userSafe = {
      _id: user._id,
      name: user.name,
      username: user.username,
      phoneNumber: user.phoneNumber,
      address: user.address,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Start all background tasks in parallel - don't wait for any
    Promise.all([
      // Reset failed login attempts - reasonable timeout
      User.findByIdAndUpdate(user._id, {
        $inc: { loginCount: 1 },
        $set: { 
          lastLogin: new Date(),
          failedLoginAttempts: 0,
          accountLocked: false
        },
        $unset: { lockExpiresAt: 1 }
      }).maxTimeMS(3000), // 3 second timeout - more reasonable
      // Log successful login - non-blocking
      (Log as ILogModel).logUserAction({
        userId: user._id.toString(),
        username: user.username || user.name,
        userRole: user.role,
        action: 'login',
        resource: 'auth',
        details: {
          username: user.username || user.name,
          userId: user._id.toString()
        },
        success: true,
        severity: 'info',
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown'
      }).catch(() => {}) // Silent fail for logging
    ]).catch(() => {}); // Silent fail for all background tasks
    
    // ⚡ CRITICAL: Ensure token and user are valid before creating response
    if (!token || !userSafe || !userSafe._id) {
      console.error('Invalid token or user data:', { hasToken: !!token, hasUser: !!userSafe, userId: userSafe?._id });
      return NextResponse.json({ 
        message: "Failed to generate authentication token. Please try again." 
      }, { status: 500 });
    }
    
    // Create response with token and user data
    const response = NextResponse.json({ 
      token, 
      user: userSafe 
    }, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    // Set token in httpOnly cookie for middleware access
    // This ensures middleware can validate the token on page navigation
    try {
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60, // 30 days or 7 days
        path: '/',
      });
    } catch (cookieError) {
      console.error('Failed to set auth cookie:', cookieError);
      // Continue anyway - token is still in response body
    }
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    
    // Provide more specific error messages
    let errorMessage = "Login failed. Please try again.";
    let statusCode = 500;
    
    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('JWT_SECRET') || error.message.includes('misconfiguration')) {
        errorMessage = "Server misconfiguration. Please contact support.";
        statusCode = 500;
      } else if (error.message.includes('database') || error.message.includes('connection')) {
        errorMessage = "Database connection failed. Please try again.";
        statusCode = 503;
      } else if (error.message.includes('timeout')) {
        errorMessage = "Request timeout. Please try again.";
        statusCode = 408;
      } else {
        errorMessage = error.message || errorMessage;
      }
    }
    
    return NextResponse.json({ message: errorMessage }, { status: statusCode });
  }
}
