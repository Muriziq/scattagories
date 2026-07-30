export default function JoinRoom(){
    return(
        <section>
            <h1>Join Room</h1>
            <form action="">
                <div>
                    <label htmlFor="code">Room Code</label>
                    <input type="text" id="code" placeholder="Enter Room Code" />
                </div>
                <button type="submit">Join Room</button>
            </form>
        </section>
    )
}
function PublicSearch(){
    return(
        <section>
            <div>
            <h3>Public Rooms</h3>
            <div><input placeholder="search rooms"/></div>
            </div>
            <div>
            <h3>Private Rooms</h3>
            <div>
                <input placeholder="roomid"/>
                <input placeholder="password"/>
                
                <button>Join</button>
            </div>
            </div>
        </section>
    )
}
function PublicRoomsRows(){
    return(
        <table>
            <thead>
                <tr>
                    <th>Room Code</th>
                    <th>Category</th>
                    <th>No Of Players</th>
                    <th>Max Timer</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>A1B2</td>
                    <td>Name, City, Country, Food, Movie, Animal, Color, Sport</td>
                    <td>10/2</td>
                    <td>2 Mins</td>
                    <td><button>Join</button></td>
                </tr>
            </tbody>
        </table>
    )
}