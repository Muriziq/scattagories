"use client"
import { FaUser } from "react-icons/fa"
import Image from "next/image"
import styles from "./profile.module.css"

export default function Profile(){
    return(
        <main>
            <UsersInfo />
            <Stats />
            <History />
        </main>
    )
}

function UsersInfo(){
    return(
        <section>
            <div>
                <input type="file" name="" id="" />
                <Image src="" alt="User Image" width={100} height={100} />
                <FaUser />
            </div>
            <h1>Hi, Username</h1>
        </section>
    )
}

function Stats(){
    return(        
    <section>
        <div>
            <h3>Total Wins</h3>
            <p>30</p>
        </div>
        <div>
            <h3>Total Games Played </h3>
            <p>30</p>
        </div>
        <div>
            <h3>Total Lifetime Points</h3>
            <p>30</p>
        </div>
    </section>
    )
}

function History(){
return (
  <table>
    <thead>
      <tr>
        <th>Game ID</th> <th>Date Played</th> <th>Placement</th> <th>Individual Score</th> <th>Opponents</th> </tr>
    </thead>
    <tbody>
      <tr>
        <td>#A7F92</td> <td>Oct 24, 2026</td> <td>1st Place 🏆</td> <td>32 pts</td> <td>@alex, @sam</td> </tr>
      <tr>
        <td>#B3K11</td> <td>Oct 23, 2026</td> <td>2nd Place</td> <td>24 pts</td> <td>@jordan, @taylor</td> </tr>
      <tr>
        <td>#C9L04</td> <td>Oct 20, 2026</td> <td>3rd Place</td> <td>12 pts</td> <td>@casey, @alex</td> </tr>
    </tbody>
  </table>
);
}