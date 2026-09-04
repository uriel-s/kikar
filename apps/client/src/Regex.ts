/**
 * A light client-side email check, for feedback before submitting.
 *
 * The previous pattern was `^[a-zA-Z0-9._:$!%-]+@[a-zA-Z0-9.-]+.[a-zA-Z]$`, in
 * which the dot before the final class was unescaped — so it matched any
 * character — and the top-level domain was a single letter. Between the two,
 * "foo@bar" (no domain suffix at all) was accepted.
 *
 * Authoritative validation is Firebase's: it is the system that owns email
 * addresses and the one that verifies them.
 */
export const validEmail = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
