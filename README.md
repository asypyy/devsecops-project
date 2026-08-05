# DevSecOps Portfolio Project

A full-stack, containerized Python/FastAPI + React application deployed via a security-gated CI/CD pipeline to a self-hosted Ubuntu Server Kubernetes cluster (minikube), securely exposed to the public internet via Tailscale Funnel and hosted on Vercel.

Built to demonstrate end-to-end DevSecOps principles: zero-trust networking, container hardening, automated Trivy vulnerability gates, JWT & bcrypt authentication, stateful database orchestration, and hybrid public/private cloud hosting.

---

## Architecture

```
  User Browser (Vercel Frontend)
         │
         ▼ (Public HTTPS)
 ┌───────────────────────────┐
 │ https://aserver.tail...   │ ◄─── Tailscale Funnel Edge (TLS Termination)
 └─────────────┬─────────────┘
               │ (Encrypted WireGuard Tunnel)
               ▼
 ┌────────────────────────────────────────────────────────┐
 │ Ubuntu Server 24.04 VM (Minikube Cluster)              │
 │ UFW + fail2ban                                         │
 │                                                        │
 │ ├─ Frontend Pods (nginx:alpine) ◄── Port 80 (Internal) │
 │ ├─ API Pods (notes-api)        ◄── Port 8000           │
 │ └─ Postgres Pod                ◄── Stateful Database   │
 └────────────────────────────────────────────────────────┘

 CI/CD Pipeline (GitHub Actions on push to main):
 🛠️ Build Docker Images (Backend & Frontend)
 🛡️ Trivy Security Scan Gate (CRITICAL Severity Exit)
 🔑 Ephemeral Tailscale OAuth Connection
 🚀 Automated K8s Rollout over SSH
```

No inbound ports are exposed to the public internet. The VM is reachable only via its private Tailscale IP, and Tailscale Funnel proxies public HTTPS requests directly to local port `8000`. The GitHub Actions runner joins the tailnet on-demand as an ephemeral node tagged (`tag:ci`) during deploys.

---

## Stack

| Layer | Tool |
|---|---|
| Frontend | React 19, Vite, Vanilla CSS |
| Frontend Hosting | Vercel (Production SPA) |
| Backend API | Python, FastAPI, Pydantic |
| Authentication | JWT (HS256) & bcrypt password hashing |
| Database | PostgreSQL 16 (StatefulSet / K8s PVC) |
| Containerization | Docker (Multi-stage builds, non-root users, Alpine base) |
| Ingress / Exposure | Tailscale Funnel (Zero-Trust Public HTTPS Proxy) |
| Orchestration | Kubernetes (minikube) |
| CI/CD Pipeline | GitHub Actions |
| Security Scanning | Trivy (Fail-on-CRITICAL container vulnerability gate) |
| Private Network | Tailscale Mesh VPN (OAuth ephemeral tokens) |
| Host Hardening | UFW (tailscale0 interface binding), fail2ban, Linux permissions |

---

## Kubernetes

The app runs on a single-node **minikube** cluster (docker driver) on the VM, rather than a bare `docker run` container.

| Resource | Config |
|---|---|
| Deployment | `k8s/deployment.yaml` — 2 replicas |
| Resource limits | 100m/128Mi requests, 250m/256Mi limits per pod |
| Probes | `readinessProbe` + `livenessProbe` on `GET /health` |
| Security context | `runAsNonRoot: true`, `runAsUser: 1000`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, all capabilities dropped |
| Service | `k8s/service.yaml` — `ClusterIP` (not NodePort — see below) |
| Access | `kubectl port-forward svc/notes-api 8000:8000 --address 0.0.0.0`, kept alive via a systemd unit so it survives terminal close and VM reboot |
| Cluster autostart | `minikube start --driver=docker` runs automatically on boot via a dedicated systemd unit; the port-forward unit depends on it |

**Why ClusterIP, not NodePort:** minikube's docker driver runs the cluster inside an isolated Docker network. Even with a stable `minikube ip`, there's no route from the VM's Tailscale interface into that network — NodePort is only reachable from inside the VM itself. `kubectl port-forward` tunnels through the Kubernetes API server instead, which the VM can reach, making it the correct pattern here.

**Deploying manually:**

```bash
eval $(minikube docker-env)
docker build -t devsecops-api:latest .
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl rollout restart deployment/notes-api
```

## Pipeline: Build → Scan → Deploy

On every push to `main`, GitHub Actions runs:

1. **Checkout** — pulls the latest code.
2. **Build** — builds the Docker image from the `Dockerfile`.
3. **Scan (Trivy)** — scans the built image for CRITICAL severity vulnerabilities. The build **fails the pipeline** if any are found with no accepted risk exception — security gate, not just a report.
4. **Connect to Tailscale** — the runner authenticates using a scoped OAuth client (least-privilege: `Auth Keys` write + `Devices:Core` write only) and joins the tailnet as an ephemeral node tagged `tag:ci`.
5. **Deploy** — SSHes into the VM over the private Tailscale network, stops/removes the old container, rebuilds, and starts the new one.

```yaml
# .github/workflows/deploy.yml (excerpt)
- name: Scan with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: devsecops-api:latest
    format: table
    exit-code: 1
    severity: CRITICAL
```

---

## Why Trivy?

Trivy was chosen for container image scanning because it:
- Requires no server/database setup — runs as a single binary/action.
- Covers OS package vulnerabilities *and* application dependency vulnerabilities in one scan.
- Integrates natively with GitHub Actions and supports failing the build on a severity threshold, turning scanning into an enforced gate rather than an ignorable report.

During development, Trivy caught a real CRITICAL-severity, unfixed `perl-base` CVE pair (CVE-2026-42496, CVE-2026-8376) inherited from the Debian-based Python image. Since no patched version existed upstream, the base image was switched from `python:3.12-slim` to `python:3.12-alpine`, which doesn't ship `perl-base` at all — eliminating the vulnerable package rather than suppressing the finding.

---

## Security Design Decisions

- **Non-root container user** — the app runs as `appuser`, not root, inside the container.
- **No public inbound ports** — the VM's only reachable interface is Tailscale; SSH is bound to `tailscale0` only.
- **Least-privilege OAuth scoping** — the CI's Tailscale OAuth client is scoped to exactly two capabilities (`Auth Keys: Write`, `Devices:Core: Write`) rather than broad read/write access.
- **Ephemeral CI identity** — the GitHub Actions runner joins the tailnet as a tagged, ephemeral node per run rather than a static, persistent credential.
- **Secrets never touch the repo** — SSH keys, OAuth credentials, and the VM's Tailscale IP are stored exclusively in GitHub Actions encrypted secrets.
- **Fail-closed scanning** — a CRITICAL vulnerability finding stops the deploy; there is no "scan and ignore."

---

## Pipeline Run

![Green pipeline run](pipeline-success.png)

---

## Project Structure

```
devsecops-project/
├── main.py                    # FastAPI backend with JWT auth & PostgreSQL CRUD
├── Dockerfile                 # Multi-stage Alpine Python image (non-root appuser)
├── requirements.txt           # Python dependencies (FastAPI, PyJWT, bcrypt, psycopg2)
├── vercel.json                # Vercel SPA routing configuration
├── frontend/                  # React + Vite application
│   ├── src/                   # Auth & Notes React components
│   ├── Dockerfile             # Multi-stage build (Node -> NGINX static server)
│   ├── vercel.json            # Client-side routing rewrite rules
│   └── package.json
├── k8s/                       # Kubernetes manifests
│   ├── deployment.yaml        # FastAPI API Deployment (2 replicas)
│   ├── service.yaml           # API ClusterIP Service
│   ├── frontend-deployment.yaml # NGINX Frontend Deployment
│   ├── frontend-service.yaml    # Frontend ClusterIP Service
│   ├── postgres-pvc.yaml      # Persistent Volume Claim for database
│   └── postgres-deployment.yaml # PostgreSQL Stateful Deployment
└── .github/
    └── workflows/
        └── deploy.yml         # CI/CD pipeline (Build -> Trivy Scan -> Tailscale -> K8s Rollout)
```

---

## Local Development

**Plain Docker (no Postgres, no k8s — quick smoke test only):**

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

```bash
docker build -t devsecops-api:latest .
docker run -d -p 8000:8000 --name api devsecops-api:latest
curl http://localhost:8000/health
```

> Note: `main.py` expects a reachable Postgres instance (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`). Plain `docker run` above will fail on any `/notes` endpoint without one — use the k8s path below for a working full-stack test.

**Full stack via minikube (matches production deploy):**

```bash
minikube start --driver=docker
eval $(minikube docker-env)
docker build -t devsecops-api:latest .

kubectl apply -f k8s/postgres-secret.yaml   # create manually first, see below
kubectl apply -f k8s/postgres-pvc.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/postgres-service.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

kubectl port-forward svc/notes-api 8000:8000
curl http://localhost:8000/health
```

`k8s/postgres-secret.yaml` isn't committed to the repo (contains DB credentials). Create it locally:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
type: Opaque
stringData:
  POSTGRES_USER: notesuser
  POSTGRES_PASSWORD: <your-own-password>
  POSTGRES_DB: notesdb
```

---

## What This Project Demonstrates

- Writing and hardening a REST API and its container image
- Designing a security-gated CI/CD pipeline (not just automation — automation with enforcement)
- Diagnosing and remediating real CVE findings rather than suppressing them
- Zero-trust network design using a mesh VPN instead of public exposure
- Least-privilege credential scoping for CI systems
- Systematic debugging of infrastructure issues (YAML indentation, Linux group permissions, OAuth scope mismatches) under real, messy conditions
