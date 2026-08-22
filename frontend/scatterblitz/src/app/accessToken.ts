let accessToken: string = ""
let previousDate: number = 0

export let userData: Record<string, any> = {};

export function saveAccessToken(val: string, date: number) {
    accessToken = val
    previousDate = date
}

async function requestAccessToken() {
    accessToken = ""
    try {
        const response = await fetch("http://localhost:3001/refresh", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
        });
        if (!response.ok) {
            console.log("No AccessToken Available");
            return;
        }
        const data = await response.json();
        saveAccessToken(data.accessToken, data.accessTokenDate);
        if (data?.user) {
            updateUserData(data.user);
        }
    } catch (err) {
        console.log("Error requesting access token:", err);
    }
}

export async function getAccessToken(): Promise<string> {
    if (Date.now() - previousDate < 15 * 60 * 1000 && accessToken !== "") {
        return accessToken;
    } else {
        await requestAccessToken();
        return accessToken;
    }
}

export function updateUserData(obj: Record<string, any>) {
    userData = { ...userData, ...obj };
}

export function getUserData(): Record<string, any> {
    return userData;
}