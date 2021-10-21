import React, { useRef,  useState} from "react"
import { useAuth } from "../contexts/AuthContext"
import  Alert  from "react-bootstrap/Alert"
import  axios  from "axios"
import { v4 as uuidv4 } from 'uuid';
import { validEmail, validPassword } from '../Regex';

import { Link, useHistory , } from "react-router-dom"

function SignUp() {
   
  const nameRef = useRef()
  const emailRef = useRef()
  const passwordRef = useRef()
  const passwordConfirmRef = useRef()
  const brithDayRef = useRef()
  const adrresRef = useRef()
  const { signup } = useAuth()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const history = useHistory()

//validation of input value : Password , Email ....
  const validation = ()=> {
    if (passwordRef.current.value !== passwordConfirmRef.current.value) {
      return ("Passwords do not match")
    }
  

   if (passwordRef.current.value.length < 6) {
    return ("Password must have 6 char or more")
  }

  if (!validEmail.test(emailRef.current.value)) {
    return ("invalid Email")
 }

   if (!validPassword.test(passwordRef.current.value)) {
    return ("invalid Password")
  }
 return "null"
  }

   async function handleSubmit(e) {
    const id = uuidv4(); //uniq Id from User
    e.preventDefault()
    
    const Valid = validation()//if input invalid return the  error
    if (Valid != "null")  return setError(Valid)

    //Header and Body for Fetch 
      const config ={
        headers: {
            'Content-Type': 'application/json'
         }
      }
      const formData = {
      id : id,
      email : emailRef.current.value,
      name: nameRef.current.value, 
      address : adrresRef.current.value,
      birthDate : brithDayRef.current.value
          }

    try{
      //Add new User details to fireStore
      const res = await axios.post('https://moveo-server.herokuapp.com/add', formData, config);
      console.log("res = " , res)
    } 
    catch {
      return  setError("Failed to send new Account")
    }
    try {
      setError("")
      setLoading(true)
      await signup(emailRef.current.value, passwordRef.current.value)
     
       await history.push("/")
    }

    catch {
      return setError("Failed to create an account")
    }
    setLoading(false)
  }

    return (
        <div>

      <article className="grow br3 ba b--black-10 mv4 w-100 w-50-m w-25-l mw6 shadow-5 center">
        <main className="pa4 black-80">
          <div className="measure">
            <fieldset id="sign_up" className="ba b--transparent ph0 mh0">
              <legend className="f1 fw6 ph0 mh0">Register  
              <i class="fas fa-user-plus"></i>

              </legend>
              {error && <Alert variant="danger">{error}</Alert>}
              
              
            
              <div className="mt3">
                <label className="db fw6 lh-copy f6" htmlFor="email-address">* Email</label>
                <input
                 ref = {emailRef}
                  className="pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="email"
                  name="email-address"
                  id="email-address"
                   />
              </div>
              

              
              <div className="mv3">
                <label className="db fw6 lh-copy f6" htmlFor="password">* Password</label>
                <input
                  ref = {passwordRef}            
                  className="b pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="password"
                  name="password"
                  id="password"
                   />
              </div>

              <div className="mv3">
                <label className="db fw6 lh-copy f6" htmlFor="password">* Verify Password </label>
                <input
                  ref = {passwordConfirmRef}
                  className="b pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="password"
                  name="password"
                  id="password"
                   />
              </div>

              <div className="mt6 mt3">
                <label className="db fw6 lh-copy f6" htmlFor="name">Name</label>
                <input
                 ref = {nameRef}
                  className="pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="text"
                  name="name"
                  id="name"
                />
              </div>


              <div className="mt3">
                <label className="db fw6 lh-copy f6"htmlFor="password" >Addres</label>
                <input
                 ref = {adrresRef}
                  className="pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="text"
                
                />
              </div>
              

              <div className="mv3">
                <label className="db fw6 lh-copy f6" htmlFor="password">Brith Day </label>
                <input
                  ref = {brithDayRef}
                  className="b pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="date"
                  
                />
              </div>
          
            </fieldset>
            <div className="">
              <input
              disabled = {loading}
                onClick={handleSubmit}
                className="b ph3 pv2 input-reset ba b--black bg-transparent grow pointer f6 dib"
                type="submit"
                value="Register"
              />
            </div>
          </div>
        </main>
      </article>
      <div className="w-100 text-center mt-2 grow">
        Already have an account? <Link to="/signin">Log In</Link>
      </div>
        </div>
        
    )
}

export default SignUp