import './App.css';
//import React,{useState} from 'react'
import { AuthProvider } from "./contexts/AuthContext"
import { BrowserRouter as Router, Switch, Route } from "react-router-dom"
import 'firebase/auth';
import PrivateRoute from "./Components/PrivateRoute"
import Signin from './Components/Signin';
import SignUp from './Components/SignUp';
import Dashbord from './Components/Dashboard';
import UpdateProfile from './Components/UpdateProfile';
import Navbar from './Components/Navbar';



function App() 
{  
 
  return (
    <div className="App">
        <Router>
         <AuthProvider>
         <Navbar/>
         <Navbar/>
         <Switch>
          <PrivateRoute exact path="/" component={Dashbord} />
          <PrivateRoute path="/update-profile" component={UpdateProfile} />
          <Route path="/signup" component={SignUp} />
          <Route path="/Signin" component={Signin} />
          </Switch>
        </AuthProvider>
      </Router>
    </div>
  );
}

export default App;
