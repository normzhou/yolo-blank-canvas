variable "client_account_id" {
  type      = string
  sensitive = true
  validation {
    condition     = can(regex("^[a-f0-9]{32}$", var.client_account_id))
    error_message = "Use the independently verified client account, not the domain operator account."
  }
}

provider "cloudflare" {}

# Infrastructure owns identity only. Wrangler owns versions, deployments and
# their bindings; routine app releases do not change this resource/state.
resource "cloudflare_worker" "app" {
  account_id = var.client_account_id
  name       = "yolo-demo-app"

  lifecycle {
    prevent_destroy = true
  }
}
