from datetime import datetime, timezone
import os
import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from kubernetes import client, config

app = FastAPI(
    title="Cloud Preview Platform API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NAMESPACE_PATTERN = re.compile(r"^preview-pr-(\d+)$")


def load_kubernetes_config() -> None:
    """
    Use the local kubeconfig during development and
    in-cluster authentication when deployed inside Kubernetes.
    """
    if os.getenv("KUBERNETES_SERVICE_HOST"):
        config.load_incluster_config()
    else:
        config.load_kube_config()


def human_age(created_at) -> str:
    if created_at is None:
        return "unknown"

    now = datetime.now(timezone.utc)

    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    seconds = max(0, int((now - created_at).total_seconds()))

    if seconds < 60:
        return f"{seconds}s"

    minutes = seconds // 60

    if minutes < 60:
        return f"{minutes}m"

    hours = minutes // 60

    if hours < 24:
        return f"{hours}h"

    return f"{hours // 24}d"


@app.get("/health")
def health():
    return {
        "status": "healthy",
    }


@app.get("/api/previews")
def get_previews():
    load_kubernetes_config()

    core_api = client.CoreV1Api()
    apps_api = client.AppsV1Api()

    namespaces = core_api.list_namespace().items

    previews = []

    for namespace in namespaces:
        match = NAMESPACE_PATTERN.match(namespace.metadata.name or "")

        if not match:
            continue

        pr_number = int(match.group(1))

        deployments = apps_api.list_namespaced_deployment(
            namespace=namespace.metadata.name
        ).items

        deployment = next(
            (
                item
                for item in deployments
                if item.metadata.name == "cloud-preview-app"
            ),
            None,
        )

        services = core_api.list_namespaced_service(
            namespace=namespace.metadata.name
        ).items

        service = next(
            (
                item
                for item in services
                if item.metadata.name == "cloud-preview-app"
            ),
            None,
        )

        desired_replicas = 0
        available_replicas = 0
        image = None

        if deployment:
            desired_replicas = deployment.spec.replicas or 0
            available_replicas = deployment.status.available_replicas or 0

            containers = deployment.spec.template.spec.containers

            if containers:
                image = containers[0].image

        namespace_status = namespace.status.phase or "Unknown"

        if namespace_status == "Terminating":
            status = "DESTROYING"
        elif available_replicas >= desired_replicas and desired_replicas > 0:
            status = "READY"
        else:
            status = "BUILDING"

        preview_url = None

        if service and service.status and service.status.load_balancer:
            ingress = service.status.load_balancer.ingress or []

            if ingress:
                hostname = ingress[0].hostname or ingress[0].ip

                if hostname:
                    preview_url = f"http://{hostname}"

        previews.append(
            {
                "pr": pr_number,
                "title": f"Pull Request #{pr_number}",
                "branch": None,
                "status": status,
                "namespace": namespace.metadata.name,
                "image": image.split(":")[-1] if image else None,
                "url": preview_url,
                "age": human_age(namespace.metadata.creation_timestamp),
                "replicas": f"{available_replicas} / {desired_replicas}",
            }
        )

    previews.sort(key=lambda preview: preview["pr"], reverse=True)

    return {
        "count": len(previews),
        "previews": previews,
    }

