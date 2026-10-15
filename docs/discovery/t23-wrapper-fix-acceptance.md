# T23 F1 修复：缺值前检与JSON

基线 `9ae6e64dd5f6b65cac31b8181d405a9409ad032b`。读取独立初审和wrapper-missing-values.json后，先自有PATH stub复现，再最小修改宿主templux；初审docs/discovery/t23-review.md保持逐字未变。

## 定位及修复

待取值状态原先直接消费下一token，把`--json`存入archive/SHA后视为非空；EOF因为仍有EXPECT而正确拒绝。单循环即使遇到--json，也不能修复错误的值消费。

现在独立前扫JSON格式需求，取值前拒空/下一选项，失败状态持续保留；下一选项仍按选项处理，不存进前一项的值。四个相关`--option=...`明确不支持，空等号即使追加在完整参数后也提前拒绝，与容器语法一致。报错提供前导--文件名的绝对路径方式。未改TS、恢复SQL/进程、数据库、Dockerfile或任何迁移。

## RED→GREEN

证据：ignored `test-results/t23-wrapper-fix/`。

- `reproduction-red.json`：审查两个原例均假Docker被调用、exit97、stdout/stderr空；EOF对照exit1、0调用、单错误JSON。
- 首次版本化宿主回归 `python3 tests/restore-wrapper.test.py`：37项中12失败（red.log），包括错误通过及完整参数后空等号。
- 最终同命令：**38/38 PASS**（green-final.log），0.965s；32个四选项矩阵（空/EOF/后接JSON/JSON前后的其它flag/另取值选项/等号空/额外等号空）加人工缺值及前导--名称共34个拒绝用例，全部0次Docker。4个正常转交用例覆盖完整空格路径、环境目标键不回显值、无参数菜单、顶层help原转交。
- `reproduction-green.json`：两个原例和EOF均exit1、0次Docker、stdout恰一个ok:false JSON、stderr空；人工非JSON仍stderr错误、stdout空。
- `container-parser.log`：既有标准checks镜像只读挂载最终templux及现有restore.test.mjs，运行 `node --test --test-name-pattern='restore requires explicit|restore command refuses|wrapper incomplete' tests/restore.test.mjs`，**3/3 PASS、0fail/skip/cancel**；只验证参数分支，不连DB/执行恢复。
- `/bin/sh -n templux`、`git diff --check` exit0。`git diff --exit-code BASE -- apps/api database Dockerfile` exit0。无TS更改，类型检查沿用初审API/Web通过点，不冒称本轮重跑；未重建镜像/重跑69 SQL/wire、332全套或Compose恢复。

## 源码与边界

integrity.json记录最终wrapper与容器只读挂载脚本SHA256相同、版本化测试SHA256、旧checks镜像ID和初审历史相同证明。镜像内原wrapper不是最终源码，挂载路径已明确，未声称产生新镜像。graph full索引，search→trace→snippet核对容器restoreCommand仍由manage调用，五个相关路径覆盖无已记录缺口；Tier2 best effort，不当完整性证明。纯Shell业务解析，无库/SDK/API变更，未需额外Context7协议查询。

宿主Python只用于开发回归，假Docker完全隔离，临时目录由TemporaryDirectory逐案清理，未创建凭据/备份/数据库/卷。实际仅一次性容器执行3项纯解析后自动删除；原0004/.env/presentation/Ego31/真人/飞书不动。不证明Linux宿主/WSL矩阵；POSIX sh语法检查及当前macOS宿主实测。无新增认证入口、推送或工单关闭。
