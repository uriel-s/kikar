import axios from "axios";
import { auth } from "../firebase";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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
