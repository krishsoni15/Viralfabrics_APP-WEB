import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { requireSuperAdmin } from "@/lib/session";
import bcrypt from "bcryptjs";
import { type NextRequest } from "next/server";
import { logUpdate, logDelete } from "@/lib/logger";
import { usersCache as usersCacheNormal } from "../route";
import { usersCache as usersCacheInstant } from "../../users-instant/route";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require superadmin access
    const session = await requireSuperAdmin(req);
    await dbConnect();
    const { id } = await params;
    
    // Validate ID
    if (!id || id === 'undefined' || id === 'null') {
      return new Response(
        JSON.stringify({ 
          message: "Invalid user ID provided" 
        }), 
        { status: 400 }
      );
    }
    
    // Check if password should be included (for editing)
    const { searchParams } = new URL(req.url);
    const includePassword = searchParams.get('includePassword') === 'true';
    
    const user = includePassword 
      ? await User.findById(id) // Include password for editing
      : await User.findById(id).select("-password"); // Exclude password for normal requests
    
    if (!user) return new Response("Not found", { status: 404 });
    
    // ⚡ SECURITY: Block non-master users from accessing master user details
    if (user.role === 'master' && session.role !== 'master') {
      return new Response(JSON.stringify({ message: "Access denied" }), { status: 403 });
    }
    
    // If password is included, return it (it will be hashed)
    const userData = user.toObject ? user.toObject() : user;
    return new Response(JSON.stringify(userData), { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return new Response(JSON.stringify({ message: "Access denied - Superadmin access required" }), { status: 403 });
      }
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ message }), { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require superadmin access
    const session = await requireSuperAdmin(req);

    const { name, username, password, role, phoneNumber, address, partyId } = await req.json();
    
    // Validation
    const errors: string[] = [];
    
    if (typeof name === "string" && !name.trim()) {
      errors.push("Name is required");
    }
    
    if (typeof username === "string" && !username.trim()) {
      errors.push("Username is required");
    }
    
    // No password validation restrictions - user can set any password
    
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ message: errors.join(", ") }), 
        { status: 400 }
      );
    }

    await dbConnect();
    const { id } = await params;
    
    // Validate ID
    if (!id || id === 'undefined' || id === 'null') {
      return new Response(
        JSON.stringify({ 
          message: "Invalid user ID provided" 
        }), 
        { status: 400 }
      );
    }
    
    // ⚡ SECURITY: Block non-master users from editing master user
    const targetUser = await User.findById(id).select('role').lean();
    if (targetUser && targetUser.role === 'master' && session.role !== 'master') {
      return new Response(JSON.stringify({ message: "Access denied - Cannot edit master account" }), { status: 403 });
    }
    
    // Check if username already exists (excluding current user)
    if (typeof username === "string" && username.trim()) {
      const existingUser = await User.findOne({ 
        username: username.trim(), 
        _id: { $ne: id } 
      });
      
      if (existingUser) {
        return new Response(
          JSON.stringify({ message: "Username already exists" }), 
          { status: 400 }
        );
      }
    }
    
    const update: Record<string, unknown> = {};
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (typeof username === "string" && username.trim()) update.username = username.trim();
    if (role === "user" || role === "admin" || role === "superadmin" || role === "party") {
      update.role = role;
    }
    // Handle partyId settings
    if (role === "party") {
      update.partyId = partyId || null;
    } else if (role) {
      update.partyId = null; // Clear partyId if the role changed to something else
    }
    // Only master can assign master role (privilege escalation prevention)
    if (role === "master" && session.role === "master") update.role = role;
    if (typeof phoneNumber === "string") update.phoneNumber = phoneNumber.trim();
    if (typeof address === "string") update.address = address.trim();
    if (typeof password === "string" && password.length > 0) {
      update.password = await bcrypt.hash(password, 10);
    }

    const updated = await User.findByIdAndUpdate(id, update, { new: true })
      .select("-password");
    if (!updated) return new Response("Not found", { status: 404 });
    
    // Log the user update
    await logUpdate('user', id, update, updated.toObject(), req);
    
    // Clear in-memory caches
    usersCacheNormal.clear();
    usersCacheInstant.clear();

    // ⚡ FIX: Properly invalidate Next.js cache
    const { revalidateTag, revalidatePath } = await import('next/cache');
    revalidateTag('users');
    revalidateTag(`user-${id}`);
    revalidatePath('/users');
    
    return new Response(JSON.stringify({ message: "User updated", user: updated }), { status: 200 });
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require master access - only master can delete users
    const { requireMaster } = await import('@/lib/session');
    const session = await requireMaster(req);
    
    const { id } = await params;
    
    // Validate ID
    if (!id || id === 'undefined' || id === 'null') {
      return new Response(
        JSON.stringify({ 
          message: "Invalid user ID provided" 
        }), 
        { status: 400 }
      );
    }
    
    // Prevent self-deletion
    if (session.id === id) {
      return new Response(
        JSON.stringify({ 
          message: "Cannot delete your own account. This would lock you out of the system." 
        }), 
        { status: 400 }
      );
    }
    
    await dbConnect();
    
    // ⚡ SECURITY: Block deleting master accounts entirely
    const targetUser = await User.findById(id).select('role').lean();
    if (targetUser && targetUser.role === 'master') {
      return new Response(
        JSON.stringify({ success: false, message: "Cannot delete master account" }), 
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return new Response(
        JSON.stringify({ success: false, message: "User not found" }), 
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Log the user deletion
    logDelete('user', id, {}, req);
    
    // Clear in-memory caches
    usersCacheNormal.clear();
    usersCacheInstant.clear();

    // ⚡ FIX: Properly invalidate Next.js cache
    const { revalidateTag, revalidatePath } = await import('next/cache');
    revalidateTag('users');
    revalidateTag(`user-${id}`);
    revalidatePath('/users');
    
    // ⚡ FIX: Return proper JSON response with success flag
    return new Response(
      JSON.stringify({ success: true, message: "User deleted successfully" }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return new Response(JSON.stringify({ message: "Access denied - Superadmin access required" }), { status: 403 });
      }
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ message }), { status: 500 });
  }
}

