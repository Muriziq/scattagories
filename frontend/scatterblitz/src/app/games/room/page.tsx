import CreateRoom from "./components/createRoom";
import JoinRoom from "./components/joinRoom";
export default function Room(){
    return(
        <main>
            <div>
                <button>Create Room</button>
                <button>Join Room</button>
            </div>
            <CreateRoom/>
            <JoinRoom/>
        </main>
    )
}