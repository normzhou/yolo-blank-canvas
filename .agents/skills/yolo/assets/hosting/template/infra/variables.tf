variable "tenancy_ocid" { type = string }
variable "compartment_ocid" { type = string }
variable "region" { type = string }
variable "availability_domain" { type = string }
variable "image_ocid" { type = string }
variable "alert_email" {
  type      = string
  sensitive = true
}
variable "oci_profile" {
  type    = string
  default = "YOLO_APP_HOST"
}
variable "ssh_public_key" {
  type      = string
  sensitive = true
  validation {
    condition     = can(regex("^ssh-ed25519 [A-Za-z0-9+/=]+", var.ssh_public_key))
    error_message = "Use the owner-held dedicated Ed25519 public key."
  }
}
variable "admin_ipv4_cidr" {
  type      = string
  sensitive = true
  validation {
    condition     = can(cidrhost(var.admin_ipv4_cidr, 0)) && can(regex("^[0-9.]+/32$", var.admin_ipv4_cidr))
    error_message = "SSH requires a single IPv4 /32; broad CIDRs are refused."
  }
}
variable "free_tier_verified" {
  type    = bool
  default = false
  validation {
    condition     = var.free_tier_verified
    error_message = "Owner must verify actual free eligibility, aggregate usage and no paid upgrade before planning."
  }
}
variable "account_mode" {
  type = string
  validation {
    condition     = contains(["FREE_TIER", "FREE_TRIAL_NOT_UPGRADED"], var.account_mode)
    error_message = "Only unupgraded Free Tier/trial accounts are admitted; paid-account operation needs replanning."
  }
}
variable "ocpus" {
  type    = number
  default = 2
  validation {
    condition     = var.ocpus == 2
    error_message = "This reviewed single-host allocation is exactly 2 A1 OCPUs."
  }
}
variable "memory_gb" {
  type    = number
  default = 12
  validation {
    condition     = var.memory_gb == 12
    error_message = "This reviewed single-host allocation is exactly 12 GB."
  }
}
variable "boot_gb" {
  type    = number
  default = 100
  validation {
    condition     = var.boot_gb >= 50 && var.boot_gb <= 100 && floor(var.boot_gb) == var.boot_gb
    error_message = "Use an integer balanced boot allocation between 50 and 100 GB."
  }
}
variable "other_month_ocpu_hours" {
  type        = number
  description = "Other A1 usage already consumed this month plus forecast other A1 usage; exclude this proposed host."
  validation {
    condition     = var.other_month_ocpu_hours >= 0
    error_message = "Account usage cannot be negative."
  }
}
variable "other_month_memory_gb_hours" {
  type = number
  validation {
    condition     = var.other_month_memory_gb_hours >= 0
    error_message = "Account usage cannot be negative."
  }
}
variable "other_volume_gb" {
  type        = number
  description = "All other boot/block volumes, including unattached and stopped-instance volumes, across the tenancy."
  validation {
    condition     = var.other_volume_gb >= 0
    error_message = "Existing storage cannot be negative."
  }
}
variable "other_allocated_a1_ocpus" {
  type = number
  validation {
    condition     = var.other_allocated_a1_ocpus == 0
    error_message = "The proposed host uses the whole 2-OCPU allowance; no other A1 allocation may remain."
  }
}
variable "other_allocated_a1_memory_gb" {
  type = number
  validation {
    condition     = var.other_allocated_a1_memory_gb == 0
    error_message = "The proposed host uses the whole 12-GB A1 memory allowance; no other A1 allocation may remain."
  }
}
