import nacl from "tweetnacl";
import bs58 from "bs58";

const PHANTOM_CONNECT_URL = "https://phantom.app/ul/v1/connect";
const PHANTOM_SIGN_MESSAGE_URL = "https://phantom.app/ul/v1/signMessage";

export interface PhantomSession {
    dappKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array };
    phantomEncryptionPublicKey: string | null;
    sharedSecret: Uint8Array | null;
    session: string | null;
    publicKey: string | null;
}

export function createSession(): PhantomSession {
    const dappKeyPair = nacl.box.keyPair();
    return {
        dappKeyPair,
        phantomEncryptionPublicKey: null,
        sharedSecret: null,
        session: null,
        publicKey: null,
    };
}

export function serializeSession(session: PhantomSession): string {
    return JSON.stringify({
        dappPublicKey: bs58.encode(session.dappKeyPair.publicKey),
        dappSecretKey: bs58.encode(session.dappKeyPair.secretKey),
        phantomEncryptionPublicKey: session.phantomEncryptionPublicKey,
        session: session.session,
        publicKey: session.publicKey,
    });
}

export function deserializeSession(raw: string): PhantomSession {
    const parsed = JSON.parse(raw);
    return {
        dappKeyPair: {
            publicKey: bs58.decode(parsed.dappPublicKey),
            secretKey: bs58.decode(parsed.dappSecretKey),
        },
        phantomEncryptionPublicKey: parsed.phantomEncryptionPublicKey,
        sharedSecret: parsed.phantomEncryptionPublicKey
            ? nacl.box.before(
                  bs58.decode(parsed.phantomEncryptionPublicKey),
                  bs58.decode(parsed.dappSecretKey),
              )
            : null,
        session: parsed.session,
        publicKey: parsed.publicKey,
    };
}

function decryptPayload(
    data: string,
    nonce: string,
    sharedSecret: Uint8Array,
): Record<string, string> {
    const decrypted = nacl.box.open.after(
        bs58.decode(data),
        bs58.decode(nonce),
        sharedSecret,
    );
    if (!decrypted) throw new Error("Failed to decrypt Phantom response");
    return JSON.parse(new TextDecoder().decode(decrypted));
}

function encryptPayload(
    payload: Record<string, string>,
    sharedSecret: Uint8Array,
): { nonce: string; encryptedPayload: string } {
    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.box.after(
        new TextEncoder().encode(JSON.stringify(payload)),
        nonce,
        sharedSecret,
    );
    return {
        nonce: bs58.encode(nonce),
        encryptedPayload: bs58.encode(encrypted),
    };
}

// ---------------------------------------------------------------------------
// Step 1: Build the connect deep link URL
// ---------------------------------------------------------------------------
export function buildConnectUrl(
    session: PhantomSession,
    redirectLink: string,
    appUrl: string,
    cluster: "mainnet-beta" | "testnet" | "devnet" = "mainnet-beta",
): string {
    const params = new URLSearchParams({
        dapp_encryption_public_key: bs58.encode(session.dappKeyPair.publicKey),
        redirect_link: redirectLink,
        app_url: appUrl,
        cluster,
    });
    return `${PHANTOM_CONNECT_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Step 2: Parse the connect callback response
// ---------------------------------------------------------------------------
export function handleConnectResponse(
    session: PhantomSession,
    params: URLSearchParams,
): PhantomSession {
    const errorCode = params.get("errorCode");
    if (errorCode) {
        throw new Error(
            `Phantom connect rejected: ${params.get("errorMessage") || errorCode}`,
        );
    }

    const phantomPubKey = params.get("phantom_encryption_public_key");
    const data = params.get("data");
    const nonce = params.get("nonce");

    if (!phantomPubKey || !data || !nonce) {
        throw new Error("Missing parameters in Phantom connect response");
    }

    const sharedSecret = nacl.box.before(
        bs58.decode(phantomPubKey),
        session.dappKeyPair.secretKey,
    );

    const decrypted = decryptPayload(data, nonce, sharedSecret);

    return {
        ...session,
        phantomEncryptionPublicKey: phantomPubKey,
        sharedSecret,
        session: decrypted.session,
        publicKey: decrypted.public_key,
    };
}

// ---------------------------------------------------------------------------
// Step 3: Build the signMessage deep link URL
// ---------------------------------------------------------------------------
export function buildSignMessageUrl(
    session: PhantomSession,
    message: string,
    redirectLink: string,
): string {
    if (!session.sharedSecret || !session.session) {
        throw new Error("Session not established — call connect first");
    }

    const messageBytes = new TextEncoder().encode(message);
    const messageBase58 = bs58.encode(messageBytes);

    const { nonce, encryptedPayload } = encryptPayload(
        {
            message: messageBase58,
            session: session.session,
            display: "utf8",
        },
        session.sharedSecret,
    );

    const params = new URLSearchParams({
        dapp_encryption_public_key: bs58.encode(session.dappKeyPair.publicKey),
        nonce,
        redirect_link: redirectLink,
        payload: encryptedPayload,
    });

    return `${PHANTOM_SIGN_MESSAGE_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Step 4: Parse the signMessage callback response
// ---------------------------------------------------------------------------
export function handleSignMessageResponse(
    session: PhantomSession,
    params: URLSearchParams,
): { signature: string } {
    const errorCode = params.get("errorCode");
    if (errorCode) {
        throw new Error(
            `Phantom sign rejected: ${params.get("errorMessage") || errorCode}`,
        );
    }

    const data = params.get("data");
    const nonce = params.get("nonce");

    if (!data || !nonce || !session.sharedSecret) {
        throw new Error("Missing parameters in Phantom signMessage response");
    }

    const decrypted = decryptPayload(data, nonce, session.sharedSecret);
    return { signature: decrypted.signature };
}
