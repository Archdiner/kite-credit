import { NextRequest, NextResponse } from "next/server";
import { parseBankStatement } from "@/lib/statement-parser";

// Limit payload size config is Next.js specific, might need separate config file
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb',
        },
    },
};

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        if (file.type !== "application/pdf") {
            return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");

        const parsedData = await parseBankStatement(base64);

        return NextResponse.json({ success: true, data: parsedData });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ success: false, error: "Failed to process statement" }, { status: 500 });
    }
}
