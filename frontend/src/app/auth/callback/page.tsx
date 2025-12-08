"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("Processing authentication...");

    useEffect(() => {
        const token = searchParams.get("token");
        const email = searchParams.get("email");
        const name = searchParams.get("name");
        const refreshToken = searchParams.get("refresh_token");
        const error = searchParams.get("error");

        if (error) {
            setStatus("error");
            setMessage(decodeURIComponent(error.replace(/\+/g, " ")));
            return;
        }

        if (token) {
            // Store token in localStorage
            localStorage.setItem("token", token);
            if (refreshToken) {
                localStorage.setItem("refresh_token", refreshToken);
            }
            if (email) {
                localStorage.setItem("user_email", email);
            }
            if (name) {
                localStorage.setItem("user_name", name);
            }

            setStatus("success");
            setMessage("Authentication successful! Redirecting to dashboard...");

            // Redirect to dashboard after brief delay
            setTimeout(() => {
                router.push("/dashboard");
            }, 1500);
        } else {
            setStatus("error");
            setMessage("No authentication token received. Please try again.");
        }
    }, [searchParams, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="glass-card p-8 max-w-md text-center">
                {status === "loading" && (
                    <>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-500/20 flex items-center justify-center animate-pulse">
                            <svg className="w-8 h-8 text-primary-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold mb-2">Authenticating</h2>
                        <p className="text-muted-foreground">{message}</p>
                    </>
                )}

                {status === "success" && (
                    <>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success-500/20 flex items-center justify-center">
                            <svg className="w-8 h-8 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold mb-2 text-success-500">Success!</h2>
                        <p className="text-muted-foreground">{message}</p>
                    </>
                )}

                {status === "error" && (
                    <>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-danger-500/20 flex items-center justify-center">
                            <svg className="w-8 h-8 text-danger-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold mb-2 text-danger-500">Authentication Failed</h2>
                        <p className="text-muted-foreground mb-4">{message}</p>
                        <button
                            onClick={() => router.push("/login")}
                            className="btn-primary"
                        >
                            Try Again
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
