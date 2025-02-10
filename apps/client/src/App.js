//import './App.css';
//import React,{useState} from 'react'
import { AuthProvider } from "./contexts/AuthContext"
import { BrowserRouter as Router, Switch, Route, Redirect } from "react-router-dom"
import 'firebase/auth';

import PrivateRoute from "./Components/PrivateRoute"
import Signin from './pages/Signin';
import SignUp from './pages/SignUp';
import Dashbord from './pages/Dashboard';
import UpdateProfile from './pages/UpdateProfile';
import Navbar from './Components/Navbar';
import AllUsers from './pages/AllUsers';


function App() {
  return (
    <div className="App">
      <Router>
        <AuthProvider>
          <Navbar/>
          <Switch>
            <PrivateRoute exact path="/" component={Dashbord} />
            <PrivateRoute path="/update-profile" component={UpdateProfile} />
            <PrivateRoute path="/allusers" component={AllUsers} />
            <Route path="/signup" component={SignUp} />
            <Route path="/signin" component={Signin} />
            <Redirect to="/" />
          </Switch>
        </AuthProvider>
      </Router>
    </div>
  );
}



export default App;
