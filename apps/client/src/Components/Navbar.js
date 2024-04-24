import React from 'react'
import {  useHistory , } from "react-router-dom"
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
        <a className="navbar-brand" href="/">Moveo <i className="fas fa-grip-lines-vertical"></i> </a>
    
            <form className="form-inline">
            { currentUser ?
             <div>
                <a className="mr3 gray " href="/"  onClick={handleLogout}>
                  
                <i className="fas fa-user-times"></i>
                 </a>
                </div>
                :
                <div className="navbar" > 
                    <a className="gray mr3"  href="SignUp">  <i class="fas fa-user-plus"></i>  </a>
                    <a className="gray mr4"  href="Signin"> <i class="fas fa-sign-in-alt"></i> </a>
                </div> 
                }
            </form>
        </nav>  
        </div>
    )
}

export default Navbar
