import { NextRequest } from 'next/server';
import { verifyToken, TokenPayload } from '@/lib/auth';
import { SignJWT } from "jose";
import { unauthorized } from '@/lib/http';
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized('No token provided');
    }

    const token = authHeader.substring(7);
    
    // Verify the current token (check logout all timestamp)
    const decoded = await verifyToken(token, true) as TokenPayload;
    
    if (!decoded) {
      return unauthorized('Invalid token or session expired');
    }

    // Get the user to ensure they still exist
    const user = await User.findById(decoded.id).select('_id username name role');
    if (!user) {
      return unauthorized('User not found');
    }

    // Create a new token with extended expiration
    // IMPORTANT: Preserve the original loginTime from the old token for logout-all checking
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return new Response(JSON.stringify({ message: "Server misconfiguration" }), { status: 500 });
    }

    const secretKey = new TextEncoder().encode(JWT_SECRET);
    const expirationTime = "30d"; // Extended session - 30 days
    const newToken = await new SignJWT({ 
      id: user._id.toString(), 
      role: user.role,
      username: user.username || user.name,
      name: user.name,
      loginTime: decoded.loginTime || decoded.iat || Math.floor(Date.now() / 1000) // Preserve original login time
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(expirationTime) // Extended session - 30 days
      .sign(secretKey);

    // Decode token to get expiration time
    let exp = 0;
    try {
      const tokenParts = newToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        exp = payload.exp;
      }
    } catch (e) {
      // If we can't decode, calculate approximate expiration (30 days from now)
      exp = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
    }

    // Return the new token with expiration time
    return new Response(JSON.stringify({
      success: true,
      token: newToken,
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        exp: exp // Include expiration time
      }
    }), { 
      status: 200, 
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    return unauthorized('Session refresh failed');
  }
}
