export default function CreateRoom(){
    return(
        <section>
        <h1>Create Room</h1>
        <Categories/>
        <Settings/>
        <button>CREATE ROOM</button>
        </section>

    )
}

function Categories(){

    return(
        <section>
            <h2>Categories</h2>
            <div>
            <button>Name</button>
                <button>City</button>
                <button>Country</button>
                <button>Food</button>
                <button>Movie</button>
                <button>Animal</button>
                <button>Color</button>
                <button>Sport</button>
            </div>
            <div><input placeholder="search categories"/></div>
            <div>
                <button>Name</button>
                <button>City</button>
                <button>Country</button>
                <button>Food</button>
                <button>Movie</button>
                <button>Animal</button>
                <button>Color</button>
                <button>Sport</button>
            </div>
            <div>
                <input type="text" placeholder="Input Pasword" />
            </div>
        </section>
    )
}

function Settings(){
    return(
        <section>
            <div>
                <div>
                    <h3>Public</h3>
                    <small>Anyone can join via matchmaking</small>
                </div>
                <input type="checkbox" name="" id="" />
            </div>
            <div>
                <h3>Number of Players</h3>
                <input type="number" min={2} max={8} name="" id="" />
                <small>2-8 Players allowed</small>
            </div>
            <div>
                <h3>Max Time per round</h3>
                <input type="number" name="" id="" />
                <small>seconds</small>
            </div>
        </section>
    )
}

