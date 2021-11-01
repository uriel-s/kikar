import React, { useRef,  useState} from "react"
import { useAuth } from "../contexts/AuthContext"
import { Link, useHistory } from "react-router-dom"
import  Alert  from "react-bootstrap/Alert"

function Signin() {
   
  const emailRef = useRef()
  const passwordRef = useRef()
  const { login } = useAuth()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const history = useHistory()

//use Firebase signin and link to dashbord 
   async function handleSubmit(e) {
    e.preventDefault()
    try {
      setError("")
      setLoading(true)
      await login(emailRef.current.value, passwordRef.current.value)
      history.push("/")
    }
     catch {
      setError("Failed to login")
    }

    setLoading(false)
  }

    return (
      <div  className="mt6">
      <article className="grow br3 ba b--black-10 mv4 w-100 w-50-m w-25-l mw6 shadow-5 center">
        <main className="pa4 black-80">
          <div className="measure">
            <fieldset id="sign_up" className="ba b--transparent ph0 mh0">
              <legend className="f1 fw6 ph0 mh0">
              <i class="fas fa-door-open"></i>
Login</legend>  
              {error && <Alert variant="danger">{error}</Alert>}
              <div className="mt3">
                <label className="db fw6 lh-copy f6" htmlFor="email-address">Email</label>
                <input
                 ref = {emailRef}
                  className="pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="email"
                  name="email-address"
                  id="email-address"
                />
              </div>
              
              <div className="mv3">
                <label className="db fw6 lh-copy f6" htmlFor="password">Password</label>
                <input
                  ref = {passwordRef}            
                  className="b pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="password"
                  name="password"
                  id="password"
                />
              </div>
          
            </fieldset>
            <div className="">
              <input
              disabled = {loading}
                onClick={handleSubmit}
                className="b ph3 pv2 input-reset ba b--black bg-transparent grow pointer f6 dib"
                type="submit"
                value="login"
              />
            </div>
          </div>
        </main>
      </article>
      <div className="w-100 grow text-center mt-2">
        Need an account? <Link to="/signup">Sign Up</Link>
      </div>
        </div>
    )
}

export default Signin
