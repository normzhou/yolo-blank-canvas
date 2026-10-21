#!/usr/bin/env python3
"""Refuse out-of-scope or destructive saved plans. Read decrypted JSON on stdin only."""
import ipaddress
import json
import sys

EXPECTED = {
    "terraform_data.admission",
    "oci_budget_budget.guard", "oci_budget_alert_rule.penny",
    "oci_core_vcn.host", "oci_core_internet_gateway.host", "oci_core_route_table.host",
    "oci_core_security_list.host", "oci_core_subnet.host", "oci_core_instance.host",
}


def review(plan):
    if not __debug__:
        raise ValueError("Optimized Python is not admitted for plan review")
    changes = [c for c in plan["resource_changes"] if c["mode"] == "managed"]
    if {c["address"] for c in changes} != EXPECTED:
        raise ValueError("Resource inventory differs from the reviewed single-host configuration")
    values = {}
    for c in changes:
        if c["change"]["actions"] not in (["create"], ["update"], ["no-op"]):
            raise ValueError("Delete, replacement or unrecognized action refused")
        values[c["address"]] = c["change"]["after"]
    vm = values["oci_core_instance.host"]
    assert vm["shape"] == "VM.Standard.A1.Flex"
    assert vm["shape_config"][0]["ocpus"] == 2
    assert vm["shape_config"][0]["memory_in_gbs"] == 12
    source = vm["source_details"][0]
    assert source["source_type"] == "image" and source["source_id"]
    assert 50 <= int(source["boot_volume_size_in_gbs"]) <= 100
    assert int(source["boot_volume_vpus_per_gb"]) == 10
    assert vm["preserve_boot_volume"] is True
    assert vm["instance_options"][0]["are_legacy_imds_endpoints_disabled"] is True
    rules = values["oci_core_security_list.host"]["ingress_security_rules"]
    assert len(rules) == 1 and rules[0]["protocol"] == "6"
    assert ipaddress.ip_network(rules[0]["source"]).version == 4
    assert ipaddress.ip_network(rules[0]["source"]).prefixlen == 32
    assert rules[0]["tcp_options"][0]["min"] == rules[0]["tcp_options"][0]["max"] == 22
    budget = values["oci_budget_budget.guard"]
    assert float(budget["amount"]) == 1 and budget["reset_period"] == "MONTHLY"
    alert = values["oci_budget_alert_rule.penny"]
    assert alert["type"] == "ACTUAL" and float(alert["threshold"]) == 1
    assert alert["threshold_type"] == "PERCENTAGE"
    return len(changes)


if __name__ == "__main__":
    try:
        count = review(json.load(sys.stdin))
    except (ValueError, KeyError, IndexError, TypeError, AssertionError):
        sys.exit("REFUSED: plan is incomplete, destructive or outside the reviewed resource/cost/access boundaries. No values printed.")
    print(f"PASS: {count} managed resources within reviewed boundaries; no delete/replacement. Owner still verifies account eligibility, image, region and current provider-policy evidence.")
