
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Connection, PublicKey } from '@solana/web3.js';
import { getTransactionHistory } from '../solana';

// Mock @solana/web3.js
jest.mock('@solana/web3.js', () => {
    return {
        Connection: jest.fn().mockImplementation(() => ({
            getSignaturesForAddress: jest.fn(),
            getParsedTransaction: jest.fn(),
        })),
        PublicKey: jest.fn().mockImplementation((key) => ({ toBase58: () => key })),
    };
});

describe('RPC Resilience', () => {
    let mockConnection: any;

    beforeEach(() => {
        // Clear mocks
        jest.clearAllMocks();
        mockConnection = new Connection('https://api.mainnet-beta.solana.com');
    });

    it('should handle partial batch failures gracefully', async () => {
        // Mock signatures (20 total)
        const mockSignatures = Array(20).fill(0).map((_, i) => ({ signature: `sig-${i}` }));

        // Mock getSignaturesForAddress
        (mockConnection.getSignaturesForAddress as jest.Mock).mockResolvedValue(mockSignatures);

        // Mock getParsedTransaction to fail for the second batch (indices 10-19)
        // First batch (0-9) succeeds
        // Second batch (10-19) fails
        (mockConnection.getParsedTransaction as jest.Mock).mockImplementation((sig: string) => {
            const index = parseInt(sig.split('-')[1]);
            if (index >= 10) {
                return Promise.reject(new Error('RPC Timeout'));
            }
            return Promise.resolve({ transaction: { signatures: [sig] } });
        });

        const transactions = await getTransactionHistory(mockConnection, 'mock-address', 20);

        // We expect the 10 successful transactions from the first batch
        expect(transactions).toHaveLength(10);
        expect(transactions[0]).not.toBeNull();

        // Verify the error was caught and didn't crash the whole function
    });

    it('should return empty array if all batches fail', async () => {
        const mockSignatures = Array(10).fill(0).map((_, i) => ({ signature: `sig-${i}` }));
        (mockConnection.getSignaturesForAddress as jest.Mock).mockResolvedValue(mockSignatures);
        (mockConnection.getParsedTransaction as jest.Mock).mockRejectedValue(new Error('Network Error'));

        const transactions = await getTransactionHistory(mockConnection, 'mock-address', 10);
        expect(transactions).toHaveLength(0);
    });
});
