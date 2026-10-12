# Serves the static Nexus risk dashboard (plain HTML/CSS/JS, no build step) via nginx.
# Build context must be the repo root (Risk_Test/), not this k8s/ folder --
# e.g.: docker build -f k8s/Dockerfile -t <registry>/nexus-risk-dashboard:<tag> .
#
# Uses the unprivileged nginx image, not plain nginx:alpine -- the stock image
# runs its master process as root, which would make Kubernetes refuse to
# start the pod given deployment.yaml's runAsNonRoot:true. This image is
# purpose-built to run as a non-root user and already listens on 8080.
FROM nginxinc/nginx-unprivileged:alpine

COPY k8s/nginx.conf /etc/nginx/conf.d/default.conf

# Everything needed to serve the site: HTML pages, css/, js/, images/, data/.
# .dockerignore (repo root) excludes local-automation scripts, node_modules,
# git metadata, and copilot-knowledge/ -- none of that belongs in the image.
COPY . /usr/share/nginx/html

EXPOSE 8080
