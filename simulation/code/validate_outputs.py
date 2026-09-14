#!/usr/bin/env python3
"""验证第一轮输出结构、范围和配对实验完整性。"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


RATE_FIELDS = {
    "effective_report_rate",
    "duplicate_or_invalid_rate",
    "dispatch_accuracy",
    "rider_participation_rate",
    "driver_participation_rate",
    "issue_coverage_rate",
    "resolution_rate",
    "late_period_participation_rate",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--results", type=Path, default=Path(__file__).resolve().parents[1] / "results")
    args = parser.parse_args()
    results = args.results.resolve()
    manifest = json.loads((results / "experiment-manifest.json").read_text(encoding="utf-8"))
    expected_scenarios = set(manifest["scenarios"])
    expected_runs = int(manifest["runs_per_scenario"])

    with (results / "run-metrics.csv").open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == len(expected_scenarios) * expected_runs, "运行行数不完整"
    pairs = {(row["scenario"], int(row["run"])) for row in rows}
    expected_pairs = {(sid, run) for sid in expected_scenarios for run in range(1, expected_runs + 1)}
    assert pairs == expected_pairs, "情景与轮次组合缺失或重复"
    for row in rows:
        for field in RATE_FIELDS:
            value = float(row[field])
            assert 0.0 <= value <= 1.0, f"{field} 越界: {value}"
        assert float(row["participation_gap_pp"]) <= 100.0
        assert float(row["mean_resolution_hours"]) > 0.0
        assert float(row["mean_submission_minutes"]) > 0.0

    with (results / "aggregated-metrics.csv").open(encoding="utf-8-sig", newline="") as handle:
        aggregate_rows = list(csv.DictReader(handle))
    assert aggregate_rows, "聚合结果为空"
    with (results / "paired-effects.csv").open(encoding="utf-8-sig", newline="") as handle:
        effect_rows = list(csv.DictReader(handle))
    requested = [("S0", "S1"), ("S1", "S2"), ("S2", "S3"), ("S0", "S3")]
    expected_effect_rows = 9 * sum(left in expected_scenarios and right in expected_scenarios for left, right in requested)
    assert len(effect_rows) == expected_effect_rows, "配对效应行数不完整"
    assert (results / "raw" / "events.csv").stat().st_size > 1000, "事件日志异常为空"
    assert "合成仿真结果" in (results / "round-1-summary.md").read_text(encoding="utf-8")
    print(f"PASS: {len(rows)} run rows, {len(aggregate_rows)} aggregate rows, {len(effect_rows)} paired effects")


if __name__ == "__main__":
    main()
