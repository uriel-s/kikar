# Leaked Firebase service account key

> **Status: resolved.** The key belonged to project `moveo-de052`, and its
> service account (`firebase-adminsdk-ckkgm`) has since been deleted — the
> project's service account list is empty. A key cannot authenticate without
> its service account, so the leaked credential is permanently dead. It has
> also been removed from this repository's history.
>
> Nothing below requires action. It is kept as a record of what happened and
> what the checks were.
>
> One thing worth knowing: the deletion date is not recorded here, so there is
> no way to tell how long the key was both public *and* live. If anything of
> value ever lived in `moveo-de052`, its audit logs are the place to look.

## What happened

`serviceAccountKey.json` was committed to `uriel-s/gazhan-server` in commit
`f900495` ("make it better", 2021-10-22). It was later removed from the working
tree and added to `.gitignore` — but removing a file in a later commit does not
remove it from history. The blob stayed reachable from `main` in the public
repository, and anyone could retrieve it with:

```bash
git clone https://github.com/uriel-s/gazhan-server
git show f900495:serviceAccountKey.json
```

A Firebase service account key is an administrative credential. It authenticates
as the project itself, which means it **bypasses every Firestore and Storage
security rule**. Whoever holds it can read and delete all data in the project,
read and write every file in the storage bucket, and mint custom auth tokens
that impersonate any user.

Note which project it belonged to: **`moveo-de052`**, an earlier Firebase
project for this same app, not `palhan-b30d2` which the application actually
uses. The Palhan credentials were never committed and were never at risk.

## How it was verified as dead

1. **The key is a real credential.** The committed file is 2,346 bytes and
   contains `private_key` with actual RSA key material, plus `client_email`,
   `private_key_id`, and `project_id` — not a placeholder.
2. **It identifies `moveo-de052`.** `client_email` is
   `firebase-adminsdk-ckkgm@moveo-de052.iam.gserviceaccount.com`, key id
   `6c648ecfa8a4e3e202249ac5da9076f4f623850c`.
3. **Its key id does not match anything active in Palhan.** The Palhan service
   account shows a different key id, confirming the two are unrelated.
4. **The owning service account no longer exists.** The IAM service account
   list for `moveo-de052` is empty. Deleting a service account permanently
   invalidates every key issued to it.

The `moveo-de052` project itself still exists — an unauthenticated probe with
its public web API key returns its authorized domains — but with no service
accounts, there is nothing for the leaked key to authenticate as.

## History rewrite

The key is **not** present in this repository. Its blob was stripped with
`git-filter-repo` before the two source repositories were merged, and a scan of
all 58 commits finds no private key material anywhere.

The original `uriel-s/gazhan-server` on GitHub still contains it in history. That
now matters only for tidiness rather than security, since the credential is
dead — but see [Deal with the old repositories](#4-deal-with-the-old-repositories)
below.

## Reference: what would have been required if the key were live

Kept for the record. None of this is needed now.

### 1. Revoke the key

1. [Firebase Console](https://console.firebase.google.com/) → the project
2. ⚙️ **Project settings** → **Service accounts**
3. **Manage service account permissions** — this opens Google Cloud IAM
4. Find the `firebase-adminsdk-...` service account → **Keys**
5. **Delete** the existing key
6. **Add key → Create new key → JSON**, and store it somewhere that is not a git
   repository

Revocation is the step that matters. Rewriting history without revoking leaves a
working credential in every clone, fork, and cache that already exists.

### 2. Check whether it was used

In the Google Cloud console, **Logging → Logs Explorer**, look for
authentications by that service account from addresses you do not recognise:

```
protoPayload.authenticationInfo.principalEmail =~ "firebase-adminsdk"
```

Also worth a look: Firestore documents you did not create, unfamiliar objects in
the storage bucket, and unexpected accounts in Firebase Auth.

### 3. Put the new key where the app expects it

Set exactly one of these in `.env` (never committed):

```bash
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account", ...}'   # containers, CI
# or
FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/outside/the/repo.json
```

### 4. Deal with the old repositories

The old repositories still carry the (now dead) key in their history. Pick one:

**Simplest — delete or archive them.** The full history lives in this monorepo,
so nothing is lost. Point the GitHub profile at the new repository.

**Or rewrite their history in place.** This changes every commit hash, breaks
existing clones, and requires a force push:

```bash
pip install git-filter-repo

git clone --mirror https://github.com/uriel-s/gazhan-server
cd gazhan-server.git
git filter-repo --path serviceAccountKey.json --invert-paths --force

git push --force --all
git push --force --tags
```

Be aware of the limits: GitHub keeps unreferenced objects reachable through the
API for a while, forks are not rewritten, and anyone who already cloned still
has the key. This is why step 1 is the one that counts.

### 5. Stop it happening again

Already in place here:

- `.gitignore` blocks `*serviceAccountKey*.json`, `*service-account*.json`,
  `*firebase-adminsdk*.json`, `*.pem`, `*.key`, and `.env`
- `.dockerignore` keeps the same files out of build contexts
- The server reads credentials from the environment, so there is no file for
  someone to accidentally add

Worth enabling on the repository: **Settings → Code security → Secret scanning**
and **Push protection**, which blocks a commit containing a recognised
credential before it reaches GitHub.
