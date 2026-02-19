// ---------------------------------------------------------------------------
// Wallet Ownership Verification
// ---------------------------------------------------------------------------
// Verifies that a user actually owns a Solana wallet by having them
// sign a nonce message with their private key. This prevents users
// from claiming credit for wallets they don't control.
// ---------------------------------------------------------------------------

import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

// ---------------------------------------------------------------------------
// Nonce generation + message construction
// ---------------------------------------------------------------------------

export function generateNonce(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export function buildSignMessage(address: string, nonce: string): string {
    return `Kite Credit: verify ownership of ${address} | nonce: ${nonce}`;
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

function decodeSignature(encoded: string): Uint8Array {
    // Phantom deep links return base58; the desktop adapter returns base64.
    // Try base58 first (it's stricter), fall back to base64.
    try {
        const decoded = bs58.decode(encoded);
        if (decoded.length === 64) return decoded;
    } catch { /* not base58 */ }

    return new Uint8Array(Buffer.from(encoded, "base64"));
}

export function verifyWalletSignature(
    address: string,
    nonce: string,
    signatureEncoded: string,
): boolean {
    try {
        const message = buildSignMessage(address, nonce);
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = decodeSignature(signatureEncoded);
        const publicKeyBytes = new PublicKey(address).toBytes();

        return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    } catch (err) {
        console.error("[wallet-verify] Signature verification failed:", err);
        return false;
    }
}
