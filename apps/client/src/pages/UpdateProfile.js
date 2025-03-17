import React, { useRef, useEffect, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import Alert from "react-bootstrap/Alert";
import { Link, useHistory } from "react-router-dom";
import axios from "axios";
import { FaEdit } from 'react-icons/fa';
import { apiUrl } from '../Global/config.js';

function UpdateProfile() {
  const nameRef = useRef();
  const addressRef = useRef();
  const brithRef = useRef();
  const passwordRef = useRef();
  const passwordConfirmRef = useRef();
  const { currentUser, updatePassword, getId } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const [user, setUser] = useState({ name: '', address: '', birthDate: '' });
  const [image, setImage] = useState(null);
  const [password, setPassword] = useState("");  // State to control the password value
  const [successMessage, setSuccessMessage] = useState("");  // To show success message
  let cancelUpload;

  useEffect(() => {
    const getUser = async () => {
      const UserId = getId();
      try {
        const res = await axios.get(`${apiUrl}/users/${UserId}`);
        setUser(res.data);

        // Set the value of nameRef only if the field exists
        if (nameRef.current) {
          nameRef.current.value = res.data.name;
        }
      } catch (err) {
        setError("Failed to load user data.");
      }
    };
    getUser();
  }, [getId]);

  const handleImageChange = useCallback((e) => {
    if (e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== passwordConfirmRef.current.value) {
      return setError("Passwords do not match");
    }
    setLoading(true);
    setError("");

    try {
      let config = {
        headers: { 'Content-Type': 'application/json' }
      };

      let formData = {
        name: nameRef.current.value,
        address: addressRef.current.value,
        birthDate: brithRef.current.value
      };

      // Update user data
      await axios.put(`${apiUrl}/users/${user.id}`, formData, config);

      // Handle avatar image upload
      if (image) {
        config = {
          headers: { 'Content-Type': 'multipart/form-data' },
          cancelToken: new axios.CancelToken((c) => { cancelUpload = c; })
        };
        formData = new FormData();
        formData.append("avatar", image);
        await axios.post(`${apiUrl}/users/avatar/${user.id}`, formData, config);
      }

      // Update password if provided
      if (password) {
        await updatePassword(password);
      }

      setSuccessMessage("Profile updated successfully!");  // Display success message
      history.push("/");
    } catch (err) {
      setError("Failed to update profile: " + err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (cancelUpload) {
        cancelUpload("Operation canceled due to component unmounting.");
      }
    };
  }, [cancelUpload]);

  const handleEditEmail = () => {
    alert("Edit Email is unavailable right now");
  };

  return (
    <div className="mt6">
      <article className="grow br3 ba b--black-10 mv4 w-100 w-50-m w-25-l mw6 shadow-5 center">
        <main className="pa4 black-80">
          <div className="measure">
            <fieldset id="sign_up" className="ba b--transparent ph0 mh0">
              <legend className="f1 fw6 ph0 mh0"><i className="fas fa-wrench"></i> Update Profile</legend>
              {error && <Alert variant="danger">{error}</Alert>}
              {successMessage && <Alert variant="success">{successMessage}</Alert>} {/* Success message */}
              
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
                  value={user.name}  // Changed to 'value' to ensure two-way data binding
                  ref={nameRef}
                  className="pa2 input-reset ba hover:bg-gray-700 w-100"
                  type="text"
                  autoComplete="off"
                  onChange={() => setUser({ ...user, name: nameRef.current.value })}
                />
              </div>

              <div className="mv3">
                <label className="db fw6 lh-copy f6" htmlFor="password">Password</label>
                <input
                  ref={passwordRef}
                  autoComplete="off"
                  className="b pa2 input-reset ba hover:bg-gray-700 w-100"
                  type="password"
                  name="password"
                  value={password} // Bind the value of the password field
                  onChange={(e) => setPassword(e.target.value)} // Update the password state
                />
              </div>

              <div className="mv3">
                <label className="db fw6 lh-copy f6" htmlFor="password">Verify Password</label>
                <input
                  placeholder="Leave blank to keep the same"
                  ref={passwordConfirmRef}
                  className="b pa2 input-reset ba hover:bg-gray-700 w-100"
                  type="password"
                  name="password"
                />
              </div>

              <div className="mt5">
                <label className="db fw6 lh-copy f6" htmlFor="email-address">Address</label>
                <input
                  value={user.address}
                  ref={addressRef}
                  className="pa2 input-reset ba hover:bg-gray-700 w-100"
                  type="text"
                  onChange={() => setUser({ ...user, address: addressRef.current.value })}
                />
              </div>

              <div className="mt3">
                <label className="db fw6 lh-copy f6" htmlFor="email-address">BirthDay</label>
                <input
                  value={user.birthDate}
                  ref={brithRef}
                  className="pa2 input-reset ba hover:bg-gray-700 w-100"
                  type="date"
                  onChange={() => setUser({ ...user, birthDate: brithRef.current.value })}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold" htmlFor="avatar">Avatar</label>
                <input
                  className="form-control border border-secondary bg-transparent hover-bg-black hover-white"
                  type="file"
                  name="avatar"
                  id="avatar"
                  accept="image/*"
                  onChange={handleImageChange}
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
