"use client";
import { useEffect } from "react";
import { API_BASE_URL } from "../config/api";

// In-memory access token storage (avoids local storage XSS vulnerabilities)
let accessToken: string = "";
let refreshPromise: Promise<string> | null = null;

export let userData: Record<string, any> = {};

// Component that triggers initial access token retrieval on application mount
export function TokenInitializer() {
    useEffect(() => {
        getAccessToken();
    }, []);
    return null;
}

export function saveAccessToken(val: string) {
    accessToken = val;
}

export function clearAccessToken() {
    accessToken = "";
    userData = {};
}

// Retrieves or initializes a persistent device identifier stored in localStorage
export function getDeviceId(): string {
    if (typeof window === "undefined") return "";
    let id = localStorage.getItem("scatterblitz_device_id");
    if (!id) {
        id = typeof crypto !== "undefined" && crypto.randomUUID 
            ? crypto.randomUUID() 
            : Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem("scatterblitz_device_id", id);
    }
    return id;
}

// Requests a fresh access token from the backend refresh endpoint using HTTP-only cookies
export async function requestAccessToken(): Promise<string> {
    // Reuse ongoing refresh request if already in-flight to prevent race conditions
    if (refreshPromise) {
        return refreshPromise;
    }

    refreshPromise = (async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/refresh/`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "x-device-id": getDeviceId(),
                },
                credentials: "include",
            });

            const data = await response.json();
            if (!response.ok) {
                accessToken = "";
                return "";
            }
            saveAccessToken(data.accessToken || "");
            if (data?.user) {
                updateUserData(data.user);
            }
            return data.accessToken || "";
        } catch (err) {
            console.log("Error requesting access token:", err);
            accessToken = "";
            return "";
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

// Returns the cached in-memory access token, or requests a new one if empty
export async function getAccessToken(): Promise<string> {
    if (accessToken) {
        return accessToken;
    }
    return await requestAccessToken();
}

/**
 * Authenticated fetch wrapper:
 * Injects Authorization header and automatically retries once if backend returns 439 (token expired)
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    let token = await getAccessToken();

    const headers = new Headers(options.headers || {});
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }

    let response = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
    });

    // If backend returns status 439, refresh access token and retry the original request once
    if (response.status === 439) {
        const newToken = await requestAccessToken();
        if (newToken) {
            headers.set("Authorization", `Bearer ${newToken}`);
            response = await fetch(url, {
                ...options,
                headers,
                credentials: "include",
            });
        }
    }

    return response;
}

// Creates an anonymous guest session and returns the temporary access token
export async function createNewGuest(): Promise<string> {
    try {
        const response = await fetch(`${API_BASE_URL}/user/guest-login`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "x-device-id": getDeviceId(),
            },
            credentials: "include",
        });
        if (!response.ok) {
            console.log("Failed to create guest session");
            return "";
        }
        const data = await response.json();
        if (data?.accessToken) {
            saveAccessToken(data.accessToken);
            if (data?.user) {
                updateUserData(data.user);
            }
            return data.accessToken;
        }
        return "";
    } catch (err) {
        console.error("Error creating guest session:", err);
        return "";
    }
}

export function updateUserData(obj: Record<string, any>) {
    userData = { ...userData, ...obj };
}

export function getUserData(): Record<string, any> {
    return userData;
}