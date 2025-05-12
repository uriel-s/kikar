import React, { useState } from "react";
import { useHistory, Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const Navbar = () => {
  const { logout, currentUser } = useAuth();
  const history = useHistory();
  const location = useLocation();
  const [isMenuActive, setIsMenuActive] = useState(false);

  const handleLogout = async () => {
    await logout();
    history.push("/signin");
  };

  const handleNavigate = (path) => {
    history.push(path);
    setIsMenuActive(false); // close the menu on navigation
  };

  const toggleNavbar = () => {
    setIsMenuActive(!isMenuActive);
  };

  return (
    <div>
      <nav className="navbar">
        <div className="navbar-logo">
          Palhan <i className="fas fa-grip-lines-vertical"></i>
        </div>

        <div className={`navbar-menu ${isMenuActive ? "active" : ""}`}>
          {currentUser ? (
            <>
              {/* All Users Icon */}
              <button onClick={() => handleNavigate("/allusers")}>
                <i className="fas fa-users"></i>
              </button>

              {/* Posts Icon */}
              <button onClick={() => handleNavigate("/posts")}>
                <i className="fas fa-pen"></i> {/* Posts Icon */}
              </button>

              {/* Logout Icon */}
              <button onClick={handleLogout}>
                <i className="fas fa-user-times"></i>
              </button>

              {/* Home Icon - Move it to the end */}
              <button onClick={() => handleNavigate("/")}>
                <i className="fas fa-home"></i>
              </button>
            </>
          ) : (
            <>
              {/* Sign Up Icon */}
              <Link to="/signup">
                <i className="fas fa-user-plus"></i>
              </Link>

              {/* Sign In Icon */}
              <Link to="/signin">
                <i className="fas fa-sign-in-alt"></i>
              </Link>
            </>
          )}
        </div>

        <div className="navbar-toggle" onClick={toggleNavbar}>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
