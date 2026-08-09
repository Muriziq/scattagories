"use client"
import { useState, useEffect, Suspense } from "react";
import CreateRoom from "./components/createRoom";
import JoinRoom from "./components/joinRoom";
import { useSearchParams } from 'next/navigation';

function RoomContent() {
  const searchParams = useSearchParams();
  const [isJoin, setIsJoin] = useState(false);

  useEffect(() => {
    const type = searchParams.get("type");
    if (type === "join") {
      setIsJoin(true);
    } else if (type === "create") {
      setIsJoin(false);
    }
  }, [searchParams]);

  return (
    <main>
      <div>
        <button onClick={() => setIsJoin(false)}>Create Room</button>
        <button onClick={() => setIsJoin(true)}>Join Room</button>
      </div>
      {!isJoin && <CreateRoom />}
      {isJoin && <JoinRoom />}
    </main>
  );
}

export default function Room() {
  return (
    <Suspense fallback={<main></main>}>
      <RoomContent />
    </Suspense>
  );
}