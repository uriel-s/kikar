# Leaked Firebase service account key

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

## Status

The key is **not** present in the rebuilt monorepo — its history was rewritten
with `git-filter-repo` before the two repositories were merged, so the blob does
not exist in this repository at all.

It is still live in the two original GitHub repositories until you act on the
steps below.

## What you need to do

The key must be assumed compromised. It was publicly readable for roughly four
years, and GitHub is continuously scraped for exactly this. Rotating it is not
optional, and it is the step that actually matters — rewriting history without
rotating leaves a working credential in every clone, fork, and cache that
already exists.

### 1. Revoke the key (do this first)

1. [Firebase Console](https://console.firebase.google.com/) → your project
2. ⚙️ **Project settings** → **Service accounts**
3. **Manage service account permissions** — this opens Google Cloud IAM
4. Find the `firebase-adminsdk-...` service account → **Keys**
5. **Delete** the existing key
6. **Add key → Create new key → JSON**, and store it somewhere that is not a git
   repository

Once deleted, the leaked key stops working immediately, everywhere.

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

Now that history is rewritten here, the old repositories are the remaining
exposure. Pick one:

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
