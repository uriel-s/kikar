import { createContext, useContext } from "react";

/**
 * The signed-in person's profile row, as Plaza loaded it.
 *
 * Plaza already fetches this for the avatar in the header, and the rule on this
 * screen is one request per row — so anything below that needs the same person
 * reads it from here instead of asking again. Firebase's own user object is not
 * a substitute: it carries a photoURL that is never the one to draw, because
 * avatars are uploaded to our server and stored on the user row, which never
 * touches the Firebase account record.
 *
 * `null` until the request lands, and `null` forever if it fails. Every reader
 * has to cope with that — `{ id: uid }` alone is enough for avatarColor to draw
 * the disc in the right hue, so the fallback is a correct avatar rather than a
 * missing one.
 */
export const PlazaProfileContext = createContext(null);

export const usePlazaProfile = () => useContext(PlazaProfileContext);
