terraform {
  required_version = "= 1.13.1"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "= 5.28.0"
    }
  }

  backend "local" {}

  encryption {
    key_provider "pbkdf2" "owner" {
      passphrase = var.state_passphrase
    }
    method "aes_gcm" "owner" {
      keys = key_provider.pbkdf2.owner
    }
    state {
      method   = method.aes_gcm.owner
      enforced = true
    }
    plan {
      method   = method.aes_gcm.owner
      enforced = true
    }
  }
}

variable "state_passphrase" {
  type      = string
  sensitive = true
  validation {
    condition     = length(var.state_passphrase) >= 32
    error_message = "Use a randomly generated state passphrase of at least 32 characters, backed up separately from state."
  }
}
