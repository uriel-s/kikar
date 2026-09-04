import "./App.css";
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./contexts/AuthContext";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
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
 * A <Routes> rather than a pathname comparison: an explicit `element={null}`
 * at the plaza path is the router's own way of saying "this path is handled,
 * by nothing", and a "*" fallback renders the children everywhere else — the
 * same exclusion the v5 empty-Route-inside-a-Switch pattern expressed, just
 * in v7's vocabulary (v6+ Route always needs a path; there is no bare
 * catch-all "last Route wins" behavior without one).
 */
const OffPlaza = ({ children }: { children: React.ReactNode }) => (
  <Routes>
    <Route path={PLAZA_PATH} element={null} />
    <Route path="*" element={<>{children}</>} />
  </Routes>
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
const Content = ({ children }: { children: React.ReactNode }) => {
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
    // Outermost so every descendant — Router, AuthProvider, every route — can
    // read and write the cache; stage 6 moves data fetching into useQuery one
    // page at a time, and each of those needs the provider already in place.
    <QueryClientProvider client={queryClient}>
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
              <Routes>
                {/* Private routes - require authentication */}
                {/* The square is the home screen: the design has no separate
                    dashboard-shaped landing page. */}
                <Route
                  path={PLAZA_PATH}
                  element={
                    <PrivateRoute>
                      <Square />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/me"
                  element={
                    <PrivateRoute>
                      <Dashbord />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/update-profile"
                  element={
                    <PrivateRoute>
                      <UpdateProfile />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/allusers"
                  element={
                    <PrivateRoute>
                      <AllUsers />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/search"
                  element={
                    <PrivateRoute>
                      <SearchResults />
                    </PrivateRoute>
                  }
                />

                {/* Footer and the old navbar still link to /posts, and so do any
                    bookmarks. The feed lives at / now, so send them there rather
                    than editing every call site. */}
                <Route path="/posts" element={<Navigate to={PLAZA_PATH} replace />} />

                {/* Public routes */}
                <Route path="/signup" element={<SignUp />} />
                <Route path="/signin" element={<Signin />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/contact" element={<Contact />} />

                {/* Redirect to home if no route matches */}
                <Route path="*" element={<Navigate to={PLAZA_PATH} replace />} />
              </Routes>
            </Content>

            <Footer />
          </AuthProvider>
        </Router>
      </div>
    </QueryClientProvider>
  );
}

export default App;
