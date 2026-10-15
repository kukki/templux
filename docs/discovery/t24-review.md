# T24 独立审查：升级编排、备份落点与失败阻断

## 范围与结论

2026-10-15；固定范围 `1306546e74bcef6a989fc2d1f00191715d056000..365a2184c6b5d88762769008e8d8d8573b32e91c`。读取 Gitea #25/#1 故事50、55–57、备份恢复与管理CLI合同、T24计划/验收及全部9文件差异；参考 ADR0010、0018、0019、0026、0030。按 Team 约定，同一独立审查者依次执行两个轴。

| 审查轴 | 结论 |
| --- | --- |
| Standards | **0项发现**。产品改动限于管理子进程环境和Compose宿主路径投影，未引入第二套迁移/恢复系统或宿主运行时依赖。 |
| Spec | **0项发现**。实际升级前备份、失败阻断、外部参考、持久会话及维护闭合的本次证据支持 #25 按约定范围验收。 |

本报告不关闭工单。T03真实组织飞书人工验收仍 pending；本票密码/SQL结果不能替代该验收。

## Standards：源码及边界核对

- `compose.yaml:166` 将宿主 `TEMPLUX_BACKUP_DIR` 原值保存为内部 `TEMPLUX_BACKUP_BIND_DIR`，默认 `./backups`；工具自身仍使用 `/opt/templux/backups`。`apps/api/src/manage.ts:29–45` 仅在调用子Compose时复制环境并恢复该插值变量，不修改父进程环境、数据库目标或其它配置。
- 绝对路径、相对路径、空格均保持单一字符串；子Compose沿用同一绝对 project-directory，避免把容器 `/opt` 路径交给宿主daemon作bind源。直接自建编排容器须提供宿主投影的前提已明确。
- start原链路仍为配置校验→构建→DB启动→一次性migration→应用启动，后续步骤逐次await；Web不迁移。既有运行进程不会因本次失败自动停止，合同已明确，失败场景从停止状态验证的是本次后续应用up被阻断。
- 复核迁移历史/checksum验证、migration→backup→根锁顺序及finally释放；每项SQL与该项history同事务，整批非原子。后置校验失败、未知提交、遗留锁或历史不一致须人工核验，不自动重试、改history或restore。
- 新SQL种子仅在隔离工具容器直接执行，限定项目身份及两个测试库名；失败SQL副本只挂测试migrate服务。生产迁移历史相对基线无差异；无新增业务API、测试登录路由、云API或自动恢复。
- codebase-memory Tier2：index→search compose→双向trace→完整snippet；直接读取产品、驱动及合同。共22个实际证据路径 coverage 均 metadata_match，无已记录路径缺口；索引为best_effort，不作为全部调用或SQL语义完备证明。

已加载Postgres技能及advisory锁参考。Context7核对 [Compose插值优先级与路径规则](https://github.com/docker/compose/blob/main/docs/reference/compose.md)、[pg_dump一致快照不自动阻止并发写](https://www.postgresql.org/docs/18/app-pgdump.html)、[当前事务COMMIT边界](https://www.postgresql.org/docs/18/sql-commit.html)、[会话advisory锁释放](https://www.postgresql.org/docs/18/functions-admin.html)。需要停写时仍按T21显式协调；dump成功不是停写证明。

## Spec：独立实际执行

证据根为 ignored `test-results/t24-review/`。仅自有项目 **t24-review-proof**（入口31345）与 **t24-review-unit**；使用最终management/checks及标准目标构建路径，没有操作原0004项目。

### 专项与类型

```sh
docker run --rm --entrypoint node -v /Users/jkoo/git/Templux:/workspace:ro \
  -v /Users/jkoo/git/Templux/tests/scenarios/upgrade-bind.mjs:/opt/templux/tests/scenarios/upgrade-bind.mjs:ro \
  t24-management --test tests/scenarios/upgrade-bind.mjs
docker run --rm --network t24-review-unit_default \
  -e TEST_AUTH_DATABASE_URL=postgresql://templux_test:isolated-test-only@database:5432/templux_auth_test \
  t24-checks node --test --test-concurrency=1 tests/backup.test.mjs tests/backup-faults.test.mjs
docker run --rm t24-checks node --test \
  --test-name-pattern='restore requires explicit|restore command refuses|wrapper incomplete' tests/restore.test.mjs
docker run --rm t24-checks npm run typecheck
```

- bind **3/3**；backup **8/8**（含真实受限UID子进程内层3项）；restore参数 **3/3**，均fail/skip/cancel0。`bind.log`、`backup.log`、`restore-parser.log`。API/Web typecheck退出0，`typecheck.log`。
- 额外实际Compose config对照仅输出备份相关投影/source，未输出完整配置或.env：unset→`./backups`，绝对/相对带空格路径均正确；management与migrate source一致。`config-paths.json`。config结果另有下述真实产物/恢复验证，未以渲染代替落盘。

### 标准start真实升级与故障矩阵

运行 `python3 test-results/t24-review/upgrade-proof.py`（版本化驱动副本，仅调整证据目录、自有Compose名称及端口；种子身份guard保持）。退出0，`proof.log` / `proof.json` 包含 **21个行为场景及1个completed标记**，不是22项Node测试。管理命令自身仍调用标准build/run/up流程。

| 场景 | 独立观察 |
| --- | --- |
| 0008→0010标准start | 两账号、两凭据、两历史会话、种子审计保持；指定宿主`approved backups`收到0600归档/manifest；人员/Agent旧会话均200。 |
| 迁移前归档scratch恢复 | 实际容器pg_restore后history为8，上述数据计数相同，证明备份在迁移前。 |
| 正常重启及重复start | 两旧会话仍200；无pending不新增归档。 |
| 不可写备份位置 | 非零、history8、无新成功归档，本次应用未启动。 |
| 0009测试SQL失败 | history8，失败项创建的探针表回滚，本次应用未启动。 |
| 0009提交/0010测试SQL失败 | history9，失败项探针表回滚；核验后显式重试标准发布到10。没有声称全批回滚。 |
| 0010提交但结构校验失败 | history10、缺gate列，仍非零且本次应用未启动。 |
| checksum不符/未知9999 | 各非零，无新备份及后续应用启动。 |
| 外部参考 | 缺confirm拒绝；显式记录0600、verified:false、参考值不回显、无dump；记录写失败保持history8且不启动。 |
| migration/backup锁竞争 | 真实独立会话持锁时各及时非零、history8；释放后迁移成功。 |
| offline/gate/restore-block | start可启动健康进程，但入口503、gate不变、block保留，显式resume仍拒绝block。 |
| 第二个PG外部目标 | 外部8→10、原Compose库history不变；外部人员/Agent旧会话200，无默认目标回退。 |
| 保留 | 同来源成功automatic留5，manual及外部参考保持；失败未顶替成功件。 |
| 真空库/无pending | 即使备份位置不可用仍正常到10/不重备份。 |
| 正常密码HTTP | 正式POST密码认证后人员/Agent新会话均200，历史会话仍200。 |

另以 `PYTHONDONTWRITEBYTECODE=1 python3 test-results/t24-review/relative-proof.py` 完成两项针对性对照（退出0）：`TEMPLUX_BACKUP_DIR=./private/approved backups` 下分别执行标准start与直接migrate；两者都在同一指定宿主根生成0600归档，再各自真实scratch恢复出history8及迁移前数据，目标均为history10。start旧会话200，直接migrate不启动应用。`relative-proof.log/.json`。

`account-fields.json` 另核对真实目标人员/Agent名称、active状态、稳定ID、责任人归属、authVersion1及两份user角色，断言通过。私有随机密码/Cookie未写入公开证据。

## 最终源码、编译与开发证据区分

- `integrity.json` 独立核对 **7 TS源+3fixture/driver** 与checks逐一SHA一致；**7编译JS** 在checks、management、migration、api一致，并与开发交付对应。proof实际调用产品编译包，未把产品源码覆盖到旧镜像伪装最终包。
- management保持 `sha256:777b255a44f480bc59a9265f2c77310a5661ba2d9017a7bbf861b7e22c36d24a`；checks保持 `sha256:0bed835e87aed2360904cc361426f718c38e806c39f2b72111eba94b3daf8278`。标准start自身执行build，独立演练后的migration为 `sha256:9d4b8005e2f87f51c95aa518a05ecbb046019372181e0567bd309cd11a1f6a3c`，api为 `sha256:c3ce453401d993400e8a1b5a52064b5eaacfe97c3dc817083aeafa5bcd4fa466`。首次要求整个镜像ID等于开发记录的断言因此失败；随后分别记录ID变化并再次核对编译一致，最终通过，不将ID差异误报产品失败。运行容器ID另存 `runtime-images.json`。
- Web复用既有`t21-web`，ID `sha256:32f255498ddb544e56ae6d07dab97d30a9d7f0ba8f3954bd90d66dd9f3a0c49d`，未声称新构建。Web源码自T21无差异；共享runtime-log已有T22增加backup白名单的单行差异不在旧Web镜像，本票未改该文件、Web不执行备份CLI。本轮验证HTTP/编排，不作视觉验收。
- 开发缺maintenance-copy的首次夹具失败与其完整成功记录已区分；本轮复制完整非秘密config后首轮成功。开发RED/GREEN及21场景仅作交付背景，上述结果均为独立重新执行。
- 固定范围历史SQL diff为空、`git diff --check`、`sh -n templux`均退出0。无理由机械重复332 UI、69恢复wire、全DDL或截图矩阵。

## 局限、清理与验收建议

本机macOS Docker Desktop、Linux工具容器与PG18.6；第二个自有PG是外部连接目标实证，不代表所有云权限/TLS或Linux/WSL宿主矩阵。显式UID0/GID0为该本机bind映射测试选择，不是Linux volume权限承诺。旧会话由受限SQL夹具建立，并另验证正常密码HTTP；未新增生产认证fixture。

本票没有新增迁移COMMIT wire断线实测，不能将T23恢复ACK实验移作本票证据。未知提交须人工检查；一致快照不阻止并发写，维护兼容性、停写窗口和外部DDL/运维串行责任仍由操作者承担。测试用失败迁移只存在自有私有目录，生产SQL未改。未声称任意规模、跨版本插件ABI或所有异常时序均已覆盖。

`cleanup-proof.log`、`cleanup-unit.log`、`cleanup-final.json` 确认两个自有项目容器/网络/卷及private目录（归档、归属key、随机密码/Cookie、失败SQL）全部删除。公开证据对当前自有合成秘密扫描无命中，`secret-scan.json`；无浏览器。只读原状态仍ready/connected/schema **0004**，`original-status.json`。原.env、presentation、部署、Ego31、真人和飞书未修改。

建议 #25 按以上范围验收；保留T03人工与平台限制。仅本地新增本报告，不改实现、不push、不关票。
