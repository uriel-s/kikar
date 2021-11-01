import React, { useState ,useEffect,} from "react"
import {  Button, Alert } from "react-bootstrap"
import { useAuth } from "../contexts/AuthContext"
import { Link, useHistory } from "react-router-dom"
import  axios  from "axios"


export default function Dashboard() {
  const [error, setError] = useState("")
  const { currentUser, logout } = useAuth()
  const [user, setUser] = useState({})
  const random = Math.floor(Math.random() * 20)
  const history = useHistory()

  //exit from currnet User
  async function handleLogout() {
    setError("")
    try {
      await logout()
      history.push("/signin")
    } 
    catch {
      setError("Failed to log out")
    }
  }


  //fetch firestore dataBase and bring current User details
  useEffect( () => {
    const getUser  = async() => {
      const res = await axios.get(`https://moveo-server.herokuapp.com/users/${currentUser.uid}`);
      setUser(res.data);
    };
    getUser();
  },[]) ;

  
  return (
    <div>

    <article className="grow br3 ba b--black-10 mv4 w-100 w-50-m w-25-l mw6 shadow-5 center">
      <main className="pa4 black-80">
        <div className="measure">
          <fieldset id="sign_up" className="ba b--transparent ph0 mh0">
            <legend className="f1 fw6 ph0 mh0">{user.name}</legend>  
            {error && <Alert variant="danger">{error}</Alert>}
           <div className="w-100 grow"><img src={`https://randomuser.me/api/portraits/men/${random}.jpg`} alt="" className="rounded-circle"></img></div>  
           <div className="mt4 grow">  <strong>Email:</strong> {user.email} </div>
           <div className="mr4 grow">  <strong>name:</strong> {user.name} </div>
           <div className="measure grow">  <strong>Address:</strong> {user.address} </div>
           <div className="measure grow">  <strong>birthDate:</strong> {user.birthDate} </div>

          <Link to="/update-profile" className="grow btn btn-primary w-100 mt-3">
          <i class="fas fa-pen-alt"></i>
Update Profile
          </Link>
          

      <div className="w-100 text-center mt-2 grow">
        <Button variant="link" onClick={handleLogout}>
        <i class="fas fa-sign-out-alt"></i>
          Log Out
        </Button>
      </div>
      
    
          </fieldset>
        </div>
      </main>
    </article>
   
      </div>
  )
    
}
