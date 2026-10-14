# T09 F1 修复验收：显式空配置

日期：2026-10-15。基线fd037daaff73b3e3125861379a1b2f5e30b74e77，保留初审 [t09-review.md](t09-review.md) 及原验收历史。仅修复六项T09公共配置，不变更既有其它环境变量、SQL迁移或网页。

## 核验与修复

读取初审、t09-independent-empty-config.log及config-controls.json，按receiving-code-review/systematic-debugging先复现。实际Compose渲染的unset与empty均为90/1000/10/3600/10485760/10，合法覆盖30/200/3/120/32768/4正常；test-results/t09-fix-red.json。旧management直接收到空AUDIT_RETENTION_DAYS仍config-check退出0/oktrue（t09-fix-cli-red.json/log），说明CLI缺审计配置校验，不仅是Compose字符串问题。

- Compose六个新键全部改成只在未设置时默认，API/Web/management环境及Docker logging options保持同值。显式空值不再被默认覆盖。management补入四个AUDIT键，未增加其它配置。
- start/config-check复用现有auditSettings，在任何启动build/up/migrate之前验证；其它救援动作没有新加审计配置阻塞。runtimePolicy既有入口仍校验容量，CLI错误结果明确“运行日志容量配置无效。”，诊断安全结构化。
- 未新增校验器或改变范围默认。直接Docker json-file空参数实测Engine拒绝invalid size，非零且stderr；不依赖驱动自动默认。若Engine先拒绝，容器未运行、stdout没有应用JSON结果，不能伪造已执行结果。另以有效Driver options加container -e空值，证明API/CLI校验器也拒绝两个容量空输入。

Context7 /docker/docs 核对 [Compose插值](https://docs.docker.com/reference/compose-file/interpolation/) 的unset-only/default语义及 [json-file选项](https://docs.docker.com/engine/logging/drivers/json-file/) 字符串/默认限制。结构用codebase-memory搜索/trace/snippet及逐依赖文件coverage，metadata_match/no_recorded_issue，best-effort；配置与脚本直接读。没有Postgres对象变更、Web行为变化。

## 实际命令与证据

| 命令/风险 | 结果（test-results/） |
| --- | --- |
| docker compose build api management checks | 退出0；t09-fix-build.log；未重建原容器或Web |
| python3 tests/compose-audit-config.py | 23组/45次实际一次性API/CLI入口检查全通过；t09-fix-config-regression.json/log |
| docker compose up -d --wait auth-database | 仅隔离tmpfs测试库启动；t09-fix-database.log |
| docker compose run --rm --no-deps checks node --test --test-concurrency=1 tests/audit.test.mjs tests/audit-lifecycle.test.mjs tests/runtime-log.test.mjs | 20/20，fail/cancel/skipped0；t09-fix-targeted.log |
| docker compose run --rm --no-deps checks npm run typecheck | API/Web退出0；t09-fix-typecheck.log |
| python3 test-results/t09-fix-rescue/rescue.py | 自有三容器真实stop退出0/均停止，DB不可达审计诊断明确；t09-fix-rescue-evidence.json/log |
| docker compose rm -s -f auth-database | 隔离库删除；t09-fix-cleanup.log |

新增host回归脚本实际调用docker compose --env-file /dev/null --profile tools config --format json，完整config仅内存解析，证据只保留六项公共配置和退出/诊断类别，不输出其它环境或.env。验证全部服务的Docker logging options与API值一致，management六项相同、Web容量相同。

对照：unset采用原默认；合法六值覆盖正确，实际API构造/监听/健康HTTP后返回相同有效设置并正常关闭、CLI config-check成功。六键逐一显式空、非数字及超范围均原值保留，实际API/CLI非零拒绝，未启动的Driver失败与应用安全failure明确区分。两容量空值另走有效Driver的container env路径，实际application_start_failed/management_failed、非Engine失败。start空审计值返回精确审计配置错误，未进入Compose部署动作。总23组包括20组基础对照、2组容量应用校验、1组start前置拒绝。

API探针只在一次性生产镜像进程内调用实际createApplication，真实监听/health HTTP，Pool指向隔离127.0.0.1:1，不接触原库；没有新增生产probe路由或认证fixture。CLI探针DATABASE_URL空避免对部署记录测试事件。应用失败JSON结果在stdout、management_failed等结构化诊断在stderr；Engine失败非零/stderr、无假JSON成功。

stop救援复用本票已验证脚本的独立副本，项目templux-t09-fix-rescue，仅三个自有持续运行容器，DATABASE_URL固定不可达127.0.0.1:1；实际ok/stop且maintenance_audit_unavailable，之后down销毁。没有执行原项目stop，未覆盖初审/原开发证据。

## 局限与交付状态

针对纯配置/CLI前置校验变更，执行Compose实际矩阵、审计日志专项及typecheck；未重复原147项无关完整suite、SQL并发全矩阵、Web构建/浏览器截图。原有T09完整与独立147/147证据仍保留，不将它们声称为本次新执行。

原/API最终ready、database connected/schemaVersion0004、原/login200（t09-fix-original-status.json）。.env、Ego31、真人授权及通知未改；历史迁移未改；T03真人验收继续另列未完成。一次性容器及自有救援fixture移除、隔离库清理，工具临时日志留在忽略目录供复核。

本机macOS/Docker Desktop和Linux容器实测，不代表其它Engine版本对空options的同一错误文案或跨平台全矩阵；应用校验另已实测，不靠Engine偶然默认来满足合同。仅本地提交、不push/关工单，由TL另排复核。
