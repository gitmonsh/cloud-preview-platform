provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"

    args = [
      "eks",
      "get-token",
      "--cluster-name",
      module.eks.cluster_name,
      "--region",
      "us-west-2",
      "--profile",
      "cloud-preview-admin"
    ]
  }
}

resource "kubernetes_cluster_role_v1" "preview_namespace_manager" {
  metadata {
    name = "preview-namespace-manager"
  }

  rule {
    api_groups = [""]
    resources  = ["namespaces"]

    verbs = [
      "create",
      "get",
      "patch",
      "update",
      "delete"
    ]
  }
}

resource "kubernetes_cluster_role_binding_v1" "preview_namespace_manager" {
  metadata {
    name = "preview-namespace-manager"
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role_v1.preview_namespace_manager.metadata[0].name
  }

  subject {
    kind      = "Group"
    name      = "preview-namespace-manager"
    api_group = "rbac.authorization.k8s.io"
  }

  depends_on = [
    module.eks
  ]
}