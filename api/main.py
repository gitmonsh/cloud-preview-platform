from datetime import datetime, timezone
import os
import re

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from kubernetes import client, config

app = FastAPI(
    title="Cloud Preview Platform API",
    version="1.2.0",
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
GITHUB_REPOSITORY = "gitmonsh/cloud-preview-platform"
APP_NAME = "cloud-preview-app"


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


def get_pull_request(pr_number: int):
    """
    Read public GitHub pull-request metadata.
    """
    try:
        response = requests.get(
            f"https://api.github.com/repos/{GITHUB_REPOSITORY}/pulls/{pr_number}",
            timeout=5,
            headers={
                "Accept": "application/vnd.github+json",
            },
        )

        if response.status_code != 200:
            return None

        data = response.json()

        return {
            "title": data.get("title"),
            "branch": data.get("head", {}).get("ref"),
            "author": data.get("user", {}).get("login"),
            "github_url": data.get("html_url"),
        }

    except requests.RequestException:
        return None


def get_load_balancer_url(service):
    """
    Return the public AWS Load Balancer URL when Kubernetes
    has populated the Service ingress hostname.
    """
    if not service:
        return None

    status = service.status

    if not status or not status.load_balancer:
        return None

    ingress = status.load_balancer.ingress or []

    if not ingress:
        return None

    hostname = ingress[0].hostname or ingress[0].ip

    if not hostname:
        return None

    return f"http://{hostname}"


def get_container_resources(container):
    resources = container.resources

    if not resources:
        return {
            "requests": {},
            "limits": {},
        }

    requests_data = resources.requests or {}
    limits_data = resources.limits or {}

    return {
        "requests": {
            "cpu": requests_data.get("cpu"),
            "memory": requests_data.get("memory"),
        },
        "limits": {
            "cpu": limits_data.get("cpu"),
            "memory": limits_data.get("memory"),
        },
    }


def get_pod_readiness(pod):
    """
    Determine whether the pod's containers are currently ready.
    """
    statuses = pod.status.container_statuses or []

    if not statuses:
        return False

    return all(status.ready for status in statuses)


def get_pod_restart_count(pod):
    statuses = pod.status.container_statuses or []

    return sum(
        status.restart_count or 0
        for status in statuses
    )


def get_preview_objects(namespace_name):
    core_api = client.CoreV1Api()
    apps_api = client.AppsV1Api()

    deployments = apps_api.list_namespaced_deployment(
        namespace=namespace_name
    ).items

    deployment = next(
        (
            item
            for item in deployments
            if item.metadata.name == APP_NAME
        ),
        None,
    )

    services = core_api.list_namespaced_service(
        namespace=namespace_name
    ).items

    service = next(
        (
            item
            for item in services
            if item.metadata.name == APP_NAME
        ),
        None,
    )

    pods = core_api.list_namespaced_pod(
        namespace=namespace_name,
        label_selector=f"app={APP_NAME}",
    ).items

    return deployment, service, pods


@app.get("/health")
def health():
    return {
        "status": "healthy",
    }


@app.get("/api/previews")
def get_previews():
    load_kubernetes_config()

    core_api = client.CoreV1Api()
    namespaces = core_api.list_namespace().items

    previews = []

    for namespace in namespaces:
        namespace_name = namespace.metadata.name or ""

        match = NAMESPACE_PATTERN.match(namespace_name)

        if not match:
            continue

        pr_number = int(match.group(1))
        pull_request = get_pull_request(pr_number)

        deployment, service, pods = get_preview_objects(namespace_name)

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

        preview_url = get_load_balancer_url(service)

        previews.append(
            {
                "pr": pr_number,
                "title": (
                    pull_request["title"]
                    if pull_request and pull_request.get("title")
                    else f"Pull Request #{pr_number}"
                ),
                "branch": (
                    pull_request["branch"]
                    if pull_request
                    else None
                ),
                "author": (
                    pull_request["author"]
                    if pull_request
                    else None
                ),
                "github_url": (
                    pull_request["github_url"]
                    if pull_request
                    else None
                ),
                "status": status,
                "namespace": namespace_name,
                "image": image.split(":")[-1] if image else None,
                "url": preview_url,
                "age": human_age(namespace.metadata.creation_timestamp),
                "replicas": f"{available_replicas} / {desired_replicas}",
                "pod_count": len(pods),
            }
        )

    previews.sort(
        key=lambda preview: preview["pr"],
        reverse=True,
    )

    return {
        "count": len(previews),
        "previews": previews,
    }


@app.get("/api/previews/{pr_number}")
def get_preview_details(pr_number: int):
    load_kubernetes_config()

    core_api = client.CoreV1Api()
    namespace_name = f"preview-pr-{pr_number}"

    try:
        namespace = core_api.read_namespace(namespace_name)
    except client.exceptions.ApiException as exc:
        if exc.status == 404:
            raise HTTPException(
                status_code=404,
                detail=f"Preview namespace '{namespace_name}' not found",
            )

        raise

    if not NAMESPACE_PATTERN.match(namespace_name):
        raise HTTPException(
            status_code=404,
            detail="Not a preview namespace",
        )

    pull_request = get_pull_request(pr_number)

    deployment, service, pods = get_preview_objects(namespace_name)

    desired_replicas = 0
    available_replicas = 0
    ready_replicas = 0
    image = None

    resources = {
        "requests": {},
        "limits": {},
    }

    deployment_conditions = []

    if deployment:
        desired_replicas = deployment.spec.replicas or 0
        available_replicas = deployment.status.available_replicas or 0
        ready_replicas = deployment.status.ready_replicas or 0

        containers = deployment.spec.template.spec.containers

        if containers:
            image = containers[0].image
            resources = get_container_resources(containers[0])

        conditions = deployment.status.conditions or []

        deployment_conditions = [
            {
                "type": condition.type,
                "status": condition.status,
                "reason": condition.reason,
                "message": condition.message,
            }
            for condition in conditions
        ]

    preview_url = get_load_balancer_url(service)

    pod_details = []

    for pod in pods:
        phase = pod.status.phase or "Unknown"
        ready = get_pod_readiness(pod)
        restart_count = get_pod_restart_count(pod)

        container_statuses = pod.status.container_statuses or []
        container_details = []

        for container_status in container_statuses:
            container_details.append(
                {
                    "name": container_status.name,
                    "ready": container_status.ready,
                    "restart_count": (
                        container_status.restart_count or 0
                    ),
                }
            )

        pod_details.append(
            {
                "name": pod.metadata.name,
                "phase": phase,
                "ready": ready,
                "restart_count": restart_count,
                "node": pod.spec.node_name,
                "created_at": (
                    pod.metadata.creation_timestamp.isoformat()
                    if pod.metadata.creation_timestamp
                    else None
                ),
                "containers": container_details,
            }
        )

    namespace_status = namespace.status.phase or "Unknown"

    if namespace_status == "Terminating":
        status = "DESTROYING"
    elif ready_replicas >= desired_replicas and desired_replicas > 0:
        status = "READY"
    else:
        status = "BUILDING"

    return {
        "pr": pr_number,
        "title": (
            pull_request["title"]
            if pull_request and pull_request.get("title")
            else f"Pull Request #{pr_number}"
        ),
        "branch": (
            pull_request["branch"]
            if pull_request
            else None
        ),
        "author": (
            pull_request["author"]
            if pull_request
            else None
        ),
        "github_url": (
            pull_request["github_url"]
            if pull_request
            else None
        ),
        "status": status,
        "namespace": namespace_name,
        "namespace_status": namespace_status,
        "image": image.split(":")[-1] if image else None,
        "full_image": image,
        "url": preview_url,
        "age": human_age(namespace.metadata.creation_timestamp),
        "deployment": {
            "name": deployment.metadata.name if deployment else None,
            "desired_replicas": desired_replicas,
            "available_replicas": available_replicas,
            "ready_replicas": ready_replicas,
            "conditions": deployment_conditions,
        },
        "service": {
            "name": service.metadata.name if service else None,
            "type": service.spec.type if service else None,
            "cluster_ip": (
                service.spec.cluster_ip
                if service
                else None
            ),
            "preview_url": preview_url,
        },
        "pods": pod_details,
        "resources": resources,
    }


@app.get("/api/previews/{pr_number}/logs")
def get_preview_logs(pr_number: int):
    load_kubernetes_config()

    core_api = client.CoreV1Api()
    namespace_name = f"preview-pr-{pr_number}"

    try:
        core_api.read_namespace(namespace_name)
    except client.exceptions.ApiException as exc:
        if exc.status == 404:
            raise HTTPException(
                status_code=404,
                detail=f"Preview namespace '{namespace_name}' not found",
            )

        raise

    pods = core_api.list_namespaced_pod(
        namespace=namespace_name,
        label_selector=f"app={APP_NAME}",
    ).items

    if not pods:
        raise HTTPException(
            status_code=404,
            detail="No application pods found for this preview",
        )

    pod = pods[0]

    try:
        logs = core_api.read_namespaced_pod_log(
            name=pod.metadata.name,
            namespace=namespace_name,
            container="app",
            tail_lines=200,
            timestamps=True,
        )
    except client.exceptions.ApiException as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to read pod logs: {exc.reason}",
        )

    return {
        "pr": pr_number,
        "namespace": namespace_name,
        "pod": pod.metadata.name,
        "container": "app",
        "lines": len(logs.splitlines()),
        "logs": logs,
    }