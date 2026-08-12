# DevSecOps Portfolio Project

A full-stack, containerized Python/FastAPI + React application deployed via a multi-layer security-gated CI/CD pipeline to a self-hosted Ubuntu Server Kubernetes cluster (minikube), securely exposed to the public internet via Tailscale Funnel and hosted on Vercel.

Built to demonstrate practical, end-to-end DevSecOps principles: zero-trust networking, container hardening, static application security testing (SAST), dynamic vulnerability scanning (DAST), container image CVE gates, JWT & bcrypt authentication, stateful database orchestration, Ansible configuration management, and Prometheus/Grafana real-time observability.

---

## Architecture

```
                                 User Browser (Vercel Frontend)
                                                │
                                                ▼ (Public HTTPS)
                        ┌──────────────────────────────────────────────┐
                        │ https://aserver.tail5c3f3c.ts.net            │ ◄── Tailscale Funnel Edge (TLS Termination)
                        └──────────────────────┬───────────────────────┘
                                               │ (Encrypted WireGuard Tunnel)
                                               ▼
                        ┌────────────────────────────────────────────────────────┐
                        │ Ubuntu Server 24.04 VM (Minikube Cluster)              │
                        │ Hardened via Ansible (UFW tailscale0 + fail2ban)       │
                        │                                                        │
                        │ ├─ Frontend Pods (nginx:alpine) ◄── Port 80 (Internal) │
                        │ ├─ API Pods (notes-api)        ◄── Port 8000           │
                        │ ├─ Postgres Pod                ◄── Stateful PVC        │
                        │ ├─ Prometheus Pod              ◄── Port 9090           │
                        │ └─ Grafana Pod                 ◄── Port 3000           │
                        └────────────────────────────────────────────────────────┘

  DevSecOps CI/CD Pipeline (GitHub Actions on push to main):
  🔍 1. Semgrep SAST Scan (Source Code Vulnerability Gate)
  🛠️ 2. Build Docker Images (Multi-Stage Alpine Builds)
  🛡️ 3. Trivy Security Scan Gate (Fail-on-CRITICAL Container OS CVEs)
  🔑 4. Ephemeral Tailscale OAuth Connection (tag:ci)
  🚀 5. Automated K8s Rollout & Port-Forward Refresh over SSH
  🎯 6. OWASP ZAP DAST Scan (Active Web Vulnerability Attack Scan)
```

No inbound ports are exposed to the public internet. The VM is reachable only via its private Tailscale IP, and Tailscale Funnel proxies public HTTPS requests directly to local port `8000`. The GitHub Actions runner joins the tailnet on-demand as an ephemeral node tagged (`tag:ci`) during deploys.

---

## Stack

| Layer | Tool | Purpose |
|---|---|---|
| **Frontend** | React 19, Vite, Vanilla CSS | Single-Page Application (SPA) with modular components |
| **Frontend Hosting** | Vercel | Production SPA deployment |
| **Backend API** | Python, FastAPI, Pydantic | Asynchronous REST API |
| **Authentication** | `bcrypt` & JWT (HS256) | Salted password hashing & stateless bearer authorization |
| **Database** | PostgreSQL 16 | Relational data persistence with Kubernetes PVC |
| **Containerization** | Docker | Multi-stage Alpine builds, non-root user (`UID 1000`) |
| **Orchestration** | Kubernetes (minikube) | Replicas, ClusterIP, `securityContext` hardening, PVC |
| **GitOps Engine** | ArgoCD | Declarative GitOps cluster deployment & self-healing auto-sync |
| **Ingress / Exposure** | Tailscale Funnel | Zero-Trust public HTTPS proxy with Let's Encrypt TLS |
| **Host Provisioning** | Ansible | Automated UFW firewall & fail2ban playbook configuration |
| **SAST (Code Security)** | Semgrep | Static Analysis Security Testing in CI for OWASP Top 10 |
| **Container Security** | Trivy | Fail-closed container image vulnerability gate |
| **Supply Chain Security** | Syft & Cosign | Automated SPDX JSON SBOM generation & cryptographic container signing |
| **DAST (Live Security)** | OWASP ZAP | Dynamic active web attack vulnerability scanner |
| **Observability** | Prometheus & Grafana | Time-series metrics scraping (`/metrics`) and real-time visual dashboards |
| **Private Network** | Tailscale Mesh VPN | Ephemeral OAuth token authentication (`tag:ci`) |
| **Host Hardening** | UFW & fail2ban | Interface-scoped firewalling (`tailscale0` port 22 binding) |

---

## Kubernetes

The app runs on a single-node **minikube** cluster (docker driver) on the VM, featuring 7 active pod replicas.

| Resource | Config |
|---|---|
| Deployment | `k8s/deployment.yaml` — 2 replicas (`notes-api`) |
| Frontend Deployment | `k8s/frontend-deployment.yaml` — 2 replicas (`notes-frontend`) |
| Database | `k8s/postgres-deployment.yaml` — PostgreSQL 16 with PVC persistence |
| Observability | `k8s/prometheus-deployment.yaml` & `k8s/grafana-deployment.yaml` |
| Security context | `runAsNonRoot: true`, `runAsUser: 1000`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, all capabilities dropped |
| Service | `ClusterIP` (not NodePort — isolated Docker driver network) |
| Access | `kubectl port-forward svc/notes-api 8000:8000 --address 0.0.0.0`, managed via systemd |
| Cluster autostart | `minikube-start.service` systemd unit runs `minikube start --driver=docker` on VM boot |

---

## DevSecOps Pipeline: SAST → Build → Trivy Scan → Deploy → DAST

On every push to `main`, GitHub Actions runs:

1. **Checkout** — pulls the latest code.
2. **Semgrep SAST Scan** — scans Python and React source code for OWASP vulnerabilities and hardcoded secrets.
3. **Build** — builds backend (`devsecops-api`) and frontend (`devsecops-frontend`) Docker images.
4. **Trivy Container Scan** — scans built images for CRITICAL severity OS/package vulnerabilities. Fails the pipeline if unpatched findings exist.
5. **Connect to Tailscale** — authenticates using a scoped OAuth client (`tag:ci`) and joins the tailnet as an ephemeral node.
6. **Deploy** — SSHes into the VM over Tailscale, rebuilds, applies K8s manifests, and restarts services.
7. **OWASP ZAP DAST Scan** — attacks the live HTTPS Funnel endpoint (`https://aserver.tail5c3f3c.ts.net/health`) to test for runtime security flaws.

---

## Security Design Decisions

- **Non-root container execution** — app runs as `appuser` (UID 1000) inside containers.
- **No public inbound ports** — VM interface blocks all public incoming connections; SSH is scoped to `tailscale0` only.
- **Full DevSecOps Security Triad** — Semgrep (SAST) + Trivy (Container CVE Gate) + OWASP ZAP (DAST).
- **Least-privilege OAuth scoping** — CI Tailscale OAuth client scoped strictly to `Auth Keys: Write` and `Devices:Core: Write`.
- **Stateless Authentication** — Passwords salted with `bcrypt`; endpoints protected by signed JWT tokens.
- **Automated Configuration Management** — Ansible playbooks automate server hardening and package provisioning.

---

## Project Structure

```
devsecops-project/
├── main.py                        # FastAPI backend entry point
├── app/                           # Modular backend application
│   ├── database.py                 # PostgreSQL connection & PVC schema init
│   ├── config.py                   # Environment configuration & JWT settings
│   ├── auth.py                     # bcrypt hashing & JWT token validation
│   └── routers/                    # Auth & Notes API route handlers
├── Dockerfile                     # Multi-stage Alpine Python build (build-base, non-root)
├── requirements.txt               # Python dependencies
├── stack_notes.md                 # Tech stack reference cheat-sheet
├── stack_notes2.md                # Docker, K8s, & Disaster Recovery Playbook
├── ansible/                       # Infrastructure as Code (IaC)
│   ├── inventory.ini              # Host target inventory mapping
│   └── playbook.yml               # Ansible host hardening & UFW playbook
├── frontend/                      # React + Vite application
│   ├── src/components/            # Modular React components (Header, AuthForm, NoteGrid, etc.)
│   ├── Dockerfile                 # Multi-stage build (Node -> NGINX static server)
│   └── nginx.conf                 # NGINX SPA fallback routing configuration
├── k8s/                           # Kubernetes manifests
│   ├── deployment.yaml            # FastAPI Deployment (2 replicas)
│   ├── service.yaml               # API ClusterIP Service
│   ├── frontend-deployment.yaml   # NGINX Frontend Deployment
│   ├── frontend-service.yaml      # Frontend ClusterIP Service
│   ├── postgres-pvc.yaml          # Persistent Volume Claim for database
│   ├── postgres-deployment.yaml   # PostgreSQL Stateful Deployment
│   ├── prometheus-deployment.yaml # Prometheus metrics scraper (Port 9090)
│   ├── grafana-deployment.yaml    # Grafana visual dashboards (Port 3000)
│   └── postgres-service.yaml
└── .github/
    └── workflows/
        └── deploy.yml             # Complete DevSecOps CI/CD pipeline (Semgrep -> Build -> Trivy -> Deploy -> ZAP DAST)
```

---

## What This Project Demonstrates

- Writing and hardening a full-stack REST API and its container images
- Designing a multi-gated DevSecOps pipeline with **SAST**, **Container CVE Gates**, and **DAST**
- Zero-trust network design using a mesh VPN instead of public port exposure
- Stateful database orchestration on Kubernetes with PVC persistence
- Real-time cloud observability and metrics visualization using Prometheus and Grafana
- Infrastructure as Code (IaC) and configuration management using Ansible playbooks
