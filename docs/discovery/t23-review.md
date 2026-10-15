# T23 独立审查：目标恢复、闭合失败与旧会话失效

## 范围与结论

2026-10-15，同一独立审查者依次完成 Standards / Spec 双轴审查。固定范围 `59f0a03ea8651edfceb732c36b42b7c01dde13c9..6c3c9f761c2bef20cc1a796d5cfd6d77b3618660`，读取 Gitea #24、父规格 #1 的恢复故事、备份恢复/维护/CLI/会话合同、实施计划及验收记录，并读取全部23文件差异。相关依据包括 ADR0019、0021、0026、0028。

| 轴 | 结论 |
| --- | --- |
| Standards | 0项发现；本次范围遵守既有宿主 CLI、强审计、迁移与测试隔离边界。 |
| Spec | 1项 P3：宿主包装器将下一选项误当参数值，未满足缺值在 Docker 前拒绝的合同。 |

恢复核心安全路径及本次实际故障验证未发现额外问题。建议修复下述 F1 后定向复核，再按 #24 整体验收；本报告不关闭工单。T03 真实组织飞书人工验收仍单列 pending。

## F1 / P3：缺失 SHA 或归档值后接选项，仍调用 Docker

**位置：** `templux:11–15` 消费待取值参数；`templux:28` 只判字符串非空，未识别值实际为下一选项。

最小触发命令：

```sh
./templux restore --mode original --target current --archive /private/selected.dump --confirm --overwrite --sha256 --json
./templux restore --mode original --target current --sha256 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --confirm --overwrite --archive --json
```

独立执行使用自有 PATH 中的假 Docker：只记录是否被调用并退出97，不读取参数、不调用真实 Docker。两例均 `dockerCalled:true`、exit97、stdout/stderr为空。`--json` 虽被扫描识别，随后仍被存入 SHA/archive，提前校验因此通过。EOF 缺值对照 `... --json --sha256` 则 exit1、Docker未调用，stdout为单个 `ok:false` JSON。证据：`test-results/t23-review/wrapper-missing-values.json`、`wrapper-missing-sha.json` 与 `fake-bin/docker`。

**影响：** 明确缺值输入仍进入镜像探针/构建流程；Docker不可用时无法得到承诺的提前 JSON 错误。容器内严格校验仍拒绝该输入，未发现数据库访问、恢复或权限绕过；这是 CLI 合同缺陷，非数据破坏漏洞。

**建议：** 等待参数值时拒绝下一选项，并保持独立扫描 `--json` 的错误输出能力；SHA还可在宿主提前校验64位十六进制。增加 archive/SHA 后接 `--json`、其他选项及 EOF 的对照，断言未调用 Docker、退出非零且 JSON 模式只有一个错误对象。

## 源码、结构与协议核对

- 模式/目标显式指定，连接 URL 仅从命名环境变量读取；目标使用真实 cluster system identifier 与 DB OID，独立模式拒绝同库别名，身份不可读则拒绝。归档权限、属主、symlink、SHA、完整解码、精确迁移历史及管理库救援连接均在破坏前检查。
- 既有目标属主不需要 CREATEDB/SUPERUSER，不自动建库或切换目标。ALLOW_CONNECTIONS 禁入后清理其他连接，恢复使用独立已连接会话和 psql 单事务；最终精确历史、写屏障、人员/Agent 会话及 OAuth/link 证明清理、offline/gate递增、runId强审计在同一事务。确认提交并核验后才重允连接，仍须显式 resume。
- original 持久 restore-block 阻止普通 resume；independent 不停止 current。提交未知不自动重试恢复，重允失败有界重新禁入，无法确认时保持 unknown，不将异常伪称已闭合。SQL、Docker、文件不能原子提交的限制及显式人工救援步骤有对应合同。
- `hasUserObjects` 改查公开 `pg_user_mappings` 的存在，不读取映射敏感选项；T22其他非空检测保持。迁移目录测试新增断连等待以确认客户端退出，未删除非空/备份保护断言。无新迁移或历史文件改写。
- 图查询按 search → trace → snippet，最终对23差异路径及4份 ADR 检查覆盖，结果 metadata_match；Tier2/best_effort 不能证明完整调用关系。恢复主流程、进程协议、包装器、SQL及文本配置直接读取补足，未将索引命中当作正确性证明。

Context7 查询 PostgreSQL18 官方资料核对：[`ALTER DATABASE` 连接限制](https://www.postgresql.org/docs/18/sql-alterdatabase.html)、[psql 单事务与 ON_ERROR_STOP](https://www.postgresql.org/docs/18/app-psql.html)、[pg_restore 可信归档执行边界](https://www.postgresql.org/docs/18/app-pgrestore.html)、[公开 pg_user_mappings 视图](https://www.postgresql.org/docs/18/view-pg-user-mappings.html)。归档为可信 SQL，不是执行沙箱；单库恢复不等于集群角色/插件依赖恢复。

## 独立执行证据

证据根目录为 ignored `test-results/t23-review/`。全部恢复、停服、SQL和归档只操作自有项目 `t23-review-unit`、`t23-review-proof`、`t23-review-independent`；后两入口端口31343/31344。未使用原部署数据库。

### 最终专项、类型与镜像一致性

```sh
docker run --rm --network t23-review-unit_default \
  -e TEST_AUTH_DATABASE_URL=postgresql://templux_test:isolated-test-only@database:5432/templux_auth_test \
  -e TEST_RESTORE_DATABASE_URL=postgresql://templux_test:isolated-test-only@restore-db:5432/restore_review \
  t23-final-checks node --test --test-concurrency=1 \
  tests/restore.test.mjs tests/restore-failures.test.mjs \
  tests/backup.test.mjs tests/backup-faults.test.mjs \
  tests/migration-objects.test.mjs tests/maintenance.test.mjs tests/maintenance-http.test.mjs
docker run --rm t23-final-checks npm run typecheck
```

- 最终 **69/69**，fail/cancel/skip均0，20.37秒；API/Web typecheck退出0。`targeted.log`、`typecheck.log`。这些URL仅为自有测试库，无生产回退。
- 包含9项真实 SQL 故障矩阵：同库别名、归档/身份拒绝、NOCREATEDB/NOSUPERUSER属主成功与审计失败、禁用guard回滚等。真实 wire proxy 分别在禁连接、COMMIT、重允连接命令已送达后丢 ACK，再独立查询目标关闭状态；没有把提交后包装抛错冒充物理协议故障。
- `integrity.json`：主机/checks 14源文件（9 API TS、wrapper、4测试）逐一匹配；9份编译 JS 在 checks、标准 management、标准 migration 三镜像匹配。实际恢复使用最终标准产品镜像，无覆源假装新产品包。PG工具实际18.6。
- checks image `sha256:d21b638400f26bc6e84bde8827d336895a8d0720b5bb7be1647cf89142a373a1`；management `sha256:56d8b3312d238cc3c548a551aac08aa5fc2f9e68906d5588d8e2152e642bceee`；migration `sha256:742a196c59f49d1c24b531be2e60e5434e6963893fcf173a00fb7963a632dfa0`。`runtime-images.json` 对照实际运行镜像。

### 实际 Compose 恢复与身份数据

复跑版本化 `restore-proof.py` / `restore-data-proof.py` 的 ignored 副本，仅调整自有项目、端口及证据路径，未改产品。驱动退出0；`compose-proof.log/.json` 八段结果：

1. 正常重启人员/Agent旧会话均200。
2. 错误SHA在预检拒绝，未halt，两旧会话仍200。
3. original成功为 completed-offline，入口503，撤销证明为真。
4. 显式resume后人员/Agent旧Cookie均401，新登录均200。
5. 强审计故障事务失败，connectionsClosed=true，入口503，restore-block使普通resume拒绝。
6. 显式宿主管理库救援后旧401、新200，未自动重试恢复。
7. independent恢复期间current仍200。
8. 显式接入独立库后旧401、新200，人员/Agent责任归属保持。

`data-consistency.json` 只读核对两库人员/Agent ID、名称、状态、类型、责任人、授权版本、user角色、两份启用密码凭据计数及一次恢复审计一致；未输出密码哈希或令牌。

### 额外 prepared transaction 边界

自有 PG 显式 `max_prepared_transactions=4`，创建真实 `PREPARE TRANSACTION` 后调用独立恢复。`prepared-preflight.log`：预检拒绝、未调用Compose、连接仍允许、目标未变；prepared事务仍存在且未提交行不可见。随后明确 ROLLBACK PREPARED、删除自有目标与临时归档。这补足开发未配置非空prepared事务的案例，不代表所有连接/DDL竞争均已穷尽。

## 开发证据与未重复范围

核对开发真实TTY确认/取消、最终哈希、恢复与身份数据证据。开发完整 **332/332** 是最后两处CLI人类输出/缺值JSON修正之前的历史点，不能称最终全套；本轮独立最终69及额外边界如上。未机械重跑332 UI、浏览器、无关构建或平台矩阵。版本化wire/SQL测试、实际Compose身份验收与宿主假Docker参数测试分别陈述，不能相互替代。

本轮没有浏览器操作；未验证所有平台ABI/TLS/跨PG版本/任意插件，未实际等待15分钟或打满512MiB上限。额外对象保留、可信归档及宿主DB管理权限前提仍适用。并发宿主恶意DDL和全部prepared事务竞态未作穷尽保证。T03真实人工链路保持待办。

## 清理与交付

`cleanup.log`、`cleanup-final.json`：三个自有项目容器/网络/卷已移除，两个private目录的归档、manifest、HMAC key和凭据已删除；测试PG为自有临时存储，未留新DB或角色。公开证据秘密扫描无命中（`secret-scan.json`），无自有浏览器待清理。

只读原 `/api/status` 仍 ready/connected/schema **0004**（`original-status.json`）。原部署、.env、presentation、Ego31、真人及飞书未变更；仅新增本报告并本地提交，无push/关票。

## F1 定向复核附录：宿主缺值与 JSON（2026-10-15）

固定修复范围 `9ae6e64dd5f6b65cac31b8181d405a9409ad032b..d958b0ecc3cc4b2f1804eb4289e1bd3bf84df5a6`。保留上文初审历史，读取修复验收、补充合同及全部4文件差异，同一审查者依次完成双轴。

### Standards / Spec 结论

- **Standards：0项新增发现。** 唯一产品差异为 `templux` 宿主解析；测试 Python 仅开发回归依赖，正常包装器仍是 Shell/Docker。`apps/api`、`database`、`Dockerfile` 相对初审提交无差异。
- **Spec：F1/P3关闭，0项新增发现。** 原 SHA/archive 后接 `--json`、EOF、空值均在 Docker 前 exit1，JSON模式单个 `ok:false`、stderr空；人工模式stdout空、错误写stderr。JSON独立前扫，失败标记持续，随后补齐同名参数也不覆盖失败。四个取值选项的等号语法明确拒绝，与容器语法和补充合同一致。
- 结合初审恢复事务、闭合故障、数据/旧会话实际验收证据，**建议 #24 按本次范围验收**。不替代 T03 真实组织人工链路验收，不关闭工单。

### 独立执行与证据

证据根 `test-results/t23-wrapper-review/`：

1. `python3 tests/restore-wrapper.test.py`：**38/38通过**，0.909秒，`host.log`。四参数空/EOF/下一JSON或其他flag/下一取值选项/空等号/完整参数后追加空等号均拒绝且假Docker调用0；合法含空格绝对路径、绝对路径中的前导`--`文件名、命名环境键、菜单、顶层help保持原参数转交。合法转交使用假Docker，不声称实际执行恢复或新增help功能。
2. 补充 **8项通过**，`additional.json`：每个取值选项先缺值、后补完整同名值仍拒绝；每个非空 `--option=value` 也拒绝。均exit1、单错误JSON、Docker调用0。原始两个F1例包含于版本化38项。
3. 最终脚本只读挂到旧checks实际工作目录后运行：

   ```sh
   docker run --rm \
     -v /Users/jkoo/git/Templux/templux:/opt/templux/templux:ro \
     -v /Users/jkoo/git/Templux/tests/restore.test.mjs:/opt/templux/tests/restore.test.mjs:ro \
     t23-final-checks node --test \
     --test-name-pattern='restore requires explicit|restore command refuses|wrapper incomplete' \
     tests/restore.test.mjs
   ```

   **3/3通过，fail/skip/cancel0**，`container.log`。仅纯参数分支，未连接DB或执行恢复。
4. `integrity.json`：主机/实际只读挂载 `templux` SHA256均 `671bf1af1d83d1038eca2797032537d27fc7cc8bfd64c804bbefd0e74eaa26c4`；测试脚本也逐字节哈希匹配。checks仍是初审镜像 `sha256:d21b638400f26bc6e84bde8827d336895a8d0720b5bb7be1647cf89142a373a1`，**未重建，镜像内原脚本不代表最终修复**。首次误挂 `/app` 的3项结果不计入最终证据；哈希断言发现路径错误后改为实际 `/opt/templux`，重新核对并复跑通过，旧日志保留 `container-wrong-mount.log`。
5. `/bin/sh -n templux`、固定范围 `git diff --check`、`git diff --exit-code BASE..FIX -- apps/api database Dockerfile` 均exit0。无TS变化，类型检查沿初审通过证据，未声称本轮重跑类型/69 SQL/wire/332 UI/Compose恢复或构建。

Shell解析和文本合同全量直接读取；6个证据路径 coverage 为 metadata_match，Tier2/best_effort不证明完整性。本轮没有需要追踪的新结构符号、库或协议API变化，无需额外框架文档查询。

### 清理与限制

假Docker每案由 TemporaryDirectory 清理；额外导入生成的自有 `tests/__pycache__` 已删除，一次性检查容器均 `--rm` 退出。无数据库/卷/归档/密钥/凭据创建，无浏览器。原0004部署、.env、presentation、Ego31、真人和飞书保持不动，仅追加本报告、本地提交，无push/关票。

本轮宿主实际为macOS `/bin/sh`，不证明Linux/WSL全矩阵；合法参数验证的是转交而非恢复重演。初审可信归档、PG18/ABI/TLS、规模与并发边界继续适用。
