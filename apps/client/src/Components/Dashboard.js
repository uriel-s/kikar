import React, { useState ,useEffect,} from "react"
import {  Button, Alert } from "react-bootstrap"
import { useAuth } from "../contexts/AuthContext"
import { Link, useHistory } from "react-router-dom"
import  axios  from "axios";
import { getStorage, ref, getDownloadURL } from "firebase/storage";


export default function Dashboard() {
  const [error, setError] = useState("")
  const { currentUser, logout } = useAuth()
  const [user, setUser] = useState({})
  const [imageUrl, setImageUrl] = useState('');

  //const random = Math.floor(Math.random() * 20)
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
     try {

        const res = await axios.get(`http://localhost:5000/users/${currentUser.uid}`);

        console.log("ID == ",currentUser.uid )
        
        setUser(res.data);
     } catch (error) {
      // Handle error, e.g., display an error message or redirect to an error page
      console.error('Error fetching user data:', error);
      }
    };
    getUser();
  },[currentUser.uid,]) ;

  useEffect(() => {
    console.log("uriel11");
  
    // Function to fetch the profile picture URL
    const fetchImageUrl = async () => {
      try {
        const storage = getStorage(); // Initialize Firebase Storage
        const profilePictureRef = ref(storage, `profile_pictures/${currentUser.uid}`); // Create a reference to the file
  
        const url = await getDownloadURL(profilePictureRef); // Get the download URL
        console.log("Download URL?:", url);
  
        setImageUrl(url); // Update the state with the image URL
        console.log("uri %s", url);
      } catch (error) {
        // Handle any errors that occur while fetching the download URL
        console.error("Error getting download URL:", error.message);
      }
    };
  
    fetchImageUrl();
  }, []);
  


  // This useEffect is used for logging the user state after it's updated
  useEffect(() => {
  }, [user]);

  return (
    
    <div  className="mt6">

    <article className="grow br3 ba b--black-10 mv4 w-100 w-50-m  w-25-l mw6 shadow-5 center ">
      <main className="pa4 black-80  ">
        <div className="measure ">
          <fieldset id="sign_up" className="ba b--transparent ph0 mh0">
          <div className="w-100 grow ">
            <img
             src={imageUrl}
              alt="Avatar"
              className="rounded-circle square"
              style={{ width: '200px', height: '200px' }} 
               />
            </div>  

            <legend className="f1 fw6 ph0 mh0">{user.name}</legend>  
            <hr className ="mw5 center bg-white br3 pa3 pa1-ns mv3 ba b--black-30 "></hr>

            {error && <Alert variant="danger">{error}</Alert>}
           <div className="mt4 grow">  <strong>Email:</strong> {user.email} </div>
           <div className="mr4 grow">  <strong>name:</strong> {user.name} </div>
           <div className="measure grow">  <strong>Address:</strong> {user.address} </div>
           <div className="measure grow">  <strong>birthDate:</strong> {user.birthDate} </div>

          <Link to="/update-profile" className="grow btn btn-primary w-100 mt-3">
          <i className="fas fa-pen-alt"></i>
Update Profile
          </Link>
          

      <div className="w-100 text-center mt-2 grow">
        <Button variant="link" onClick={handleLogout}>
        <i className="fas fa-sign-out-alt"></i>
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
