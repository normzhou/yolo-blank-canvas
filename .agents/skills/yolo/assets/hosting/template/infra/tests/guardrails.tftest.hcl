# Real HCL and provider schemas; cloud calls are replaced, not authenticated.
mock_provider "oci" {}

override_data {
  target = data.oci_identity_region_subscriptions.account
  values = {
    region_subscriptions = [{ is_home_region = true, region_name = "us-phoenix-1", region_key = "PHX", state = "READY", tenancy_id = "fixture-tenancy" }]
  }
}
override_data {
  target = data.oci_core_image.ubuntu
  values = {
    operating_system         = "Canonical Ubuntu"
    operating_system_version = "24.04"
    display_name             = "Canonical-Ubuntu-24.04-aarch64-fixture"
  }
}
variables {
  state_passphrase             = "fixture-only-not-a-production-key-00000000"
  tenancy_ocid                 = "fixture-tenancy"
  compartment_ocid             = "fixture-compartment"
  region                       = "us-phoenix-1"
  availability_domain          = "fixture:PHX-AD-1"
  image_ocid                   = "fixture-image"
  alert_email                  = "fixture@example.invalid"
  ssh_public_key               = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFixtureOnly"
  admin_ipv4_cidr              = "192.0.2.1/32"
  account_mode                 = "FREE_TIER"
  free_tier_verified           = true
  other_month_ocpu_hours       = 0
  other_month_memory_gb_hours  = 0
  other_volume_gb              = 0
  other_allocated_a1_ocpus     = 0
  other_allocated_a1_memory_gb = 0
}

run "reviewed_host_plan" {
  command = plan
  assert {
    condition     = oci_core_instance.host.shape == "VM.Standard.A1.Flex" && oci_core_instance.host.shape_config[0].ocpus == 2 && oci_core_instance.host.shape_config[0].memory_in_gbs == 12
    error_message = "Host allocation differs from the reviewed Always Free plan."
  }
  assert {
    condition     = oci_core_instance.host.source_details[0].boot_volume_vpus_per_gb == "10" && oci_core_instance.host.preserve_boot_volume
    error_message = "Balanced storage and boot preservation are required."
  }
  assert {
    condition     = length(oci_core_security_list.host.ingress_security_rules) == 1
    error_message = "Only owner SSH ingress is permitted."
  }
  assert {
    condition     = !strcontains(base64decode(oci_core_instance.host.metadata["user_data"]), "--token ")
    error_message = "Bootstrap must not contain a tunnel token."
  }
}
run "refuse_paid_account" {
  command = plan
  variables { account_mode = "PAYG" }
  expect_failures = [var.account_mode]
}
run "refuse_unverified_account" {
  command = plan
  variables { free_tier_verified = false }
  expect_failures = [var.free_tier_verified]
}
run "refuse_wrong_region" {
  command = plan
  variables { region = "us-ashburn-1" }
  expect_failures = [terraform_data.admission]
}
run "refuse_other_compute_usage" {
  command = plan
  variables { other_month_ocpu_hours = 13 }
  expect_failures = [terraform_data.admission]
}
run "refuse_other_memory_usage" {
  command = plan
  variables { other_month_memory_gb_hours = 73 }
  expect_failures = [terraform_data.admission]
}
run "refuse_aggregate_storage_overage" {
  command = plan
  variables { other_volume_gb = 101 }
  expect_failures = [terraform_data.admission]
}
run "refuse_other_a1_allocation" {
  command = plan
  variables { other_allocated_a1_ocpus = 1 }
  expect_failures = [var.other_allocated_a1_ocpus]
}
run "refuse_public_ssh" {
  command = plan
  variables { admin_ipv4_cidr = "0.0.0.0/0" }
  expect_failures = [var.admin_ipv4_cidr]
}
run "refuse_oversized_cpu" {
  command = plan
  variables { ocpus = 4 }
  expect_failures = [var.ocpus]
}
run "refuse_oversized_ram" {
  command = plan
  variables { memory_gb = 24 }
  expect_failures = [var.memory_gb]
}
run "refuse_oversized_boot" {
  command = plan
  variables { boot_gb = 201 }
  expect_failures = [var.boot_gb]
}
run "refuse_root_compartment" {
  command = plan
  variables { compartment_ocid = "fixture-tenancy" }
  expect_failures = [terraform_data.admission]
}
run "refuse_wrong_architecture" {
  command = plan
  override_data {
    target = data.oci_core_image.ubuntu
    values = {
      operating_system         = "Canonical Ubuntu"
      operating_system_version = "24.04"
      display_name             = "Canonical-Ubuntu-24.04-amd64-fixture"
    }
  }
  expect_failures = [terraform_data.admission]
}
