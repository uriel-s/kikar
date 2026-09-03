import "./App.css";
import React from "react";
import { AuthProvider } from "./contexts/AuthContext";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect,
  useLocation,
} from "react-router-dom";
import "firebase/auth";
import PrivateRoute from "./Components/PrivateRoute";
import Signin from "./pages/Signin";
import SignUp from "./pages/SignUp";
import Dashbord from "./pages/Dashboard";
import UpdateProfile from "./pages/UpdateProfile";
import Navbar from "./Components/Navbar";
import Footer from "./Components/Footer";
import Plaza from "./Components/Plaza";
import AllUsers from "./pages/AllUsers";
import PostsPage from "./pages/PostsPage";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import SearchResults from "./pages/SearchResults";
import WavesBackground from "./Components/WavesBackground";

const PLAZA_PATH = "/";

/**
 * Renders its children everywhere EXCEPT the plaza.
 *
 * The plaza paves its own floor and draws its own header, so the legacy dark
 * Navbar would be a second header stacked on the first, and WavesBackground —
 * a fixed, animated canvas — would be an animation underneath a ground that is
 * now opaque. Every other route is still the old design and needs both.
 *
 * A <Switch> rather than a pathname comparison: an empty first Route is the
 * router's own way of saying "this path is handled, by nothing", and it keeps
 * the exclusion expressed in the same vocabulary as the route table below.
 */
const OffPlaza = ({ children }) => (
  <Switch>
    <Route exact path={PLAZA_PATH} />
    <Route>{children}</Route>
  </Switch>
);

/**
 * The route-aware wrapper the pages render into.
 *
 * App.css gives `.content` 20px of padding-bottom to separate it from the
 * footer. No padding-top: the redesigned Navbar sits in normal document flow
 * rather than as a fixed bar, so the page already starts right below it.
 * Neither survives contact with the plaza: there is no Navbar on that route at
 * all, and the ground carries its own 46px of bottom padding — so `padding: 0`
 * avoids a stray strip of bare body background immediately below a light paved
 * floor.
 */
const Content = ({ children }) => {
  const onPlaza = useLocation().pathname === PLAZA_PATH;

  return (
    <div className="content" style={onPlaza ? { padding: 0 } : undefined}>
      {children}
    </div>
  );
};

/*
 * PostsPage is rewritten into notices in a later sub-task; wrapping it now
 * makes the shell real and reviewable, with the old feed markup standing on the
 * new ground in the meantime.
 */
const Square = () => (
  <Plaza>
    <PostsPage />
  </Plaza>
);

function App() {
  return (
    <div className="App">
      <Router>
        {/*
         * Outside AuthProvider, which renders nothing at all until Firebase has
         * answered — the canvas used to sit outside the Router entirely and
         * paint immediately, and moving it inside the provider would replace
         * that first frame with a blank page.
         */}
        <OffPlaza>
          <WavesBackground />
        </OffPlaza>

        <AuthProvider>
          <OffPlaza>
            <Navbar />
          </OffPlaza>

          <Content>
            <Switch>
              {/* Private routes - require authentication */}
              {/* The square is the home screen: the design has no separate
                  dashboard-shaped landing page. */}
              <PrivateRoute exact path={PLAZA_PATH} component={Square} />
              <PrivateRoute path="/me" component={Dashbord} />
              <PrivateRoute path="/update-profile" component={UpdateProfile} />
              <PrivateRoute path="/allusers" component={AllUsers} />
              <PrivateRoute path="/search" component={SearchResults} />

              {/* Footer and the old navbar still link to /posts, and so do any
                  bookmarks. The feed lives at / now, so send them there rather
                  than editing every call site. */}
              <Redirect from="/posts" to={PLAZA_PATH} />

              {/* Public routes */}
              <Route path="/signup" component={SignUp} />
              <Route path="/signin" component={Signin} />
              <Route path="/privacy" component={Privacy} />
              <Route path="/terms" component={Terms} />
              <Route path="/contact" component={Contact} />

              {/* Redirect to home if no route matches */}
              <Redirect to={PLAZA_PATH} />
            </Switch>
          </Content>

          <Footer />
        </AuthProvider>
      </Router>
    </div>
  );
}

export default App;
