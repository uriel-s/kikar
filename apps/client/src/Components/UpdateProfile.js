import React, { useRef, useEffect ,useState} from "react"
import { useAuth } from "../contexts/AuthContext"
import  Alert  from "react-bootstrap/Alert"
import { Link, useHistory , } from "react-router-dom"
import  axios  from "axios"

function UpdateProfile() {
   //Commponet incomplite . need to fix
  const nameRef = useRef()
  const emailRef = useRef()
  const addressRef = useRef()
  const brithRef = useRef()
  const passwordRef = useRef()
  const passwordConfirmRef = useRef()
  const { currentUser, updatePassword, updateEmail ,getId} = useAuth()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const history = useHistory()
  const [user, setUser] = useState({})
  
  //fetch firestore dataBase and bring current User details
  useEffect( () => {
    const getUser  = async() => {
   const UserId =getId();
      const res = await axios.get(`https://humanz-server.herokuapp.com/users/${UserId}`);
      setUser(res.data);
    };
    getUser();
  },[]) ;

  //fetch firestore dataBase and bring current User details
  
  useEffect( () => {
    const getUser  = async() => {
      const UserId =getId();
      const res = await axios.get(`https://humanz-server.herokuapp.com/users/${UserId}`);
      setUser(res.data);
    };
    getUser();
  },[loading]) ;


  //Update firestore data base for currnet user
  const updateFireStore = async ( ) =>{
    const config ={
      headers: {'Content-Type': 'application/json'  }  }
    const formData = {
      email : emailRef.current.value,
      name: nameRef.current.value, 
      address : addressRef.current.value,
      birthDate : brithRef.current.value
        }

  try{
     await axios.put(`https://humanz-server.herokuapp.com/update/${user.id}`, formData, config);
    return ("succses")
  } 
  catch {     
     setError("Failed to to update")
    return  setError("Failed to update Account")
  }
  }

//Update firebase and firestore
   async function handleSubmit(e) {
    e.preventDefault()
    if (passwordRef.current.value !== passwordConfirmRef.current.value) {
      return setError("Passwords do not match")
    }
    await setLoading(true)
    setError("")

    //upadte fireStore first , and if update succses contiue update firebase
    const resp=  await(updateFireStore())
    try{
    if(resp === "succses")
     {
      if (emailRef.current.value !== currentUser.email) {
      await(updateEmail(emailRef.current.value))
      }
      if (passwordRef.current.value) {
        await (updatePassword(passwordRef.current.value))
      }
      history.push("/")

    }
  }
catch{
  setError("  Update Failed")
   console.log("update cancel")
  }


 
     
     
  }

    return (
        <div>

      <article className="grow br3 ba b--black-10 mv4 w-100 w-50-m w-25-l mw6 shadow-5 center">
        <main className="pa4 black-80">
          <div className="measure">
            <fieldset id="sign_up" className="ba b--transparent ph0 mh0">
              <legend className="f1 fw6 ph0 mh0">Update Profile</legend>
              {error && <Alert variant="danger">{error}</Alert>}
              <div className="mt3">
                <label className="db fw6 lh-copy f6" htmlFor="name">Name</label>
                <input
                 defaultValue={user.name}
                 ref = {nameRef}
                  className="pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="text"
                 
                />
              </div>
            
              <div className="mt3">
                <label className="db fw6 lh-copy f6" htmlFor="email-address">Email</label>
                <input
                defaultValue={user.email} 
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
                 placeholder="Leave blank to keep the same"
                  ref = {passwordRef}            
                  className="b pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="password"
                  name="password"
                  id="password"
                />
              </div>

              <div className="mv3">
                <label className="db fw6 lh-copy f6" htmlFor="password">Verify Password </label>
                <input
                placeholder="Leave blank to keep the same"
                  ref = {passwordConfirmRef}
                  className="b pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="password"
                  name="password"
                  id="password"
                />
              </div>


              <div className="mt5">
                <label className="db fw6 lh-copy f6" htmlFor="email-address">Adress</label>
                <input
                defaultValue={user.address}
                 ref = {addressRef}
                  className="pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="text"
                 
                />
              </div>



              <div className="mt3">
                <label className="db fw6 lh-copy f6" htmlFor="email-address">BrithDay</label>
                <input
                 defaultValue={user.birthDate}
                 ref = {brithRef}
                  className="pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
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
                value="Update"
              />
            </div>
          </div>
        </main>
      </article>
      <div className="grow w-100 text-center mt-2">
      <Link to="/"> Cancel</Link>
      </div>
        </div>
        
    )
}

export default UpdateProfile
