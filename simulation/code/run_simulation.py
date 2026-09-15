#!/usr/bin/env python3
"""蜂汇智理第一轮可复现社会仿真（仅使用 Python 标准库）。"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import random
import statistics
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


METRICS = [
    "effective_report_rate",
    "duplicate_or_invalid_rate",
    "dispatch_accuracy",
    "mean_resolution_hours",
    "mean_submission_minutes",
    "participation_gap_pp",
    "issue_coverage_rate",
    "resolution_rate",
    "late_period_participation_rate",
]


@dataclass
class Worker:
    worker_id: str
    worker_type: str
    time_pressure: float
    care_pressure: float
    trust: float
    privacy_concern: float
    service_need: float
    civic_motivation: float
    digital_comfort: float
    baseline_propensity: float


def stable_seed(base_seed: int, *parts: object) -> int:
    text = "|".join([str(base_seed), *(str(p) for p in parts)])
    return int.from_bytes(hashlib.blake2b(text.encode("utf-8"), digest_size=8).digest(), "big")


def stable_random(base_seed: int, *parts: object) -> random.Random:
    return random.Random(stable_seed(base_seed, *parts))


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return min(high, max(low, value))


def logistic(value: float) -> float:
    return 1.0 / (1.0 + math.exp(-value))


def weighted_choice(rng: random.Random, weights: dict[str, float]) -> str:
    point = rng.random() * sum(weights.values())
    cumulative = 0.0
    for name, weight in weights.items():
        cumulative += weight
        if point <= cumulative:
            return name
    return next(reversed(weights))


def sampled_profile_value(rng: random.Random, bounds: list[float]) -> float:
    low, high = bounds
    return low + (high - low) * rng.betavariate(2.2, 2.2)


def build_workers(config: dict[str, Any], run_id: int, seed: int) -> list[Worker]:
    workers: list[Worker] = []
    ranges = config["population"]["profile_ranges"]
    rider_share = config["population"]["rider_share"]
    for index in range(config["experiment"]["population"]):
        rng = stable_random(seed, "profile", run_id, index)
        worker_type = "rider" if rng.random() < rider_share else "driver"
        values = {key: sampled_profile_value(rng, value) for key, value in ranges.items()}

        # 调研只支持方向性异质性：司机经济/照护压力略高，骑手数字熟练度略高。
        if worker_type == "driver":
            values["time_pressure"] = clamp(values["time_pressure"] + 0.05)
            values["care_pressure"] = clamp(values["care_pressure"] + 0.08)
            values["digital_comfort"] = clamp(values["digital_comfort"] - 0.06)
        else:
            values["digital_comfort"] = clamp(values["digital_comfort"] + 0.03)

        baseline_score = (
            -0.55
            + 0.85 * values["trust"]
            + 0.75 * values["civic_motivation"]
            - 0.75 * values["time_pressure"]
            - 0.35 * values["privacy_concern"]
        )
        workers.append(
            Worker(
                worker_id=f"W{index + 1:03d}",
                worker_type=worker_type,
                baseline_propensity=logistic(baseline_score),
                **values,
            )
        )
    return workers


def issue_for(config: dict[str, Any], run_id: int, day: int, issue_index: int, seed: int) -> dict[str, Any]:
    rng = stable_random(seed, "issue", run_id, day, issue_index)
    category = weighted_choice(rng, config["incident_mix"])
    severity = weighted_choice(rng, config["severity_mix"])
    location_cell = rng.randrange(12)
    return {
        "issue_id": f"R{run_id:02d}-D{day:02d}-I{issue_index:02d}",
        "category": category,
        "severity": severity,
        "location_cell": location_cell,
    }


def report_probability(worker: Worker, scenario: dict[str, Any], common: dict[str, float]) -> float:
    privacy_exposure = worker.privacy_concern * (1.0 - scenario["privacy_protection"])
    tailored_incentive = scenario["incentive_strength"] * (
        0.55 * worker.service_need + 0.45 * (1.0 - worker.baseline_propensity)
    )
    score = (
        common["report_decision_intercept"]
        + common["trust_weight"] * worker.trust
        + common["civic_motivation_weight"] * worker.civic_motivation
        + common["digital_comfort_weight"] * worker.digital_comfort
        + common["time_pressure_weight"] * worker.time_pressure
        + common["privacy_risk_weight"] * privacy_exposure
        + common["minutes_weight"] * scenario["submission_minutes"]
        + scenario["convenience_bonus"]
        + scenario["transparency_bonus"]
        + tailored_incentive
    )
    return logistic(score)


def simulate_scenario(
    config: dict[str, Any], scenario_id: str, run_id: int, seed: int
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    scenario = config["scenarios"][scenario_id]
    common = config["common_parameters"]
    workers = build_workers(config, run_id, seed)
    days = config["experiment"]["days"]
    issues_per_day = config["experiment"]["issues_per_day"]
    encounter_probability = config["experiment"]["daily_encounter_probability"]

    pending_updates: dict[int, list[tuple[Worker, float]]] = defaultdict(list)
    seen_workorders: dict[str, str] = {}
    events: list[dict[str, Any]] = []
    opportunities = defaultdict(int)
    reports_by_type = defaultdict(int)
    late_opportunities = 0
    late_reports = 0
    encountered_issue_ids: set[str] = set()
    covered_issue_ids: set[str] = set()
    raw_reports = 0
    accepted_contributions = 0
    invalid_reports = 0
    merged_duplicates = 0
    unmerged_duplicates = 0
    workorders = 0
    correct_dispatches = 0
    resolved_workorders = 0
    resolution_hours: list[float] = []
    submission_minutes: list[float] = []
    emergency_referrals = 0

    for day in range(days):
        for worker, delta in pending_updates.pop(day, []):
            worker.trust = clamp(worker.trust + delta, 0.05, 0.95)

        issues = [issue_for(config, run_id, day, idx, seed) for idx in range(issues_per_day)]
        for worker_index, worker in enumerate(workers):
            encounter_rng = stable_random(seed, "encounter", run_id, day, worker_index)
            if encounter_rng.random() >= encounter_probability:
                continue
            issue_index = encounter_rng.randrange(issues_per_day)
            issue = issues[issue_index]
            encountered_issue_ids.add(issue["issue_id"])

            # 严重紧急事件不进入普通治理工单，模拟法定应急转接。
            is_emergency = issue["severity"] == "critical"
            if not is_emergency:
                opportunities[worker.worker_type] += 1
                if day >= days - 14:
                    late_opportunities += 1

            probability = report_probability(worker, scenario, common)
            decision_u = stable_random(seed, "decision", scenario_id, run_id, day, worker_index).random()
            if decision_u >= probability:
                continue

            reports_by_type[worker.worker_type] += 0 if is_emergency else 1
            if not is_emergency and day >= days - 14:
                late_reports += 1
            time_rng = stable_random(seed, "time", scenario_id, run_id, day, worker_index)
            minutes = max(0.6, time_rng.gauss(scenario["submission_minutes"], scenario["submission_minutes"] * 0.16))
            submission_minutes.append(minutes)

            if is_emergency:
                emergency_referrals += 1
                events.append(
                    {
                        "scenario": scenario_id,
                        "run": run_id,
                        "day": day + 1,
                        "worker_id": worker.worker_id,
                        "worker_type": worker.worker_type,
                        "issue_id": issue["issue_id"],
                        "category": issue["category"],
                        "severity": issue["severity"],
                        "action": "emergency_referral",
                        "accepted": 0,
                        "duplicate": 0,
                        "dispatch_correct": "",
                        "resolved": "",
                        "resolution_hours": "",
                        "submission_minutes": round(minutes, 3),
                    }
                )
                continue

            raw_reports += 1
            information_quality = clamp(
                common["base_information_quality"]
                + common["digital_quality_weight"] * worker.digital_comfort
                + common["time_quality_weight"] * worker.time_pressure
            )
            acceptance_probability = clamp(0.45 * information_quality + 0.55 * scenario["structuring_quality"])
            accepted = stable_random(seed, "accept", scenario_id, run_id, day, worker_index).random() < acceptance_probability
            duplicate = issue["issue_id"] in seen_workorders
            merged = False
            dispatch_correct: bool | str = ""
            resolved: bool | str = ""
            hours: float | str = ""
            action = "invalid"

            if not accepted:
                invalid_reports += 1
                trust_delta = -0.018
                due_day = min(days - 1, day + 2)
                pending_updates[due_day].append((worker, trust_delta))
            else:
                if duplicate:
                    merged = stable_random(seed, "dedupe", scenario_id, run_id, day, worker_index).random() < scenario["deduplication_probability"]
                if duplicate and merged:
                    merged_duplicates += 1
                    accepted_contributions += 1
                    covered_issue_ids.add(issue["issue_id"])
                    action = "merged_duplicate"
                    feedback = stable_random(seed, "feedback-merged", scenario_id, run_id, day, worker_index).random() < scenario["feedback_probability"]
                    delta = 0.018 if feedback else -0.004
                    if scenario["differentiated_incentive"]:
                        delta += 0.008 * worker.service_need
                    pending_updates[min(days - 1, day + 1)].append((worker, delta))
                else:
                    if duplicate:
                        unmerged_duplicates += 1
                        action = "unmerged_duplicate"
                    else:
                        accepted_contributions += 1
                        covered_issue_ids.add(issue["issue_id"])
                        action = "new_workorder"

                    workorders += 1
                    workorder_id = f"{scenario_id}-R{run_id:02d}-W{workorders:04d}"
                    if not duplicate:
                        seen_workorders[issue["issue_id"]] = workorder_id
                    dispatch_correct = stable_random(seed, "dispatch", scenario_id, run_id, day, worker_index).random() < scenario["dispatch_accuracy"]
                    if dispatch_correct:
                        correct_dispatches += 1
                    resolution_probability = clamp(
                        common["resolved_probability"]
                        + (common["correct_dispatch_resolution_bonus"] if dispatch_correct else -0.10)
                        + (0.035 if scenario["transparent_feedback"] else 0.0)
                    )
                    resolved = stable_random(seed, "resolve", scenario_id, run_id, day, worker_index).random() < resolution_probability
                    if resolved:
                        resolved_workorders += 1
                        duration_rng = stable_random(seed, "duration", scenario_id, run_id, day, worker_index)
                        hours_value = duration_rng.lognormvariate(math.log(scenario["base_resolution_hours"]), 0.32)
                        if dispatch_correct:
                            hours_value *= 0.84
                        hours = round(hours_value, 3)
                        resolution_hours.append(hours_value)

                    feedback = stable_random(seed, "feedback", scenario_id, run_id, day, worker_index).random() < scenario["feedback_probability"]
                    if resolved and feedback:
                        delta = 0.050
                    elif resolved:
                        delta = 0.004
                    elif feedback:
                        delta = -0.014
                    else:
                        delta = -0.035
                    if scenario["differentiated_incentive"] and accepted:
                        delta += 0.012 * worker.service_need
                    delay_days = max(1, math.ceil(float(hours) / 24.0)) if resolved else 7
                    pending_updates[min(days - 1, day + delay_days)].append((worker, delta))

            events.append(
                {
                    "scenario": scenario_id,
                    "run": run_id,
                    "day": day + 1,
                    "worker_id": worker.worker_id,
                    "worker_type": worker.worker_type,
                    "issue_id": issue["issue_id"],
                    "category": issue["category"],
                    "severity": issue["severity"],
                    "action": action,
                    "accepted": int(accepted),
                    "duplicate": int(duplicate),
                    "dispatch_correct": int(dispatch_correct) if isinstance(dispatch_correct, bool) else "",
                    "resolved": int(resolved) if isinstance(resolved, bool) else "",
                    "resolution_hours": hours,
                    "submission_minutes": round(minutes, 3),
                }
            )

    rider_rate = reports_by_type["rider"] / opportunities["rider"] if opportunities["rider"] else 0.0
    driver_rate = reports_by_type["driver"] / opportunities["driver"] if opportunities["driver"] else 0.0
    ineffective = invalid_reports + unmerged_duplicates
    metrics = {
        "scenario": scenario_id,
        "scenario_label": scenario["label"],
        "run": run_id,
        "seed": seed,
        "encountered_unique_issues": len(encountered_issue_ids),
        "raw_reports": raw_reports,
        "accepted_contributions": accepted_contributions,
        "invalid_reports": invalid_reports,
        "merged_duplicates": merged_duplicates,
        "unmerged_duplicates": unmerged_duplicates,
        "workorders": workorders,
        "emergency_referrals": emergency_referrals,
        "effective_report_rate": accepted_contributions / raw_reports if raw_reports else 0.0,
        "duplicate_or_invalid_rate": ineffective / raw_reports if raw_reports else 0.0,
        "dispatch_accuracy": correct_dispatches / workorders if workorders else 0.0,
        "mean_resolution_hours": statistics.fmean(resolution_hours) if resolution_hours else 0.0,
        "mean_submission_minutes": statistics.fmean(submission_minutes) if submission_minutes else 0.0,
        "participation_gap_pp": abs(rider_rate - driver_rate) * 100.0,
        "rider_participation_rate": rider_rate,
        "driver_participation_rate": driver_rate,
        "issue_coverage_rate": len(covered_issue_ids) / len(encountered_issue_ids) if encountered_issue_ids else 0.0,
        "resolution_rate": resolved_workorders / workorders if workorders else 0.0,
        "late_period_participation_rate": late_reports / late_opportunities if late_opportunities else 0.0,
    }
    return metrics, events


def mean_ci95(values: Iterable[float]) -> tuple[float, float, float]:
    data = list(values)
    mean = statistics.fmean(data)
    if len(data) < 2:
        return mean, mean, mean
    se = statistics.stdev(data) / math.sqrt(len(data))
    margin = 1.96 * se
    return mean, mean - margin, mean + margin


def aggregate(run_rows: list[dict[str, Any]], scenario_ids: list[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for scenario_id in scenario_ids:
        subset = [row for row in run_rows if row["scenario"] == scenario_id]
        for metric in METRICS:
            mean, low, high = mean_ci95(float(row[metric]) for row in subset)
            rows.append(
                {
                    "scenario": scenario_id,
                    "scenario_label": subset[0]["scenario_label"],
                    "metric": metric,
                    "mean": mean,
                    "ci95_low": low,
                    "ci95_high": high,
                    "runs": len(subset),
                }
            )
    return rows


def paired_effects(run_rows: list[dict[str, Any]], scenario_ids: list[str]) -> list[dict[str, Any]]:
    requested = [("S0", "S1"), ("S1", "S2"), ("S2", "S3"), ("S0", "S3")]
    transitions = [(left, right) for left, right in requested if left in scenario_ids and right in scenario_ids]
    lookup = {(row["scenario"], int(row["run"])): row for row in run_rows}
    run_ids = sorted({int(row["run"]) for row in run_rows})
    rows: list[dict[str, Any]] = []
    for left, right in transitions:
        for metric in METRICS:
            differences = [float(lookup[(right, run)][metric]) - float(lookup[(left, run)][metric]) for run in run_ids]
            mean, low, high = mean_ci95(differences)
            rows.append(
                {
                    "transition": f"{left}->{right}",
                    "from_scenario": left,
                    "to_scenario": right,
                    "metric": metric,
                    "mean_difference": mean,
                    "ci95_low": low,
                    "ci95_high": high,
                    "runs": len(differences),
                }
            )
    return rows


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        return
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def format_metric(metric: str, value: float) -> str:
    if metric in {"mean_resolution_hours", "mean_submission_minutes", "participation_gap_pp"}:
        return f"{value:.2f}"
    return f"{value * 100:.1f}%"


def build_summary(
    config: dict[str, Any],
    aggregates: list[dict[str, Any]],
    effects: list[dict[str, Any]],
    run_count: int,
    scenario_ids: list[str],
) -> str:
    lookup = {(row["scenario"], row["metric"]): row for row in aggregates}
    labels = {sid: config["scenarios"][sid]["label"] for sid in config["scenarios"]}
    lines = [
        "# 第一轮仿真结果摘要",
        "",
        "> 结论边界：以下均为基于项目假设的合成仿真结果，不是现实统计或政策效果证明。",
        "",
        f"每个情景独立重复 {run_count} 次；每次包含 {config['experiment']['population']} 名合成从业者、{config['experiment']['days']} 个模拟日。四个情景在同一轮使用同一人群画像与问题流，仅治理机制不同。",
        "",
        "## 六项主要指标",
        "",
        "| 情景 | 有效上报率 | 重复或无效率 | 分派准确率 | 平均处置时间（小时） | 平均上报耗时（分钟） | 群体参与差距（百分点） |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for sid in scenario_ids:
        values = [lookup[(sid, metric)]["mean"] for metric in METRICS[:6]]
        lines.append(
            f"| {sid} {labels[sid]} | {format_metric(METRICS[0], values[0])} | "
            f"{format_metric(METRICS[1], values[1])} | {format_metric(METRICS[2], values[2])} | "
            f"{format_metric(METRICS[3], values[3])} | {format_metric(METRICS[4], values[4])} | "
            f"{format_metric(METRICS[5], values[5])} |"
        )
    lines.extend(
        [
            "",
            "## 辅助指标",
            "",
            "| 情景 | 独立问题覆盖率 | 工单解决率 | 最后两周参与率 |",
            "|---|---:|---:|---:|",
        ]
    )
    for sid in scenario_ids:
        vals = [lookup[(sid, metric)]["mean"] for metric in METRICS[6:]]
        lines.append(f"| {sid} {labels[sid]} | {vals[0]*100:.1f}% | {vals[1]*100:.1f}% | {vals[2]*100:.1f}% |")

    effect_lookup = {(row["transition"], row["metric"]): row for row in effects}
    lines.extend(
        [
            "",
            "## 递进机制的配对效应",
            "",
            "| 机制变化 | 指标 | 平均差 | 95% 区间 |",
            "|---|---|---:|---:|",
        ]
    )
    selected_effects = [
        ("S0->S1", "effective_report_rate", "有效上报率"),
        ("S0->S1", "mean_submission_minutes", "上报耗时（分钟）"),
        ("S1->S2", "mean_resolution_hours", "处置时间（小时）"),
        ("S1->S2", "late_period_participation_rate", "最后两周参与率"),
        ("S2->S3", "issue_coverage_rate", "独立问题覆盖率"),
        ("S2->S3", "participation_gap_pp", "群体参与差距（百分点）"),
    ]
    for transition, metric, label in selected_effects:
        if (transition, metric) not in effect_lookup:
            continue
        row = effect_lookup[(transition, metric)]
        mean, low, high = row["mean_difference"], row["ci95_low"], row["ci95_high"]
        if metric in {"mean_submission_minutes", "mean_resolution_hours", "participation_gap_pp"}:
            rendered = (f"{mean:+.2f}", f"[{low:+.2f}, {high:+.2f}]")
        else:
            rendered = (f"{mean*100:+.1f} 个百分点", f"[{low*100:+.1f}, {high*100:+.1f}]")
        lines.append(f"| {transition} | {label} | {rendered[0]} | {rendered[1]} |")

    lines.extend(["", "## 第一轮可采用结论", ""])
    if set(scenario_ids) == {"S0", "S1", "S2", "S3"}:
        s0 = {metric: lookup[("S0", metric)]["mean"] for metric in METRICS}
        s3 = {metric: lookup[("S3", metric)]["mean"] for metric in METRICS}
        lines.extend(
            [
                f"1. 在当前假设下，S3 相比 S0 的有效上报率变化为 {(s3['effective_report_rate']-s0['effective_report_rate'])*100:+.1f} 个百分点，独立问题覆盖率变化为 {(s3['issue_coverage_rate']-s0['issue_coverage_rate'])*100:+.1f} 个百分点。",
                f"2. AI 结构化、去重和建议分派对应的 S1，相比 S0 将平均上报耗时改变 {lookup[('S1', 'mean_submission_minutes')]['mean']-s0['mean_submission_minutes']:+.2f} 分钟；S1 的具体效果应以表格为准。",
                f"3. 透明反馈对应的 S2 与差异化激励对应的 S3，可通过最后两周参与率观察持续参与变化；当前 S3 比 S0 变化 {(s3['late_period_participation_rate']-s0['late_period_participation_rate'])*100:+.1f} 个百分点。",
                "4. 这些结果只用于比较机制方向。进入最终报告前，必须完成关键参数敏感性分析，并在玉兰万象中复跑或用平台导出结果交叉核对。",
            ]
        )
    else:
        lines.append(f"本次仅运行 {', '.join(scenario_ids)}，不生成完整 S0—S3 跨情景结论。")
    lines.extend(
        [
            "",
            "## 文件索引",
            "",
            "- `run-metrics.csv`：每个情景、每次重复运行的完整指标。",
            "- `aggregated-metrics.csv`：均值与正态近似 95% 置信区间。",
            "- `paired-effects.csv`：同一轮次下机制递进的配对差与 95% 区间。",
            "- `raw/events.csv`：逐条上报、分派与处置事件。",
            "- `experiment-manifest.json`：运行参数与文件校验值。",
            "",
        ]
    )
    return "\n".join(lines)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="运行蜂汇智理 S0-S3 配对社会仿真")
    parser.add_argument("--config", type=Path, default=Path(__file__).with_name("config.json"))
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parents[1] / "results")
    parser.add_argument("--runs", type=int, default=None, help="覆盖配置中的重复次数")
    parser.add_argument("--seed", type=int, default=None, help="覆盖配置中的基础随机种子")
    parser.add_argument("--scenarios", nargs="+", choices=["S0", "S1", "S2", "S3"], default=None)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    run_count = args.runs or config["experiment"]["runs"]
    seed = args.seed if args.seed is not None else config["experiment"]["base_seed"]
    scenario_ids = args.scenarios or list(config["scenarios"].keys())
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    run_rows: list[dict[str, Any]] = []
    all_events: list[dict[str, Any]] = []
    for run_id in range(1, run_count + 1):
        for scenario_id in scenario_ids:
            metrics, events = simulate_scenario(config, scenario_id, run_id, seed)
            run_rows.append(metrics)
            all_events.extend(events)

    aggregate_rows = aggregate(run_rows, scenario_ids)
    effect_rows = paired_effects(run_rows, scenario_ids)
    run_metrics_path = output_dir / "run-metrics.csv"
    aggregate_path = output_dir / "aggregated-metrics.csv"
    effects_path = output_dir / "paired-effects.csv"
    events_path = output_dir / "raw" / "events.csv"
    summary_path = output_dir / "round-1-summary.md"
    write_csv(run_metrics_path, run_rows)
    write_csv(aggregate_path, aggregate_rows)
    write_csv(effects_path, effect_rows)
    write_csv(events_path, all_events)
    summary_path.write_text(build_summary(config, aggregate_rows, effect_rows, run_count, scenario_ids), encoding="utf-8")

    manifest = {
        "project": config["experiment"]["project"],
        "schema_version": config["schema_version"],
        "base_seed": seed,
        "runs_per_scenario": run_count,
        "scenarios": scenario_ids,
        "paired_common_random_numbers": True,
        "population_per_run": config["experiment"]["population"],
        "days_per_run": config["experiment"]["days"],
        "files": {},
    }
    for path in [args.config.resolve(), Path(__file__).resolve(), run_metrics_path, aggregate_path, effects_path, events_path, summary_path]:
        manifest["files"][str(path.relative_to(Path(__file__).resolve().parents[1])) if path.is_relative_to(Path(__file__).resolve().parents[1]) else path.name] = sha256(path)
    (output_dir / "experiment-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Completed {len(scenario_ids)} scenarios x {run_count} runs")
    print(f"Results: {output_dir}")


if __name__ == "__main__":
    main()
