# Deploying Nexus to Azimuth

GitOps deployment for the Nexus risk dashboard on AstraZeneca's Azimuth platform
(Kubernetes + ArgoCD). The dashboard itself needs no changes -- it's the same
static HTML/CSS/JS site already running on GitHub Pages, just containerized
and deployed via a different route. The existing data-refresh pipeline
(`refresh-data.js` -> `data/*.json` -> git push) is unaffected; this
deployment just serves whatever's currently in the repo.

## What's built here

| File | Purpose |
|---|---|
| `Dockerfile` | Packages the static site into an nginx image. Build context must be the repo root: `docker build -f k8s/Dockerfile -t <registry>/nexus-risk-dashboard:<tag> .`. Uses `nginxinc/nginx-unprivileged`, not plain `nginx:alpine` -- the stock image runs as root, which would make Kubernetes refuse to start the pod given `deployment.yaml`'s `runAsNonRoot: true`. |
| `nginx.conf` | Serves the multi-page static site on port 8080 (non-privileged, for hardened-cluster compatibility); no-caches `data/*.json` so updates show up immediately. |
| `deployment.yaml` | Kubernetes Deployment, 2 replicas, modest resource requests/limits for a static site. |
| `service.yaml` | ClusterIP Service in front of the Deployment. |
| `ingress.yaml` | Exposes the Service externally with (placeholder) SSO auth annotations. |
| `argocd-application.yaml` | Tells ArgoCD to watch this repo's `k8s/` path and auto-sync. |
| `.dockerignore` (repo root) | Keeps local-automation scripts, `node_modules/`, git metadata, and `copilot-knowledge/` out of the image. |

## What's confirmed vs. still unknown

Confirmed from our conversation:
- Deployment model is GitOps (ArgoCD watching a repo path) -- `argocd-application.yaml` is built for that.
- **ArgoCD Project and Namespace are both `enterprise-risk-reporting`** (confirmed two ways: an existing platform-managed "runners" Application showed this value, and the Application below now runs successfully with it).
- **The Application exists and syncs** -- `nexus-risk-dashboard` was created successfully in ArgoCD (project `enterprise-risk-reporting`, repo `azu-business/risk-dashboards`, path `k8s`) and is actively syncing. It currently shows Missing/OutOfSync, expected until the items below are resolved.
- The ArgoCD dashboard is at `https://argocd.azimuth-prod.astrazeneca.net` -- app hostnames may follow a similar `<name>.azimuth-prod.astrazeneca.net` pattern, but that's not confirmed yet.
- SSO gating of the app is supported on Azimuth -- the Ingress has a placeholder for it.
- Hardened security context required -- `deployment.yaml` now sets `seccompProfile`/dropped capabilities to match the Kubernetes "restricted" Pod Security Standard, since the initial "Resource not found in cluster" error for the Deployment is consistent with a Kyverno (part of Azimuth's stack) policy rejection.

Still needs confirming before this fully runs:

1. **Container registry** -- `deployment.yaml`'s `image:` field is a placeholder
   (`REGISTRY_PLACEHOLDER/...`). Azimuth's stack includes Harbor, so this is
   likely a Harbor project path, but the exact URL needs confirming. This is
   now the most likely reason the Deployment still won't come up even after
   the security-context fix -- there's no real image to pull yet.
2. **Image build/push step** -- nothing here actually builds and pushes the
   Docker image yet. That's normally a CI step (e.g. a GitHub Actions
   workflow triggered on push to `main`) that builds the image, pushes it to
   the registry from step 1, and updates the `image:` tag in
   `deployment.yaml` so ArgoCD picks up the new version. Once the registry
   is known, I can build this workflow.
3. **SSO auth mechanism** -- `ingress.yaml` assumes an nginx-ingress-controller
   OAuth2 Proxy pattern (`auth-url`/`auth-signin` annotations), which is a
   common way to gate an Ingress behind AAD, but Azimuth may use a different
   ingress controller or its own convention. The two placeholder annotations
   need swapping for whatever the real pattern is.
4. **Hostname + TLS** -- `ingress.yaml`'s `nexus.HOST_PLACEHOLDER` needs the
   real domain suffix, and whether TLS is auto-provisioned (e.g. cert-manager)
   or needs a `secretName` added manually.

## Suggested next step

Check the ArgoCD UI for a more specific error on the Deployment resource
after the security-context fix syncs -- if it now shows an image-pull error
instead of "resource not found," that confirms the registry (item 1) is the
only remaining blocker for the Deployment itself.
