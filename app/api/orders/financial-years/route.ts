import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import { getCurrentFinancialYear, getFYLabel } from "@/models/Counter";
import { getSession } from "@/lib/session";
import { type NextRequest } from "next/server";
import { unauthorizedResponse } from "@/lib/response";

/**
 * GET /api/orders/financial-years
 * Returns a list of available financial years from existing orders,
 * plus the current FY. Used to populate the FY filter dropdown.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSession(request);
        if (!session) {
            return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
        }

        await dbConnect();

        const currentFY = getCurrentFinancialYear();

        // Get all distinct FY codes from existing orders that have the FY prefix
        const orders = await Order.find(
            { orderId: { $regex: /^FY/ } },
            { orderId: 1 }
        ).lean().maxTimeMS(3000);

        const fySet = new Set<string>();
        fySet.add(currentFY); // Always include current FY
        fySet.add('2526');    // Always include starting FY for this app version

        for (const order of orders) {
            const match = (order as any).orderId?.match(/^FY(\d{4})-/);
            if (match) {
                fySet.add(match[1]);
            }
        }

        // Check if there are legacy orders (without FY prefix)
        const legacyCount = await Order.countDocuments({
            orderId: { $not: /^FY/ },
            $or: [
                { softDeleted: false },
                { softDeleted: { $exists: false } }
            ]
        }).maxTimeMS(2000);

        // Sort FY codes descending (newest first)
        const fyOptions = Array.from(fySet)
            .filter(code => parseInt(code) >= 2526) // Only show from 2526 onwards
            .sort((a, b) => b.localeCompare(a))
            .map(code => ({
                value: code,
                label: getFYLabel(code),
                isCurrent: code === currentFY
            }));

        // Do not add legacy option as requested (app starts from 2526)

        return Response.json({
            success: true,
            data: {
                currentFY,
                currentFYLabel: getFYLabel(currentFY),
                options: fyOptions
            }
        });
    } catch (error: any) {
        console.error('Financial years API error:', error);
        return Response.json({
            success: false,
            error: error.message || 'Failed to fetch financial years'
        }, { status: 500 });
    }
}
