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
- ArgoCD Project is `Risk_Reporting` (confirmed via ArgoCD's own permission-denied error message when attempting to create the Application).
- The ArgoCD dashboard is at `https://argocd.azimuth-prod.astrazeneca.net` -- app hostnames may follow a similar `<name>.azimuth-prod.astrazeneca.net` pattern, but that's not confirmed yet.
- SSO gating of the app is supported on Azimuth -- the Ingress has a placeholder for it.
- You can log into ArgoCD and view Applications, but your account does **not** currently have the "create" permission for Applications in the `Risk_Reporting` project -- this needs granting by whoever administers RBAC roles there before anything below matters.

Still needs confirming before this can actually run:

1. **"Create" permission on Applications in `Risk_Reporting`** -- blocking everything else; request this first.
2. **Container registry** -- `deployment.yaml`'s `image:` field is a placeholder
   (`REGISTRY_PLACEHOLDER/...`). Azimuth's stack includes Harbor, so this is
   likely a Harbor project path, but the exact URL needs confirming.
3. **Image build/push step** -- nothing here actually builds and pushes the
   Docker image yet. That's normally a CI step (e.g. a GitHub Actions
   workflow triggered on push to `main`) that builds the image, pushes it to
   the registry from step 2, and updates the `image:` tag in
   `deployment.yaml` so ArgoCD picks up the new version. Once the registry
   is known, I can build this workflow.
4. **SSO auth mechanism** -- `ingress.yaml` assumes an nginx-ingress-controller
   OAuth2 Proxy pattern (`auth-url`/`auth-signin` annotations), which is a
   common way to gate an Ingress behind AAD, but Azimuth may use a different
   ingress controller or its own convention. The two placeholder annotations
   need swapping for whatever the real pattern is.
5. **Namespace name + hostname + TLS** -- `argocd-application.yaml`'s
   `NAMESPACE_PLACEHOLDER` and `ingress.yaml`'s `nexus.HOST_PLACEHOLDER` both
   need the real values once known, and whether TLS is auto-provisioned
   (e.g. cert-manager) or needs a `secretName` added manually.

## Suggested next step

Request "create" permission on Applications in the `Risk_Reporting` ArgoCD
project first -- nothing else here can move until that's granted. Once it
is, re-attempt creating the Application; the registry/namespace/hostname
items can likely be resolved from whatever happens (or whatever error shows)
at that point.
