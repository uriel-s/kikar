import React, { useRef, useEffect ,useState} from "react"
import { useAuth } from "../contexts/AuthContext"
import Alert from "react-bootstrap/Alert"
import { Link, useHistory } from "react-router-dom"
import axios from "axios"
import { FaEdit } from 'react-icons/fa'; // Import an icon for the edit button

function UpdateProfile() {
  const nameRef = useRef()
  const addressRef = useRef()
  const brithRef = useRef()
  const passwordRef = useRef()
  const passwordConfirmRef = useRef()
  //const avatarRef = useRef(); // Reference to the file input element
  const { currentUser, updatePassword, updateEmail ,getId} = useAuth()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const history = useHistory()
  const [user, setUser] = useState({})
  const [image, setImage] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const UserId = getId();
      const res = await axios.get(`http://localhost:5000/users/${UserId}`);

      setUser(res.data);
  
      // Set the value of nameRef only if the field exists
      if (nameRef.current) {
        console.log("debug2 Response: ", res.data);
        nameRef.current.value = res.data.name;
        console.log("nameRef = ", nameRef.current.value);
      }
    };
      getUser();
  }, [getId]);
    
  
  const handleImageChange = (e) => {
    console.log("uriel1")
    if (e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };
 
  let cancelUpload;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (passwordRef.current.value !== passwordConfirmRef.current.value) {
      return setError("Passwords do not match");
    }
    setLoading(true);
    setError("");

    // Update firestore data
    try {
        let config ={
            headers: {'Content-Type': 'application/json'  }  
        }
        let formData = {
            name: nameRef.current.value, 
            address : addressRef.current.value,
            birthDate : brithRef.current.value
        }
       
        await axios.put(`http://localhost:5000/update/${user.id}`,formData,config );
      
        config ={
            headers: {'Content-Type': 'multipart/form-data'  }  ,
            cancelToken : new axios.CancelToken((c) => { cancelUpload = c; }) // Create cancellation 
        }
        console.log("uriel22")

       if(image) {
        // Upload image file to server
        formData = new FormData();
        formData.append("avatar", image);
        await axios.post(`http://localhost:5000/uploadAvatar/${user.id}`, formData, config);
        console.log("uriel2233")
        }
       
      if (passwordRef.current.value) {
        await updatePassword(passwordRef.current.value);
      }
      history.push("/");
    } catch (error) {
      console.error("Error updating profile:", error);
      console.log("Error updating profile:", error);

      setError("Failed to update profile");
    }
    finally {
        setLoading(false);
    }  
};

// Cleanup function to cancel Axios request when component unmounts
useEffect(() => {
    return () => {
        if (cancelUpload) {
            cancelUpload("Operation canceled due to component unmounting.");
        }
    };
}, [cancelUpload]);

const handleEditEmail = () => {
  // Logic to handle email editing (e.g., opening a modal)
  alert("Edit Email is unavilabe right now");
};

  return (
    <div className="mt6">
      <article className="grow br3 ba b--black-10 mv4 w-100 w-50-m w-25-l mw6 shadow-5 center">
        <main className="pa4 black-80">
          <div className="measure">
            <fieldset id="sign_up" className="ba b--transparent ph0 mh0">
              <legend className="f1 fw6 ph0 mh0"><i className="fas fa-wrench"></i> Update Profile</legend>
              {error && <Alert variant="danger">{error}</Alert>}
              <div className="mt3">
                <label className="db fw6 lh-copy f6" htmlFor="email-address">Email</label>
                <span className="flex items-center pa2 ba bg-light-gray w-100 justify-between">
                  {user.email}
                  <FaEdit 
                    className="ml2 cursor-pointer icon-hover" 
                    onClick={handleEditEmail} 
                    title="Edit Email" 
                  />
                </span>
              </div>
              <div className="mt3">
                <label className="db fw6 lh-copy f6" htmlFor="name">Name</label>
                <input
                  defaultValue={user.name}
                  ref={nameRef}
                  className="pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="text"
                  autoComplete="off"
                />
              </div>
             
              <div className="mv3">
                <label className="db fw6 lh-copy f6" htmlFor="password">Password</label>
                <input
                  defaultValue=""
                  //placeholder="Leave blank to keep the same"
                  ref={passwordRef}
                  autoComplete="off"
                  className="b pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="password"
                  name="password"
                />
              </div>
              <div className="mv3">
                <label className="db fw6 lh-copy f6" htmlFor="password">Verify Password </label>
                <input
                  placeholder="Leave blank to keep the same"
                  ref={passwordConfirmRef}
                  className="b pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="password"
                  name="password"
                />
              </div>
              <div className="mt5">
                <label className="db fw6 lh-copy f6" htmlFor="email-address">Adress</label>
                <input
                  defaultValue={user.address}
                  ref={addressRef}
                  className="pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="text"
                />
              </div>
              <div className="mt3">
                <label className="db fw6 lh-copy f6" htmlFor="email-address">BrithDay</label>
                <input
                  defaultValue={user.birthDate}
                  ref={brithRef}
                  className="pa2 input-reset ba bg-transparent hover-bg-black hover-white w-100"
                  type="date"
                />
              </div>


              <div className="mb-3">
  <label className="form-label fw-bold" htmlFor="avatar">Avatar</label>
  <input
    // ref={avatarRef}
    className="form-control border border-secondary bg-transparent hover-bg-black hover-white"
    type="file"
    name="avatar"
    id="avatar"
    accept="image/*" // Allow only image files
    onChange={handleImageChange} // Handle file selection
  />
</div>


              
            </fieldset>
            <div className="text-center">
            <input
              disabled={loading}
              onClick={handleSubmit}
              className={`btn btn-primary ph3 pv2 grow pointer f6 dib ${loading ? 'disabled' : ''}`}
              type="submit"
              value={loading ? "Updating..." : "Update"}
            />
          </div>
          </div>
        </main>
      </article>
      <div className="d-flex justify-content-center mt-3">
  <Link to="/" className="btn btn-outline-secondary btn-lg">
    Cancel
  </Link>
</div>


    </div>
  );
}

export default UpdateProfile;