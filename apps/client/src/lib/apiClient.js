import axios from "axios";
import { auth } from "../firebase";

// Same origin by default in a production build: the API is served from /api on
// the same domain, so a relative base is both correct and immune to a mistyped
// deployment URL. The localhost fallback applies only to `vite dev`, where the
// client is on 3000 and the server on 5000. VITE_API_URL overrides both, which
// is what a split deployment (client and API on different hosts) needs.
//
// The empty string matters: it is falsy, so a bare `|| "http://localhost:5000"`
// would send every request from the deployed site to localhost — and on HTTPS
// the browser blocks that as mixed content before it even fails to connect.
const configured = import.meta.env.VITE_API_URL;
const baseURL = configured || (import.meta.env.DEV ? "http://localhost:5000" : "");

// No default Content-Type on purpose. Axios picks the right one per request:
// application/json for plain objects, and multipart/form-data *with a boundary*
// for FormData. A hardcoded default here would override the latter and produce
// an avatar upload the server cannot parse.
export const api = axios.create({
  baseURL: `${baseURL}/api`,
});

/**
 * Attaches the caller's Firebase ID token to every request.
 *
 * Previously each call site was on its own: most sent no credentials at all,
 * and the one that did (deleting a post) also passed its user id in the body as
 * a "fallback" the server trusted. Doing it here means no endpoint can be
 * called unauthenticated by accident.
 *
 * getIdToken refreshes the token when it is close to expiring, so a long
 * session does not start failing after an hour.
 */
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;

  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/** Turns the API's `{ error: { message, details } }` body into an Error. */
export class ApiRequestError extends Error {
  constructor(message, { status, details } = {}) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.details = details;
  }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const body = error.response.data?.error;
      return Promise.reject(
        new ApiRequestError(body?.message || "Request failed", {
          status: error.response.status,
          details: body?.details,
        })
      );
    }

    return Promise.reject(
      new ApiRequestError("Cannot reach the server. Check your connection.")
    );
  }
);
