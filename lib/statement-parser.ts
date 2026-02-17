// ---------------------------------------------------------------------------
// AI Bank Statement Parser
// ---------------------------------------------------------------------------
// Uses Google Gemini 2.0 Flash (Multimodal) to extract transaction data
// from uploaded PDF bank statements.
// ---------------------------------------------------------------------------

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ParsedStatementData {
    accountHolder: string | null;
    bankName: string | null;
    totalDeposits: number;
    totalWithdrawals: number;
    endingBalance: number;
    transactions: Array<{
        date: string;
        description: string;
        amount: number;
        category: "income" | "expense" | "transfer";
    }>;
    confidence: number; // 0-1 confidence in extraction
}

export async function parseBankStatement(pdfBase64: string): Promise<ParsedStatementData> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
        You are a specialized financial document parser. Extract structured data from this bank statement.
        Return ONLY a JSON object with this exact structure:
        {
            "accountHolder": "Name found on statement or null",
            "bankName": "Bank name or null",
            "totalDeposits": number (sum of credits),
            "totalWithdrawals": number (sum of debits),
            "endingBalance": number (final balance),
            "transactions": [
                { "date": "YYYY-MM-DD", "description": "text", "amount": number (positive for both, use category), "category": "income"|"expense"|"transfer" }
            ],
            "confidence": number (0.0 to 1.0 estimate of extraction quality)
        }
        Do not include markdown formatting. Just the raw JSON.
    `;

    try {
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: pdfBase64,
                    mimeType: "application/pdf",
                },
            },
        ]);

        const text = result.response.text();
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const data = JSON.parse(jsonStr) as ParsedStatementData;

        return data;
    } catch (error) {
        console.error("Gemini parsing failed:", error);
        throw new Error("Failed to parse bank statement");
    }
}
