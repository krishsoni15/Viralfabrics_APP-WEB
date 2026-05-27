import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { requireAuth } from "@/lib/session";
import bcrypt from "bcryptjs";
import { type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await dbConnect();
    const me = await User.findById(session.id).select("-password");
    if (!me) return new Response("Not found", { status: 404 });
    return new Response(JSON.stringify(me), { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
      }
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ message }), { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const { name, username, password, phoneNumber, address } = await req.json();
    
    // Validation
    const errors: string[] = [];
    
    if (typeof name === "string" && !name.trim()) {
      errors.push("Name is required");
    }
    
    if (typeof username === "string" && !username.trim()) {
      errors.push("Username is required");
    }
    
    if (typeof password === "string" && password.length > 0 && password.length < 6) {
      errors.push("Password must be at least 6 characters");
    }
    
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ message: errors.join(", ") }), 
        { status: 400 }
      );
    }

    await dbConnect();
    
    // Check if username already exists (excluding current user)
    if (typeof username === "string" && username.trim()) {
      const existingUser = await User.findOne({ 
        username: username.trim(), 
        _id: { $ne: session.id } 
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
    if (typeof phoneNumber === "string") update.phoneNumber = phoneNumber.trim();
    if (typeof address === "string") update.address = address.trim();
    
    // Only allow password changes for superadmin users
    if (typeof password === "string" && password.length > 0) {
      if (session.role !== "superadmin") {
        return new Response(
          JSON.stringify({ message: "Password changes are restricted to superadmin users" }), 
          { status: 403 }
        );
      }
      update.password = await bcrypt.hash(password, 10);
    }

    const updated = await User.findByIdAndUpdate(session.id, update, { new: true }).select("-password");
    if (!updated) return new Response("Not found", { status: 404 });
    return new Response(JSON.stringify({ message: "Profile updated", user: updated }), { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return new Response(JSON.stringify({ message: "Access denied" }), { status: 403 });
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

