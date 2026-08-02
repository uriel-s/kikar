# Deploying to AWS

The original deployment was a single EC2 instance running `docker build` by
hand, with the client served by `serve -s build` and the API by `nodemon`. This
describes a setup that survives a restart and a deploy.

Nothing here is required to run the project — `docker compose up` is enough for
local work and for a demo.

## Shape

```
Route 53 → CloudFront → S3                 static client bundle
                ↓
              ALB → ECS Fargate            API container
                        ↓
                  RDS PostgreSQL           private subnet, no public access
                        ↓
                  Firebase                 auth tokens, avatar storage
```

Firebase stays in the picture deliberately: it owns identity and file storage.
Moving identity to Cognito would mean every existing user loses their password,
because Firebase does not export password hashes.

## Client

CRA inlines `REACT_APP_*` at build time, so the environment is baked into the
bundle. A build targeting production is a different artifact from a staging one.

```bash
REACT_APP_API_URL=https://api.example.com \
REACT_APP_FIREBASE_API_KEY=... \
npm run build --workspace=@gazhan/client

aws s3 sync apps/client/build s3://your-bucket --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude index.html

# index.html points at the current bundle hashes, so it must never be cached.
aws s3 cp apps/client/build/index.html s3://your-bucket/index.html \
  --cache-control "no-store, must-revalidate"

aws cloudfront create-invalidation --distribution-id ABC --paths "/index.html"
```

Set the CloudFront distribution to return `/index.html` with a 200 for 403 and
404 responses — otherwise a deep link like `/posts` reaches S3, finds no such
key, and fails before React Router ever runs.

## API

```bash
docker build -f apps/server/Dockerfile -t gazhan-api .
docker tag gazhan-api <account>.dkr.ecr.<region>.amazonaws.com/gazhan-api:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/gazhan-api:latest
```

Task definition notes:

- **Health check** `GET /health` — the only unauthenticated route, which is why
  it exists.
- **`stopTimeout`** at least 15s. The server drains in-flight requests on
  SIGTERM with a 10s grace period; a shorter stop timeout kills it mid-drain.
- **Secrets**, not environment variables, for `FIREBASE_SERVICE_ACCOUNT_JSON`
  and `DATABASE_URL` — via Secrets Manager or SSM Parameter Store, so the values
  do not appear in the task definition or in `docker inspect`.
- **`DATABASE_SSL=true`** for RDS.
- **`CORS_ORIGINS`** set to the CloudFront domain. It defaults to
  `http://localhost:3000`, which blocks the deployed client if left unset.

## Database

RDS PostgreSQL 17, in a private subnet, with a security group that accepts 5432
only from the ECS task's security group. Not publicly accessible.

Migrations run as a one-off task before the new revision goes live:

```bash
npm run db:deploy --workspace=@gazhan/server
```

`migrate deploy` applies only what is pending and never prompts, which is what
makes it safe in a pipeline. Do not use `migrate dev` here — it can reset the
database.

## Cost

Roughly, for a demo-scale deployment in `eu-north-1`:

| Service              | Configuration            | Monthly (USD) |
|----------------------|--------------------------|---------------|
| RDS PostgreSQL       | `db.t4g.micro`, 20 GB    | ~15 |
| ECS Fargate          | 0.25 vCPU, 0.5 GB        | ~9 |
| ALB                  |                          | ~18 |
| S3 + CloudFront      | low traffic              | ~1 |
| **Total**            |                          | **~43** |

The ALB is the largest single line item and only exists to terminate TLS and
health-check one container. Two cheaper alternatives:

- **App Runner** — no ALB, TLS and scaling included, roughly $5–25/month.
- **A single t4g.small EC2 instance** running `docker compose up` with Postgres
  in a container and Caddy for TLS — around $12/month total. Less resilient, but
  honest for a portfolio project, and the compose file already exists.

`db.t4g.micro` is within the RDS free tier for the first 12 months on a new
account.

## What is deliberately not here

No Terraform or CDK. Infrastructure as code would be the right next step, but
writing it without an AWS account to apply it against produces something that
has never been run — which is worse than nothing.
