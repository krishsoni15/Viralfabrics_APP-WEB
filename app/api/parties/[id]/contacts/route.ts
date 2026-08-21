import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/Order';
import Party, { IParty } from '@/models/Party';
import { getSession } from '@/lib/session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ success: true, contacts: [], contactDetails: [] });
    }

    await dbConnect();

    // 1. Get primary contact from the Party document itself
    const partyDoc = await Party.findById(id).select('contactName contactPhone').lean() as IParty | null;

    // 2. Query contact names and phones from orders matching this party ID
    const orders = await Order.find({ 
      party: id,
      contactName: { $ne: null, $exists: true }
    }).select('contactName contactPhone').lean();

    // Map to collect unique contact details
    const uniqueContactsMap = new Map<string, string>();

    // Add primary party contact if it exists
    if (partyDoc && partyDoc.contactName && partyDoc.contactName.trim()) {
      uniqueContactsMap.set(partyDoc.contactName.trim(), partyDoc.contactPhone?.trim() || '');
    }

    // Add contacts from orders
    for (const order of orders) {
      if (order.contactName && order.contactName.trim()) {
        const name = order.contactName.trim();
        const phone = order.contactPhone?.trim() || '';
        // If contact is not in map, or map entry has an empty phone but the order has a phone, update it
        if (!uniqueContactsMap.has(name) || (phone && !uniqueContactsMap.get(name))) {
          uniqueContactsMap.set(name, phone);
        }
      }
    }

    // Convert to sorted list of details
    const contactDetails = Array.from(uniqueContactsMap.entries())
      .map(([name, phone]) => ({ name, phone }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // For backwards compatibility
    const filteredNames = contactDetails.map(c => c.name);

    return NextResponse.json({ 
      success: true, 
      contacts: filteredNames,
      contactDetails 
    });
  } catch (err: any) {
    console.error('Error in GET /api/parties/[id]/contacts:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
