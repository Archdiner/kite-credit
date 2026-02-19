"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("[ErrorBoundary] Caught error:", error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="min-h-[50vh] flex items-center justify-center p-8">
                    <div className="max-w-md text-center space-y-4">
                        <div className="w-12 h-12 bg-red-500/20 border border-red-500/30 rotate-45 mx-auto" />
                        <h2 className="text-xl font-bold text-white">Something went wrong</h2>
                        <p className="text-sm text-white/50">
                            {this.state.error?.message || "An unexpected error occurred."}
                        </p>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            className="px-6 py-2 bg-white/10 border border-white/20 text-white/70 rounded-lg text-sm font-medium hover:bg-white/15 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
