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

function validateParsedStatementData(data: any): ParsedStatementData {
    if (!data || typeof data !== 'object') throw new Error("Invalid data format");

    // Basic type checks
    if (data.accountHolder !== null && typeof data.accountHolder !== 'string') throw new Error("Invalid accountHolder");
    if (data.bankName !== null && typeof data.bankName !== 'string') throw new Error("Invalid bankName");

    // Number checks (coerce if string)
    ['totalDeposits', 'totalWithdrawals', 'endingBalance', 'confidence'].forEach(field => {
        if (typeof data[field] === 'string') data[field] = parseFloat(data[field]);
        if (typeof data[field] !== 'number' || isNaN(data[field])) throw new Error(`Invalid number field: ${field}`);
    });

    // Confidence must be between 0 and 1
    if (data.confidence < 0 || data.confidence > 1) {
        throw new Error("confidence must be between 0 and 1");
    }

    if (!Array.isArray(data.transactions)) throw new Error("Transactions must be an array");

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    data.transactions.forEach((tx: any, i: number) => {
        if (typeof tx.date !== 'string') throw new Error(`Invalid date at index ${i}`);
        if (!dateRegex.test(tx.date)) throw new Error(`Invalid transaction date at index ${i}: must be YYYY-MM-DD`);
        // Verify the parsed date is actually valid (e.g. reject 2024-02-30)
        const [year, month, day] = tx.date.split('-').map(Number);
        const parsed = new Date(year, month - 1, day);
        if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
            throw new Error(`Invalid transaction date at index ${i}: date does not exist`);
        }
        if (typeof tx.description !== 'string') throw new Error(`Invalid description at index ${i}`);
        if (typeof tx.amount === 'string') tx.amount = parseFloat(tx.amount);
        if (typeof tx.amount !== 'number' || isNaN(tx.amount)) throw new Error(`Invalid amount at index ${i}`);
        if (!['income', 'expense', 'transfer'].includes(tx.category)) throw new Error(`Invalid category at index ${i}`);
    });

    return data as ParsedStatementData;
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
        const rawData = JSON.parse(jsonStr);
        const data = validateParsedStatementData(rawData);

        return data;
    } catch (error) {
        console.error("Gemini parsing failed:", error);
        throw new Error("Failed to parse bank statement");
    }
}
