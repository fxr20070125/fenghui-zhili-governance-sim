#!/usr/bin/env python3
"""验证配置完整性及 S0-S3 的递进干预关系。"""

from __future__ import annotations

import json
from pathlib import Path


CONFIG = Path(__file__).with_name("config.json")


def changed_keys(left: dict, right: dict) -> set[str]:
    ignored = {"label"}
    return {key for key in left if key not in ignored and left[key] != right[key]}


def main() -> None:
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    assert list(config["scenarios"]) == ["S0", "S1", "S2", "S3"]
    assert abs(sum(config["incident_mix"].values()) - 1.0) < 1e-9
    assert abs(sum(config["severity_mix"].values()) - 1.0) < 1e-9
    assert config["experiment"]["runs"] >= 5

    scenarios = config["scenarios"]
    s1_s2_allowed = {"transparent_feedback", "feedback_probability", "transparency_bonus", "base_resolution_hours"}
    s2_s3_allowed = {"differentiated_incentive", "incentive_strength"}
    assert changed_keys(scenarios["S1"], scenarios["S2"]) == s1_s2_allowed
    assert changed_keys(scenarios["S2"], scenarios["S3"]) == s2_s3_allowed
    print("PASS: config schema and incremental intervention invariants")


if __name__ == "__main__":
    main()
