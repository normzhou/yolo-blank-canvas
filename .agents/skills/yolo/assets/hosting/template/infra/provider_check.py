#!/usr/bin/env python3
"""Validate a fresh private review record. This does not interpret provider webpages."""
from datetime import datetime, timezone, timedelta
import json
from pathlib import Path
import re
from urllib.parse import urlparse

PROFILE = "oci-arm64-cloudflare-v1"


def validate_review(review, variables_sha256, now=None):
    now = now or datetime.now(timezone.utc)
    def require(condition, message):
        if not condition:
            raise ValueError(message)
    require(review.get("profile") == PROFILE and review.get("status") == "verified", "Provider documentation is unavailable/unverified or profile differs")
    require(isinstance(variables_sha256, str) and re.fullmatch(r"[a-f0-9]{64}", variables_sha256) and review.get("variables_sha256") == variables_sha256, "Provider review belongs to different account inputs")
    def fresh(value):
        stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
        require(stamp.tzinfo is not None and -timedelta(minutes=5) <= now - stamp <= timedelta(hours=24), "Provider/account evidence is stale or future-dated")
    fresh(review["verified_at"])
    require(review["account_mode"] in {"FREE_TIER", "FREE_TRIAL_NOT_UPGRADED"}, "Paid upgrade is not admitted")
    require(review["region"] == review["home_region"] and bool(review["region"]), "Actual home region is required")
    require(review["account_eligibility_verified"] is True and review["aggregate_usage_verified"] is True and review["template_compatible"] is True, "Eligibility, aggregate usage or template compatibility is unverified")
    # These are conservative template requirements, never a claim that they remain
    # current provider allowances. Lower real allowances stop this old template.
    minimum = {"a1_ocpus": 2, "a1_memory_gb": 12, "a1_ocpu_hours": 1500,
               "a1_memory_gb_hours": 9000, "volume_gb": 200}
    for name, amount in minimum.items():
        value = review["current_allowance"][name]
        require(type(value) in (int, float) and value >= amount, "Current policy is incompatible with this template; update/replan, do not relax guards")
    catalog = json.loads(Path(__file__).with_name("providers.json").read_text())["oci"]
    for name, original in catalog.items():
        observation = review["sources"][name]
        require(observation["url"] == original and observation["status"] == "verified", "Required official provider reference was not verified")
        fresh(observation["observed_at"])
        resolved = urlparse(observation["resolved_url"])
        require(resolved.scheme == "https" and resolved.hostname in {"docs.oracle.com", "www.oracle.com"} and not resolved.username and not resolved.password, "Resolved provider documentation is not an authoritative HTTPS source")
        require(isinstance(observation["finding"], str) and bool(observation["finding"].strip()), "Record the relevant current-policy finding")
    return "fresh_review_record_validated; webpage semantics and actual account facts require agent/owner evidence"
