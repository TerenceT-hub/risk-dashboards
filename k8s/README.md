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
- You can create your own namespace/project.
- SSO gating of the app is supported on Azimuth -- the Ingress has a placeholder for it.

Still needs confirming with whoever administers Azimuth, before this can actually run:

1. **Container registry** -- `deployment.yaml`'s `image:` field is a placeholder
   (`REGISTRY_PLACEHOLDER/...`). Azimuth's stack includes Harbor, so this is
   likely a Harbor project path, but the exact URL needs confirming.
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
4. **Hostname + TLS** -- `ingress.yaml` has a placeholder host and assumes TLS
   is either auto-provisioned (e.g. cert-manager) or needs a `secretName`
   added manually; needs confirming either way.
5. **How Applications actually get registered in ArgoCD** -- `argocd-application.yaml`
   is written as if you'd `kubectl apply` it directly, but many platforms
   have admins (or a self-service portal) register new Applications instead.
   Worth checking the expected onboarding path before applying it yourself.

## Suggested next step

Take this folder to whoever administers Azimuth access for you, confirm the
5 items above, and I'll fill in the placeholders and build the missing CI
image-build workflow once they're known.
