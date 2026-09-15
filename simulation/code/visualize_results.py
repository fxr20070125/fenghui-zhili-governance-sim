#!/usr/bin/env python3
"""从聚合 CSV 生成无需第三方依赖的 SVG 结果看板。"""

from __future__ import annotations

import csv
from pathlib import Path
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "results"
COLORS = {"S0": "#64748b", "S1": "#2563eb", "S2": "#0d9488", "S3": "#f59e0b"}
LABELS = {
    "S0": "S0 现状基准",
    "S1": "S1 AI上报",
    "S2": "S2 透明反馈",
    "S3": "S3 差异化激励",
}
PANELS = [
    ("effective_report_rate", "有效上报率", "%", 1.0),
    ("duplicate_or_invalid_rate", "重复或无效率", "%", 1.0),
    ("dispatch_accuracy", "分派准确率", "%", 1.0),
    ("mean_resolution_hours", "平均处置时间", "小时", 60.0),
    ("mean_submission_minutes", "平均上报耗时", "分钟", 10.0),
    ("late_period_participation_rate", "最后两周参与率", "%", 1.0),
]


def main() -> None:
    with (RESULTS / "aggregated-metrics.csv").open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    values = {(row["scenario"], row["metric"]): float(row["mean"]) for row in rows}
    width, height = 1600, 940
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#f8fafc"/>',
        '<text x="70" y="72" font-family="Microsoft YaHei, sans-serif" font-size="38" font-weight="700" fill="#0f172a">蜂汇智理｜S0—S3 第一轮社会仿真</text>',
        '<text x="70" y="112" font-family="Microsoft YaHei, sans-serif" font-size="20" fill="#475569">20 次配对运行 · 240 名合成从业者 · 56 个模拟日｜结果为项目假设下的合成仿真</text>',
    ]
    for index, sid in enumerate(LABELS):
        x = 75 + index * 260
        parts.append(f'<rect x="{x}" y="140" width="24" height="24" rx="4" fill="{COLORS[sid]}"/>')
        parts.append(f'<text x="{x+34}" y="160" font-family="Microsoft YaHei, sans-serif" font-size="18" fill="#334155">{escape(LABELS[sid])}</text>')

    for panel_index, (metric, title, unit, scale_max) in enumerate(PANELS):
        row, col = divmod(panel_index, 3)
        x, y = 70 + col * 510, 205 + row * 345
        parts.append(f'<rect x="{x}" y="{y}" width="460" height="300" rx="18" fill="#ffffff" stroke="#e2e8f0"/>')
        parts.append(f'<text x="{x+28}" y="{y+42}" font-family="Microsoft YaHei, sans-serif" font-size="23" font-weight="700" fill="#0f172a">{escape(title)}</text>')
        for idx, sid in enumerate(LABELS):
            value = values[(sid, metric)]
            bar_y = y + 74 + idx * 50
            bar_width = max(2, min(300, value / scale_max * 300))
            shown = f"{value*100:.1f}%" if unit == "%" else f"{value:.2f} {unit}"
            parts.append(f'<text x="{x+28}" y="{bar_y+18}" font-family="Microsoft YaHei, sans-serif" font-size="16" fill="#475569">{sid}</text>')
            parts.append(f'<rect x="{x+72}" y="{bar_y}" width="300" height="24" rx="6" fill="#e2e8f0"/>')
            parts.append(f'<rect x="{x+72}" y="{bar_y}" width="{bar_width:.1f}" height="24" rx="6" fill="{COLORS[sid]}"/>')
            parts.append(f'<text x="{x+385}" y="{bar_y+18}" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#0f172a">{shown}</text>')
        direction = "越低越好" if metric in {"duplicate_or_invalid_rate", "mean_resolution_hours", "mean_submission_minutes"} else "越高越好"
        parts.append(f'<text x="{x+28}" y="{y+278}" font-family="Microsoft YaHei, sans-serif" font-size="15" fill="#64748b">指标方向：{direction}</text>')

    parts.append('<text x="70" y="915" font-family="Microsoft YaHei, sans-serif" font-size="16" fill="#64748b">注意：该图不能被描述为真实城市运行成效；详细区间和口径见 round-1-summary.md 与 paired-effects.csv。</text>')
    parts.append("</svg>")
    output = RESULTS / "round-1-dashboard.svg"
    output.write_text("\n".join(parts), encoding="utf-8")
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
