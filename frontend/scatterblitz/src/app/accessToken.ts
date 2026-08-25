"use client";
import { useEffect } from "react";

let accessToken: string = ""
let previousDate: number = 0
let duration: number = 15 * 60 * 1000

export let userData: Record<string, any> = {};

export function TokenInitializer() {
    useEffect(() => {
        getAccessToken();
    }, []);
    return null;
}

export function saveAccessToken(val: string, date: number) {
    accessToken = val
    previousDate = date
}

async function requestAccessToken() {
    accessToken = ""
    try {
        const response = await fetch("http://localhost:5000/refresh/", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
        });

        const data = await response.json();
                if (!response.ok) {
            console.log(data.message);
            return false;
        }
        saveAccessToken(data.accessToken, data.accessTokenDate);
        if (data?.user) {
            updateUserData(data.user);
        }
        return true
    } catch (err) {
        console.log("Error requesting access token:", err);
    }
}

function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

export async function getAccessToken(): Promise<string> {
    if (previousDate !== 0 && Date.now() - previousDate < duration && accessToken !== "") {
        return accessToken;
    } else {
        const ifGet = await requestAccessToken();
        if (!ifGet) {
            const rawCookie = getCookie("accessToken");
            if (rawCookie) {
                let guestToken = rawCookie;
                let guestDate = Date.now();
                if (rawCookie.startsWith("j:")) {
                    try {
                        const parsed = JSON.parse(decodeURIComponent(rawCookie.substring(2)));
                        guestToken = parsed.accessToken || rawCookie;
                        guestDate = parsed.accessTokenDate || Date.now();
                    } catch (e) {
                        console.error("Error parsing guest cookie:", e);
                    }
                }
                saveAccessToken(guestToken, guestDate);
                duration = 24 * 60 * 60 * 1000;
            }
        }
        return accessToken;
    }
}
export async function createNewGuest(): Promise<string> {
    try {
        const response = await fetch("http://localhost:5000/user/guest-login", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
        });
        if (!response.ok) {
            console.log("Failed to create guest session");
            return "";
        }
        const data = await response.json();
        if (data?.accessToken) {
            saveAccessToken(data.accessToken, data.accessTokenDate || Date.now());
            if (data?.user) {
                updateUserData(data.user);
                duration = 24 * 60 * 60 * 1000
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