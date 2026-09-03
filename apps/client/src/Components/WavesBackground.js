import React from "react";

/*
 * The paved ground behind every off-plaza screen — Signin, AllUsers,
 * Dashboard, the lot. Fixed and full-viewport, at zIndex -1, so Navbar and
 * whatever the route renders sit on top of it in the normal document flow the
 * same way Plaza's own children sit on the ground it paints.
 *
 * This used to be a <canvas> running a dark animated wave loop — a different,
 * decorative visual language with nothing in common with Slate. Now it is the
 * exact same `paving` utility Plaza.js's own ground uses (theme.css), so every
 * route stands on one continuous floor rather than the plaza alone. No props:
 * the only call site (App.js) passes none, and the old `showControls` debug
 * panel was decoration for the wave visual this component no longer draws.
 */
const WavesBackground = () => (
  <div
    className="paving"
    aria-hidden="true"
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      zIndex: -1,
    }}
  />
);

export default WavesBackground;
