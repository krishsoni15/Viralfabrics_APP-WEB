import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { Order, Party, Quality, GreyInfo, MillInput, MillOutput, Dispatch, Mill } from "@/models";
import { getSession } from "@/lib/session";
import { jwtVerify } from "jose";
import { generateOrderPDF } from "@/lib/pdfGenerator";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const itemIndexStr = searchParams.get("itemIndex") || "0";
    const itemIndex = parseInt(itemIndexStr, 10);
    const queryToken = searchParams.get("token");

    // Authenticate
    let sessionUser: any = null;
    if (queryToken) {
      try {
        const JWT_SECRET = process.env.JWT_SECRET;
        if (JWT_SECRET) {
          const secretKey = new TextEncoder().encode(JWT_SECRET);
          const { payload } = await jwtVerify(queryToken, secretKey);
          if (payload && typeof payload === "object") {
            sessionUser = {
              id: payload.id,
              name: payload.name,
              username: payload.username,
              role: payload.role,
              partyId: payload.partyId,
            };
          }
        }
      } catch (err) {
        console.error("Token verification failed:", err);
      }
    }

    if (!sessionUser) {
      sessionUser = await getSession(req);
    }

    if (!sessionUser) {
      return new Response(
        JSON.stringify({ success: false, message: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    await dbConnect();

    // Fetch the order
    const orderQuery: any = { _id: id };
    if (sessionUser.partyId && sessionUser.role !== "master" && sessionUser.role !== "superadmin") {
      orderQuery.party = sessionUser.partyId;
    }

    const order = await Order.findOne(orderQuery).lean();
    if (!order) {
      return new Response(
        JSON.stringify({ success: false, message: "Order not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const items = order.items || [];
    if (itemIndex < 0 || itemIndex >= items.length) {
      return new Response(
        JSON.stringify({ success: false, message: "Item index out of bounds" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Populate party and quality
    const partyId = order.party;
    const item = items[itemIndex];
    const qualityId = item?.quality;

    const [party, qualityDoc, greyInfoEntries, rawMillInputs, rawMillOutputs, rawDispatches] = await Promise.all([
      partyId ? Party.findById(partyId).lean() : Promise.resolve(null),
      (qualityId ? Quality.findById(qualityId).lean() : Promise.resolve(null)) as Promise<any>,
      GreyInfo.find({ orderId: order.orderId }).lean(),
      MillInput.find({ order: id }).lean(),
      MillOutput.find({ order: id }).lean(),
      Dispatch.find({ order: id }).lean()
    ]);

    // Fetch mills and qualities referenced in mill data
    const millIds = [...new Set(rawMillInputs.flatMap((mi: any) => mi.mill ? [mi.mill] : []))];
    const referencedQualityIds = [
      ...new Set([
        ...rawMillInputs.flatMap((mi: any) => [
          ...(mi.quality ? [mi.quality] : []),
          ...(mi.additionalMeters?.flatMap((am: any) => am.quality ? [am.quality] : []) || [])
        ]),
        ...rawMillOutputs.flatMap((mo: any) => mo.quality ? [mo.quality] : []),
        ...rawDispatches.flatMap((d: any) => d.quality ? [d.quality] : [])
      ])
    ];

    const [mills, referencedQualities] = await Promise.all([
      millIds.length > 0 ? Mill.find({ _id: { $in: millIds } }).lean() : Promise.resolve([]),
      referencedQualityIds.length > 0 ? Quality.find({ _id: { $in: referencedQualityIds } }).lean() : Promise.resolve([])
    ]);

    const millMap = new Map(mills.map((m: any) => [m._id.toString(), m]));
    const qualityMap = new Map(referencedQualities.map((q: any) => [q._id.toString(), q]));

    // Format inputs/outputs/dispatches
    const millInputs = rawMillInputs.map((mi: any) => ({
      ...mi,
      mill: mi.mill ? millMap.get(mi.mill.toString()) || null : null,
      quality: mi.quality ? qualityMap.get(mi.quality.toString()) || null : null,
      additionalMeters: mi.additionalMeters?.map((am: any) => ({
        ...am,
        quality: am.quality ? qualityMap.get(am.quality.toString()) || null : null
      })) || []
    }));

    const millOutputs = rawMillOutputs.map((mo: any) => ({
      ...mo,
      quality: mo.quality ? qualityMap.get(mo.quality.toString()) || null : null
    }));

    const dispatches = rawDispatches.map((d: any) => ({
      ...d,
      quality: d.quality ? qualityMap.get(d.quality.toString()) || null : null
    }));

    // Format greyInformation entries
    const greyInfoQualities = [...new Set(greyInfoEntries.map((gi: any) => gi.quality).filter(Boolean))];
    const greyQualities = greyInfoQualities.length > 0 ? await Quality.find({ _id: { $in: greyInfoQualities } }).lean() : [];
    const greyQualityMap = new Map(greyQualities.map((q: any) => [q._id.toString(), q]));
    
    const formattedGreyInfo = greyInfoEntries.map((gi: any) => ({
      ...gi,
      order: gi.order ? { _id: gi.order.toString(), orderId: gi.orderId } : null,
      quality: gi.quality ? greyQualityMap.get(gi.quality.toString()) || null : null
    }));

    // Construct the single item order payload
    const populatedItem = {
      ...item,
      quality: qualityDoc || item.quality
    };

    const itemOrderPayload: any = {
      ...order,
      party: party || order.party,
      items: [populatedItem],
      greyInformation: formattedGreyInfo,
      millInputs,
      millOutputs,
      dispatches,
      itemIndex: itemIndex + 1,
      qualityName: qualityDoc ? qualityDoc.name : "Not selected",
      totalAmount: item.totalPrice || 0,
      finalAmount: item.totalPrice || 0
    };

    // Generate PDF document using the server-safe function
    const doc = generateOrderPDF(itemOrderPayload);
    if (!doc) {
      throw new Error("PDF generation returned null document");
    }

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const filename = `FABRIC_PURCHASE_ORDER_${order.orderId}_Item_${itemIndex + 1}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString()
      }
    });

  } catch (error: any) {
    console.error("PDF generation route error:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || "Failed to generate PDF" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
