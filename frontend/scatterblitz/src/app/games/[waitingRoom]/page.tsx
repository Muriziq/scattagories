"use client"
import { use, useEffect } from "react"
import { io } from "socket.io-client"

export default function WaitingRoom({
    params,
}: {
    params: Promise<{ waitingRoom: string }>
}) {
    

    return (
        <section>
            <h1>Waiting Room</h1>
            <div>
                <div></div>
                <div>
                    <button>Start Game</button>
                </div>
            </div>
        </section>
    )
}