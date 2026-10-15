# T23 明确恢复目标与旧会话失效验收

基线 `59f0a03ea8651edfceb732c36b42b7c01dde13c9`；保留此前75个本地提交。范围为Gitea Swython/Templux #24及父#1故事58–60；T03真人飞书人工验收继续pending，不被本票替代。

## 设计与实现

TL在Team消息批准后按[计划](../superpowers/plans/2026-10-15-t23-restore.md)实施；最终操作、兼容限制和救援合同见[数据库恢复](../specs/backup-and-recovery.md#t23明确目标恢复)。

- 菜单26/一行restore共用容器校验；模式、目标、归档、独立核对SHA、confirm及overwrite明确。包装器缺项Docker前失败，目标URI只经环境配置键，不在argv。
- 完整custom归档先私有复制/hash/解码/精确迁移COPY历史预检。实际system_identifier+database OID拒同库别名，预连接并验证不同管理库救援；无CREATEDB属主可用。
- 原库复用T21写屏障/强审计/停业务，持久外部restore-block不随旧SQL回放，普通resume无法绕过；独立目标不碰当前服务。ALLOW_CONNECTIONS=false之后才终止其它连接并执行事务。
- 一个psql事务恢复/结构验证/清空人员及Agent旧session、OAuth及关联证明/offline和gate版本/强审计runId。确认提交与标准校验后才允许数据库连接；不会自动resume/部署/切换。
- ALTER禁连接、COMMIT或重允连接ACK丢失均不假成功；有界重新禁连接仅作安全清理，未知明确报告。失败原库保留外部block，人工救援须独占运维和核验。
- 无新SQL迁移、未改历史文件。复用T22对象清单前置安全备份，含类型/访问方法；user mapping只查公开脱敏视图，避免普通角色读原始catalog受限。T22目录专项清理等待连接完全退出后再DROP，避免FORCE误杀刚关闭客户端的测试竞态。

## 实际验证与复跑

所有数据库/停服/恢复均为自有 `t23-proof`、`t23-independent`、`t23-suite-services` 项目和 `t23-restore-db`，不是原部署。宿主只运行Docker/Shell/Python，PG与Node工具均在容器。

### RED→GREEN

`test-results/t23/red-input.log`确认旧命令不存在；`red-block.log`、`red-history.log`验证阻断和历史合同；`red-type-safety-backup.log`确认仅enum目标原先漏安全备份，改为共享完整清单后green；`failures-current.log`暴露普通角色原始pg_user_mapping读权限，公开视图后`failures-owner-green.log`通过。`red-fence-ack.log`实际ALTER false已提交但ACK丢失时原报告false，`green-fence-ack.log`九项故障/权限/事务场景全通过；`red-format.log`→`green-format.log`为匹配hash但非custom头的明确拒绝。

### 真实Compose、SQL、HTTP

按`test-results/t23/compose/compose.yaml`独立fixture构建正式management镜像并运行：

```sh
python3 tests/scenarios/restore-proof.py
python3 tests/scenarios/restore-data-proof.py
```

复跑须先清理该任务自有项目/凭据文件/库，命令拒覆盖既有0600凭据。场景定义版本化；独立compose fixture及完整日志在本地ignored evidence目录，不需真实部署配置或认证后门。

最终`compose-proof-final.log`/`compose-proof.json`八段：人员及Agent正常重启仍200；坏hash原库预检后仍200/不halt；original成功后入口503；显式resume旧401、新200；原库强审计故障回滚、连接关闭、入口503、普通resume拒block；宿主核验/清理旧证明/审计救援后旧401新200；independent恢复不影响当前200；未来明确接入独立部署后旧401新200。

`data-consistency.json`两库逐字段相同：人员/Agent各1、责任人关联、auth_version、两个user角色、两份enabled密码资格、每库一条database_restored强审计。没有读取/输出密码hash、token或真实照片/人员数据。

`menu-tty.log`是真实Docker TTY菜单26，六个提示依次填写并明确取消，退出1，无数据库/业务动作；完整参数一行成功由上述实际restore覆盖。`restore.test.mjs`另证明Docker缺失时包装器仍在Docker前拒缺项。

### 故障/权限/生命周期矩阵

`tests/restore-failures.test.mjs`使用真实PG18.6与仅测试进程内wire代理，转发真实COMMIT/ALTER后丢ACK，无生产故障开关。覆盖：同库URI别名；hash/链接/权限；真实损坏和旧版本归档；身份函数EXECUTE缺失；NOCREATEDB/NOSUPERUSER属主成功及审计失败后同角色管理库救援；缺guard事务回滚/no history；禁连接/COMMIT/重允连接回执丢失。失败后外部管理查询datallowconn=false，提交未知不重试，已提交数据的旧会话仍空/SQL offline。实现还预检预备事务并fail closed；未另配置max_prepared_transactions制造非空预备事务。T21在途写锁/并发授权边界由完整回归覆盖，恢复连接终止/拒新连接在本矩阵贯通。

最终完整回归、类型检查及镜像hash结果见本记录末的最终点。完整332项点之后仅修正人工“恢复结果”标签及缺值时--json检测；最终源码另跑恢复/备份/目录/维护专项和真实Compose（包含人工成功结果解析），不把前序全套冒充这两项文案/包装器差异之后的全套。测试代码仅工具测试镜像/自有外部协议服务，未增加生产认证fixture。

## 过程中的非最终结果

保留而不冒充成功：`full-environment-rejected.log`为错误测试库后缀/隔离环境检查；`full-stale-image-stopped.log`为发现旧镜像后主动停止；`full-shared-db-mismatch.log`为Web对应错误DB/Origin及静态测试缺配置，随后建立独立suite API/Web；`full-fixture-close-race.log`328/330，一处FORCE误杀刚关闭PG连接导致子测试及父测试失败，目录专项单跑28/28通过并改为等服务端无连接再非FORCE清理；`full-before-fence-ack.log`330/330是最后两项边界补充前源码，只作前序回归，不当最终源码结果。

## 平台与范围限制

macOS Docker Desktop，Linux容器Node24.21.0/PostgreSQL18.6。绑定挂载容器数值0:0，专属测试显式HOST_UID/GID=0；宿主独立核实私有目录0700/归档凭据0600，不宣称Linux宿主/WSL2全矩阵。无真实组织飞书人工操作、原库迁移或实际用户授权。只支持PG18目标/精确当前schema/完整COPY custom，解码SQL512MiB及15分钟工具超时，未搭其它主版本/插件组合；不是不可信SQL沙箱或无条件灾备切换。当前身份不可读取时独立模式也保守拒绝；归档外对象不自动擦除。完全失去DB/管理连接或宿主权限时需人工救援，不承诺自动恢复。无新UI，未重复截图/浏览器控件矩阵；真实密码HTTP/维护入口和正常Web流程已贯通。

## 最终验证点

- 核心完整容器回归：`npm test` **332/332 PASS、0fail/skip/cancel**，`full-final.log`，83.72s。此点已含禁连接ACK未知和非custom头回归；之后仅改人工恢复标签、包装器缺值JSON检测及对应测试输入，范围明确如上。
- **最终源码69/69 PASS、0fail/skip/cancel**：`node --test --test-concurrency=1 tests/restore.test.mjs tests/restore-failures.test.mjs tests/backup.test.mjs tests/backup-faults.test.mjs tests/migration-objects.test.mjs tests/maintenance.test.mjs tests/maintenance-http.test.mjs`，`targeted-final.log`，20.53s；使用自有真实SQL/PG工具，包含9项权限/故障矩阵、T22目录、备份和维护屏障。
- 最终`npm run typecheck` API/Web均exit0；`typecheck-final.log`。三次正式root Dockerfile target checks/management/migration build exit0，日志build-final-checks/build-standard-management-final/build-standard-migration-final。
- 最终真实Compose八段、人工成功输出`恢复结果`解析、数据一致性检查均exit0，见compose-proof-final.log、compose-proof.json、data-consistency.json/log。所有最终API/entry运行容器与标准management镜像匹配：compose-runtime-images.json。
- final-source-compiled-hashes.log确认9份最终API TS源码及templux/4份测试与checks镜像完全匹配；9份编译JS在checks、标准management、标准migration完全相同。镜像：checks `sha256:d21b638400f26bc6e84bde8827d336895a8d0720b5bb7be1647cf89142a373a1`；management `sha256:56d8b3312d238cc3c548a551aac08aa5fc2f9e68906d5588d8e2152e642bceee`；migration `sha256:742a196c59f49d1c24b531be2e60e5434e6963893fcf173a00fb7963a632dfa0`。
- 工具版本：pg_restore/psql18.6、Node24.21.0，tool-versions.log。Postgres技能在SQL/restore前加载；Context7官方pg_restore/psql/catalog说明用于设计。graph全量索引与Tier2覆盖检查；0009 SQL解析缺口已直接完整读取，其余18个相关路径无已记录覆盖问题，仅作best effort信号。
- host-private-permissions.json实际宿主核对目录0700、dump/manifest/归属密钥/凭据0600；普通日志检查无三种隔离连接密码字面值。无任何真实组织凭据回显。

清理完成：`cleanup.json`记录所有自有项目/容器、维护卷、网络及私有dump/manifest/HMAC根密钥/凭据目录均已删除；标准证明镜像保留供复核，无运行中的t23容器。只读Docker列表中原templux入口前的三个应用/DB容器仍healthy；未执行原库SQL、未迁移/重启/停止原部署，未改.env、现用presentation或真人权限。复跑前按同一fixture先建立`compose/private/backups`和`compose/private/credentials`并chmod0700，数据库工具仍仅在容器。
