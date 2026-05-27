import dbConnect from "@/lib/dbConnect";
import Party from "@/models/Party";
import Order from "@/models/Order";
import { requireAuth } from "@/lib/session";
import { type NextRequest } from "next/server";
import { logUpdate, logDelete } from "@/lib/logger";
import { clearPartiesCache } from "@/lib/partiesCache";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication temporarily disabled
    // await requireAuth(req);

    await dbConnect();
    
    const { id } = await params;
    const party = await Party.findById(id)
      .select('_id name contactName contactPhone address createdAt updatedAt');

    if (!party) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Party not found" 
        }), 
        { status: 404 }
      );
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: party 
    }), { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Unauthorized" 
        }), { status: 401 });
      }
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ 
      success: false, 
      message 
    }), { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication temporarily disabled
    // await requireAuth(req);

    const { name, contactName, contactPhone, address } = await req.json();

    // Validation
    const errors: string[] = [];
    
    if (name !== undefined) {
      if (!name || !name.trim()) {
        errors.push("Party name is required");
      } else if (name.trim().length < 2) {
        errors.push("Party name must be at least 2 characters long");
      } else if (name.trim().length > 100) {
        errors.push("Party name cannot exceed 100 characters");
      }
    }
    
    if (contactName !== undefined && contactName && contactName.trim().length > 50) {
      errors.push("Contact name cannot exceed 50 characters");
    }
    
    if (contactPhone !== undefined && contactPhone && contactPhone.trim().length > 20) {
      errors.push("Contact phone cannot exceed 20 characters");
    }
    
    if (address !== undefined && address && address.trim().length > 200) {
      errors.push("Address cannot exceed 200 characters");
    }
    
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: errors.join(", ") 
        }), 
        { status: 400 }
      );
    }

    await dbConnect();

    const { id } = await params;

    // Check if party exists
    const existingParty = await Party.findById(id);
    if (!existingParty) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Party not found" 
        }), 
        { status: 404 }
      );
    }

    // If name is being updated, check for duplicates
    if (name && name.trim() !== existingParty.name) {
      const duplicateParty = await Party.findOne({ 
        name: { $regex: `^${name.trim()}$`, $options: 'i' },
        _id: { $ne: id } // Exclude current party
      });
      
      if (duplicateParty) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "A party with this name already exists" 
          }), 
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (contactName !== undefined) updateData.contactName = contactName ? contactName.trim() : undefined;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone ? contactPhone.trim() : undefined;
    if (address !== undefined) updateData.address = address ? address.trim() : undefined;

    const updatedParty = await Party.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('_id name contactName contactPhone address createdAt updatedAt');

    // Log the party update
    await logUpdate('party', id, updateData, updatedParty.toObject(), req);

    // Invalidate cache to ensure fresh data on next GET request
    clearPartiesCache();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Party updated successfully", 
        data: updatedParty 
      }), 
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Unauthorized" 
        }), { status: 401 });
      }
      
      // Handle MongoDB duplicate key errors
      if (error.message.includes('E11000')) {
        if (error.message.includes('name')) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: "A party with this name already exists" 
            }), 
            { status: 400 }
          );
        }
      }
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values((error as any).errors).map((err: any) => err.message);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: validationErrors.join(", ") 
          }), 
          { status: 400 }
        );
      }
    }
    
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ 
      success: false, 
      message 
    }), { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params;
    
    // Check if party exists
    const existingParty = await Party.findById(id);
    if (!existingParty) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Party not found" 
        }), 
        { status: 404 }
      );
    }

    // Check if party is being used in any orders
    const ordersUsingParty = await Order.find({ party: id });
    if (ordersUsingParty.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Cannot delete party "${existingParty.name}" - it's being used in ${ordersUsingParty.length} order(s). Please remove all orders using this party first.` 
        }), 
        { status: 400 }
      );
    }

    // Delete the party
    await Party.findByIdAndDelete(id);

    // Log the party deletion
    logDelete('party', id, {}, req);

    // Invalidate cache to ensure fresh data on next GET request
    clearPartiesCache();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Party deleted successfully" 
      }), 
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(
      JSON.stringify({ 
        success: false, 
        message 
      }), 
      { status: 500 }
    );
  }
}
