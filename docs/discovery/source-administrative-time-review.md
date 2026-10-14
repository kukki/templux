# 管理与审计界面时间显示核对

## 范围与证据

仅提取管理、审计控件的时间显示，不统一业务日期、物流市场日期或存储类型，不混入其它业务模块的时区。使用图搜索、精确符号读取、调用追踪及覆盖检查；下表文件 metadata_match 且未报告覆盖问题，属于 best-effort 信号。未运行浏览器，不保证所有页面已有一致格式。

| 项目 | 控件及证据 | 时区 | 时间精度 |
| --- | --- | --- | --- |
| Supplieroom | `src/modules/audit/ui/audit-log-workspace.tsx:349–355`，`AuditLogWorkspace` 调用 `formatTime` | Asia/Hong_Kong | `timeStyle: medium`，包含秒 |
| Skoope | `src/components/admin-console.tsx:31–33`，`AdminConsole` 审计行调用 `time` | Asia/Hong_Kong | hour、minute，未要求秒 |
| Catchouse | `prototype/operations-admin.js:4`，`render/runTable` 调用 `time` | Asia/Hong_Kong | `timeStyle: medium`，包含秒，hour12=false |

Catchouse 证据来自 `prototype/` 中现存管理控件，作为复用参考，不宣称已核实生产挂载或完成线上验收。主应用另有浏览器本地时区及业务日期格式，本题不以该控件证明全项目统一。

## 共通采用

模板通用管理/审计时间控件默认显式使用 Asia/Hong_Kong 显示，不随浏览器所在地隐式变化。新项目可通过项目级配置更改默认时区；不新增用户个人时区切换，不将纯日期值转换成时间戳。本结论只定义展示，数据库与 API 时刻合同另行从来源核对。

## 明确分歧

显示到秒（Supplieroom/Catchouse）或到分钟（Skoope）。本题只选默认显示精度，底层时间精度不因此截断，日期样式及分隔符仍需设计变量合同。

## 精度决策

用户选择默认显示到秒。TypeSafe 原始 A 44%、B 37%、需要澄清 19%，未自动采用，见 `typesafe-0119.json`。本决策不改变底层时刻、业务日期或时区配置归属。
