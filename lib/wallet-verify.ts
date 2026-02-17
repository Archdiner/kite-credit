// ---------------------------------------------------------------------------
// Wallet Ownership Verification
// ---------------------------------------------------------------------------
// Verifies that a user actually owns a Solana wallet by having them
// sign a nonce message with their private key. This prevents users
// from claiming credit for wallets they don't control.
// ---------------------------------------------------------------------------

import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

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

export function verifyWalletSignature(
    address: string,
    nonce: string,
    signatureBase64: string
): boolean {
    try {
        const message = buildSignMessage(address, nonce);
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = Buffer.from(signatureBase64, "base64");
        const publicKeyBytes = new PublicKey(address).toBytes();

        return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    } catch (err) {
        console.error("[wallet-verify] Signature verification failed:", err);
        return false;
    }
}
