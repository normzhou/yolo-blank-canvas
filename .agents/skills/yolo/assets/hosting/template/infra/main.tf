provider "oci" {
  region              = var.region
  config_file_profile = var.oci_profile
}

data "oci_identity_region_subscriptions" "account" {
  tenancy_id = var.tenancy_ocid
}
data "oci_core_image" "ubuntu" {
  image_id = var.image_ocid
}

resource "terraform_data" "admission" {
  lifecycle {
    precondition {
      condition     = anytrue([for r in data.oci_identity_region_subscriptions.account.region_subscriptions : r.is_home_region && r.region_name == var.region])
      error_message = "Only the tenancy's actual home region is permitted."
    }
    precondition {
      condition     = var.ocpus * 744 + var.other_month_ocpu_hours <= 1500 && var.memory_gb * 744 + var.other_month_memory_gb_hours <= 9000 && var.boot_gb + var.other_volume_gb <= 200
      error_message = "Conservative 31-day account-wide Always Free compute/storage allowance would be exceeded."
    }
    precondition {
      condition     = data.oci_core_image.ubuntu.operating_system == "Canonical Ubuntu" && data.oci_core_image.ubuntu.operating_system_version == "24.04" && can(regex("aarch64", data.oci_core_image.ubuntu.display_name))
      error_message = "Pin a reviewed Ubuntu 24.04 aarch64 platform image in the chosen home region."
    }
    precondition {
      condition     = var.compartment_ocid != var.tenancy_ocid
      error_message = "Use the dedicated yolo-__APP_SLUG__-host child compartment, not the tenancy root."
    }
  }
}

resource "oci_budget_budget" "guard" {
  compartment_id = var.tenancy_ocid
  amount         = 1
  reset_period   = "MONTHLY"
  display_name   = "yolo-__APP_SLUG__-host-first-penny"
  target_type    = "COMPARTMENT"
  targets        = [var.tenancy_ocid]
  depends_on     = [terraform_data.admission]
}
resource "oci_budget_alert_rule" "penny" {
  budget_id      = oci_budget_budget.guard.id
  type           = "ACTUAL"
  threshold      = 1
  threshold_type = "PERCENTAGE"
  recipients     = var.alert_email
  display_name   = "first-penny-not-a-cap"
}

resource "oci_core_vcn" "host" {
  compartment_id = var.compartment_ocid
  cidr_blocks    = ["10.61.0.0/16"]
  display_name   = "yolo-__APP_SLUG__-host"
  depends_on     = [terraform_data.admission]
  lifecycle { prevent_destroy = true }
}
resource "oci_core_internet_gateway" "host" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.host.id
  display_name   = "yolo-__APP_SLUG__-host-egress"
  lifecycle { prevent_destroy = true }
}
resource "oci_core_route_table" "host" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.host.id
  route_rules {
    network_entity_id = oci_core_internet_gateway.host.id
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
  }
  lifecycle { prevent_destroy = true }
}
resource "oci_core_security_list" "host" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.host.id
  display_name   = "yolo-owner-ssh-only"
  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
  }
  ingress_security_rules {
    protocol = "6"
    source   = var.admin_ipv4_cidr
    tcp_options {
      min = 22
      max = 22
    }
  }
  lifecycle { prevent_destroy = true }
}
resource "oci_core_subnet" "host" {
  compartment_id    = var.compartment_ocid
  vcn_id            = oci_core_vcn.host.id
  cidr_block        = "10.61.1.0/24"
  route_table_id    = oci_core_route_table.host.id
  security_list_ids = [oci_core_security_list.host.id]
  display_name      = "yolo-__APP_SLUG__-host"
  lifecycle { prevent_destroy = true }
}
resource "oci_core_instance" "host" {
  compartment_id       = var.compartment_ocid
  availability_domain  = var.availability_domain
  display_name         = "yolo-__APP_SLUG__-host"
  shape                = "VM.Standard.A1.Flex"
  preserve_boot_volume = true
  shape_config {
    ocpus         = var.ocpus
    memory_in_gbs = var.memory_gb
  }
  instance_options { are_legacy_imds_endpoints_disabled = true }
  create_vnic_details {
    subnet_id        = oci_core_subnet.host.id
    assign_public_ip = true
  }
  source_details {
    source_type             = "image"
    source_id               = var.image_ocid
    boot_volume_size_in_gbs = var.boot_gb
    boot_volume_vpus_per_gb = 10
  }
  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data           = base64encode(file("${path.module}/bootstrap.sh"))
  }
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [metadata["user_data"]]
  }
  depends_on = [oci_budget_alert_rule.penny]
}

output "vm_public_ip" {
  value     = oci_core_instance.host.public_ip
  sensitive = true
}
