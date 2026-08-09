"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function CreateRoom() {
    const router = useRouter();
    const [categories, setCategories] = useState<string[]>(["Animals", "Countries", "States"]);
    const [error, setError] = useState<string | null>(null);
    const [settings, setSettings] = useState<{ isPublic: boolean; password: string; maxPlayers: number; maxTimePerRound: number }>({
        isPublic: true,
        password: "",
        maxPlayers: 5,
        maxTimePerRound: 60
    })

    const changeSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : type === "number" ? Number(value) : value
        }));
    };

    const addToCategories = (cat: string) => {
        if (!categories.includes(cat)) {
            setCategories([...categories, cat]);
        }
    };

    const deleteFromCategories = (cat: string) => {
        setCategories(categories.filter(c => c !== cat));
    };

    const createRoom = async () => {
        setError(null);

        if (categories.length === 0) {
            setError("Please select at least one category.");
            return;
        }

        if (!settings.isPublic && !settings.password.trim()) {
            setError("Private rooms must have a password.");
            return;
        }

        try {
            const res = await fetch("http://localhost:5000/games/room/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({ categories, ...settings })
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.errors?.password?._errors) {
                    setError(data.errors.password._errors.join(", "));
                } else {
                    setError(data.message || "Failed to create room.");
                }
                console.error("Create room error:", data);
                return;
            }

            console.log("Room created successfully:", data);
            if (data.roomId) {
                router.push(`/games/${data.roomId}`);
            }
        } catch (err: any) {
            console.error("Network or creation error:", err);
            setError("Network error creating room. Please try again.");
        }
    };

    return (
        <section>
            <h1>Create Room</h1>
            {error && <div style={{ color: "red", margin: "10px 0" }}>{error}</div>}
            <section>
                <h2>Categories</h2>
                <div>
                    {categories.map(cat => (
                        <button key={cat} onClick={() => deleteFromCategories(cat)}>{cat}</button>
                    ))}
                </div>
                <div><input placeholder="search categories" /></div>
                <div>
                    <button onClick={() => addToCategories("Name")}>Name</button>
                    <button onClick={() => addToCategories("City")}>City</button>
                    <button onClick={() => addToCategories("Country")}>Country</button>
                    <button onClick={() => addToCategories("Food")}>Food</button>
                    <button onClick={() => addToCategories("Movie")}>Movie</button>
                    <button onClick={() => addToCategories("Animal")}>Animal</button>
                    <button onClick={() => addToCategories("Color")}>Color</button>
                    <button onClick={() => addToCategories("Sport")}>Sport</button>
                </div>
                {!settings.isPublic && (
                    <div>
                        <input
                            type="text"
                            placeholder="Input Password"
                            name="password"
                            value={settings.password}
                            onChange={changeSettings}
                        />
                    </div>
                )}
            </section>
            <section>
                <div>
                    <div>
                        <h3>Public</h3>
                        <small>Anyone can join via matchmaking</small>
                    </div>
                    <input
                        type="checkbox"
                        name="isPublic"
                        id="isPublic"
                        checked={settings.isPublic}
                        onChange={changeSettings}
                    />
                </div>
                <div>
                    <h3>Number of Players</h3>
                    <input
                        type="number"
                        min={2}
                        max={8}
                        name="maxPlayers"
                        value={settings.maxPlayers}
                        onChange={changeSettings}
                    />
                    <small>2-8 Players allowed</small>
                </div>
                <div>
                    <h3>Max Time per round</h3>
                    <input
                        type="number"
                        min={10}
                        max={120}
                        name="maxTimePerRound"
                        value={settings.maxTimePerRound}
                        onChange={changeSettings}
                    />
                    <small>seconds (10-120)</small>
                </div>
            </section>
            <button onClick={createRoom}>CREATE ROOM</button>
        </section>
    )
}





