# 蜂汇智理提交包清单

## 预期目录

```text
submission/
├─ README.md
├─ report/
│  ├─ report-final.docx
│  ├─ report-final.pdf
│  └─ sources-and-claims.md
├─ video/
│  ├─ video-link.md
│  ├─ narration-final.md
│  └─ checksum.txt
├─ prototype/
│  ├─ app-or-build/
│  ├─ screenshots/
│  └─ demo-data/
├─ simulation/
│  ├─ code/
│  ├─ configs/
│  ├─ results/
│  └─ reproducibility.md
└─ qa/
   ├─ fact-and-citation-audit.md
   ├─ numerical-and-reproducibility-audit.md
   └─ demo-product-and-safety-audit.md
```

最终目录名称和层级须按官方要求调整：`CITATION_NEEDED_SUBMISSION_STRUCTURE`。

## 文件命名规则

- 组委会材料给出的总包格式为 `赛道编号-团队名称.zip`；技术文档为 `赛道编号-团队名称-作品名称.pdf`，视频为 `赛道编号-团队名称-演示视频.mp4`，代码为附 README 的 ZIP。赛道编号具体写作“赛道二”还是“2”、团队登记名称仍待提交系统核对。
- 最终文件使用小写英文、数字和连字符，避免“最终版2”“最新版”等不可追溯名称。
- 候选版本使用 `v1`、`v2`；正式提交只保留 `final`。
- 图表使用 `fig-01-主题`，截图使用 `screen-01-页面`，实验运行使用 `scenario-seed-run`。
- 视频不反复进入 Git 历史；仓库记录链接、版本、大小和校验值。

## 打包前检查

- [ ] 官方规定的提交物全部存在且可打开。
- [ ] 报告源文件与 PDF 内容一致。
- [ ] 视频链接无需额外授权或已按要求开放。
- [ ] 代码、配置、原始结果和图表之间可追溯。
- [ ] 所有三类占位符搜索结果为零。
- [ ] 无真实敏感材料、密钥、`.env`、临时锁文件、缓存和日志泄漏。
- [ ] 无大型无关文件；视频大小符合官方限制。
- [ ] 在新目录解压并按 README 完成一次复现或最小检查。
- [ ] 三份专业审计均通过，未通过项已有处理记录。

## 当前缺失

- 官方比赛提交规则与截止信息：`CITATION_NEEDED`。
- AI 1 第一轮证据包。
- AI 2 第一轮仿真与结果包。
- AI 3 第一轮原型、截图与演示素材。
- 最终报告、视频、复现结果与三份终审记录。
