import "./App.css";
import React from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { BrowserRouter as Router, Switch, Route, Redirect } from "react-router-dom";
import "firebase/auth";
import PrivateRoute from "./Components/PrivateRoute";
import Signin from "./pages/Signin";
import SignUp from "./pages/SignUp";
import Dashbord from "./pages/Dashboard";
import UpdateProfile from "./pages/UpdateProfile";
import Navbar from "./Components/Navbar";
import Footer from "./Components/Footer";
import AllUsers from "./pages/AllUsers";
import PostsPage from "./pages/PostsPage";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import SearchResults from "./pages/SearchResults";
import WavesBackground from "./Components/WavesBackground";

function App() {
  return (
    <div className="App">
      <WavesBackground />
      <Router>
        <AuthProvider>
          <Navbar />
          <div className="content">
            <Switch>
              {/* Private routes - require authentication */}
              <PrivateRoute exact path="/" component={Dashbord} />
              <PrivateRoute path="/update-profile" component={UpdateProfile} />
              <PrivateRoute path="/allusers" component={AllUsers} />
              <PrivateRoute path="/posts" component={PostsPage} />
              <PrivateRoute path="/search" component={SearchResults} />

              {/* Public routes */}
              <Route path="/signup" component={SignUp} />
              <Route path="/signin" component={Signin} />
              <Route path="/privacy" component={Privacy} />
              <Route path="/terms" component={Terms} />
              <Route path="/contact" component={Contact} />

              {/* Redirect to home if no route matches */}
              <Redirect to="/" />
            </Switch>
          </div>
          <Footer />
        </AuthProvider>
      </Router>
    </div>
  );
}

export default App;
