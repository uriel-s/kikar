import React from 'react'
import { Link, useHistory , } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"

const Navbar = () => {
    const {  logout } = useAuth()
    const history = useHistory()


//exit from currnet User
async function handleLogout() {
      await logout()
      history.push("/signin")
    } 
    
  

    const { currentUser } = useAuth()
    return (
        <div>
        <nav className="navbar  fixed-top bg-light   navbar-dark bg-dark justify-content-between">
             <a className="navbar-brand">Moveo </a>
            <form className="form-inline">
            { currentUser ? 
                <a className="nav-link  " href="#"  onClick={handleLogout}>Log Out </a>
                :
                <div className="navbar" > 
                    <a className="nav-link"  href="SignUp"> Register  </a>
                    <a className="nav-link"  href="SignUp"> Log In </a>
                </div> 
                }
            </form>
        </nav>  
        </div>
    )
}

export default Navbar
