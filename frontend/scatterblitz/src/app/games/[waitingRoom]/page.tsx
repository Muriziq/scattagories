"use client"
import { use, useEffect } from "react"
import { io } from "socket.io-client"

export default function WaitingRoom({
    params,
}: {
    params: Promise<{ waitingRoom: string }>
}) {
    const { waitingRoom } = use(params)

    useEffect(() => {
        const socket = io("http://localhost:5000",{
           auth:{token:""}
        })
        const joinRoom = async ()=>{
            const res = await fetch("http://localhost:500/games/room/join",{
                method:"POST",
                headers:{
                    "Content-Type":"application/json"
                },
                credentials:"include",
                body:JSON.stringify({roomId:waitingRoom,password:""})
            })
            socket.emit("join-room",waitingRoom)
        }
        joinRoom()

        socket.on("participants", (participant) => {
            console.log(participant)
        })
        socket.on("error",(err)=>{
            console.log(err)
        })

        return () => {
            socket.disconnect()
        }
    }, [waitingRoom])

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