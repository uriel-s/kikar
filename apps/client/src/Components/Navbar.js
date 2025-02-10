import React, { useState } from "react";
import { useHistory, Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const Navbar = () => {
    const { logout, currentUser } = useAuth();
    const history = useHistory();
    const location = useLocation();
    const [isMenuActive, setIsMenuActive] = useState(false);

    // Function to handle logout
    async function handleLogout() {
        await logout();
        history.push("/signin");
    }

    // Function to navigate to AllUsers or to Home
    const handleAllUsers = () => {
        if (location.pathname === '/allusers') {
            history.push("/"); // Navigate to home if already on /allusers
        } else {
            history.push("/allusers");
        }
    };

    // Toggle the menu for mobile view
    const toggleNavbar = () => {
        setIsMenuActive(!isMenuActive);
    };

    return (
        <div>
            <nav className="navbar">
                <div className="navbar-logo">
                    Palhan <i className="fas fa-grip-lines-vertical"></i>
                </div>

                <div className={`navbar-menu ${isMenuActive ? 'active' : ''}`}>
                    {currentUser ? (
                        <div>
                            <a className="mr3" onClick={handleAllUsers}>
                                <i className={`fas ${location.pathname === '/allusers' ? 'fa-home' : 'fa-users'}`}></i>
                            </a>

                            <a className="mr3" onClick={handleLogout}>
                                <i className="fas fa-user-times"></i>
                            </a>
                        </div>
                    ) : (
                        <div>
                            <Link className="mr3" to="/signup">
                                <i className="fas fa-user-plus"></i>
                            </Link>
                            <Link className="mr4" to="/signin">
                                <i className="fas fa-sign-in-alt"></i>
                            </Link>
                        </div>
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
