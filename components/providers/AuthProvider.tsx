"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    type ReactNode,
} from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";

interface AuthUser {
    id: string;
    email: string;
    name: string;
}

interface AuthContextValue {
    user: AuthUser | null;
    loading: boolean;
    accessToken: string | null;
    signIn: (email: string, password: string) => Promise<{ error?: string }>;
    signUp: (email: string, password: string, name: string) => Promise<{ error?: string; needsVerification?: boolean }>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ error?: string }>;
    updatePassword: (newPassword: string) => Promise<{ error?: string }>;
    resendVerification: (email: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextValue>({
    user: null,
    loading: true,
    accessToken: null,
    signIn: async () => ({}),
    signUp: async () => ({}),
    signOut: async () => { },
    resetPassword: async () => ({}),
    updatePassword: async () => ({}),
    resendVerification: async () => ({}),
});

export function useAuth() {
    return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Initialize: check for existing session
    useEffect(() => {
        let mounted = true;

        const initSession = async () => {
            try {
                const supabase = createBrowserSupabaseClient();
                const { data: { session } } = await supabase.auth.getSession();
                if (mounted && session?.user) {
                    setUser({
                        id: session.user.id,
                        email: session.user.email || "",
                        name: session.user.user_metadata?.display_name || "",
                    });
                    setAccessToken(session.access_token);
                }
            } catch (err) {
                console.error("[AuthProvider] Failed to get session:", err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initSession();

        // Listen for auth state changes (token refresh, sign out, etc.)
        const supabase = createBrowserSupabaseClient();
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted) return;
            if (session?.user) {
                setUser({
                    id: session.user.id,
                    email: session.user.email || "",
                    name: session.user.user_metadata?.display_name || "",
                });
                setAccessToken(session.access_token);
            } else {
                setUser(null);
                setAccessToken(null);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // Sign in via API route (avoids browser-side Supabase auth issues with new keys)
    const signIn = useCallback(async (email: string, password: string) => {
        try {
            const res = await fetch("/api/auth/signin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!data.success) {
                return { error: data.error || "Sign in failed" };
            }

            // Set the session in the Supabase client so it persists in localStorage
            if (data.data?.session) {
                const supabase = createBrowserSupabaseClient();
                await supabase.auth.setSession({
                    access_token: data.data.session.access_token,
                    refresh_token: data.data.session.refresh_token,
                });

                setUser({
                    id: data.data.user.id,
                    email: data.data.user.email,
                    name: data.data.user.name || "",
                });
                setAccessToken(data.data.session.access_token);
            }

            return {};
        } catch (err) {
            console.error("[AuthProvider] Sign in error:", err);
            return { error: "Sign in failed. Please check your connection." };
        }
    }, []);

    // Sign up via API route
    const signUp = useCallback(async (email: string, password: string, name: string) => {
        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, name }),
            });

            const data = await res.json();

            if (!data.success) {
                return { error: data.error || "Signup failed" };
            }

            // If we got a session back, set it in Supabase client for persistence
            if (data.data?.session) {
                const supabase = createBrowserSupabaseClient();
                await supabase.auth.setSession({
                    access_token: data.data.session.access_token,
                    refresh_token: data.data.session.refresh_token,
                });

                setUser({
                    id: data.data.user.id,
                    email: data.data.user.email,
                    name: data.data.user.name || name,
                });
                setAccessToken(data.data.session.access_token);
            }

            return {};
        } catch {
            return { error: "Signup failed. Please check your connection." };
        }
    }, []);

    const signOut = useCallback(async () => {
        try {
            const supabase = createBrowserSupabaseClient();
            await supabase.auth.signOut();
        } catch {
            // Even if server signout fails, clear local state
        }
        setUser(null);
        setAccessToken(null);
    }, []);

    // Send a password reset email. Supabase sends a link that redirects to
    // /auth/reset-password where the user sets a new password.
    const resetPassword = useCallback(async (email: string) => {
        try {
            const supabase = createBrowserSupabaseClient();
            const redirectTo = `${window.location.origin}/auth/reset-password`;
            const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
            if (error) return { error: error.message };
            return {};
        } catch {
            return { error: "Failed to send reset email. Please try again." };
        }
    }, []);

    // Update password — must be called after Supabase sets a PASSWORD_RECOVERY session.
    const updatePassword = useCallback(async (newPassword: string) => {
        try {
            const supabase = createBrowserSupabaseClient();
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) return { error: error.message };
            return {};
        } catch {
            return { error: "Failed to update password. Please try again." };
        }
    }, []);

    // Resend the email verification link for an unverified account.
    const resendVerification = useCallback(async (email: string) => {
        try {
            const supabase = createBrowserSupabaseClient();
            const { error } = await supabase.auth.resend({ type: "signup", email });
            if (error) return { error: error.message };
            return {};
        } catch {
            return { error: "Failed to resend verification email." };
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, accessToken, signIn, signUp, signOut, resetPassword, updatePassword, resendVerification }}>
            {children}
        </AuthContext.Provider>
    );
}
