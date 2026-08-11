import { NextRequest } from "next/server";
import { generateSampleStickerPDF } from "@/lib/pdfGenerator";
import { getSession } from "@/lib/session";
import { jwtVerify } from "jose";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
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
        console.error("Sticker Route - Token verification failed:", err);
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

    const qualityName = searchParams.get("qualityName") || "";
    const weaverName = searchParams.get("weaverName") || "";
    const width = searchParams.get("width") ? Number(searchParams.get("width")) : undefined;
    const gsm = searchParams.get("gsm") || undefined;
    const content = searchParams.get("content") || "";
    const count = searchParams.get("count") ? Number(searchParams.get("count")) : undefined;
    const rxP = searchParams.get("rxP") || "";
    const danier = searchParams.get("danier") || "";
    const moq = searchParams.get("moq") ? Number(searchParams.get("moq")) : undefined;
    const rack = searchParams.get("rack") || "";

    const stickerData = {
      qualityName,
      weaverName: weaverName || undefined,
      width,
      gsm,
      content: content || undefined,
      count,
      rxP: rxP || undefined,
      danier: danier || undefined,
      moq,
      rack: rack || undefined
    };

    const pdfDataUrl = generateSampleStickerPDF(stickerData);
    const base64Data = pdfDataUrl.split("base64,")[1] || pdfDataUrl.split(",")[1];
    
    if (!base64Data) {
      throw new Error("Failed to extract base64 data from PDF generator output");
    }

    const pdfBuffer = Buffer.from(base64Data, "base64");
    const sanitizedQualityName = qualityName.replace(/[^a-zA-Z0-9-_]/g, "_") || "STICKER";
    const filename = `SAMPLE_STICKER_${sanitizedQualityName}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString()
      }
    });

  } catch (error: any) {
    console.error("Sticker Route - Error generating sticker PDF:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || "Failed to generate sticker PDF" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
