# T22 独立审查：数据库备份、保留与迁移前保护

## 范围与结论

固定范围 `148f39ba83a07c46fbab89193c6b525c33312ee2..c7048d27326ee04ddc9bc2ff0227a683c679dc61`，审查时 HEAD 为后者，初始工作树干净。同一独立审查者依次执行 Standards/Spec，不新增成员。

读取 #23、父 #1 故事55–57、备份规范/计划/验收、ADR0010/0018/0019及既有宿主管理约定，审查全部22文件差异。SQL/restore前应用Postgres技能；code-review与codebase-memory流程按Team权限执行。

| 轴 | 结论 |
| --- | --- |
| Standards | **0项发现**。未发现本范围违反已记录仓库规范或需独立报告的基线代码异味。 |
| Spec | **1项 F1/P2**：非空库只含public enum时误判为空库，绕过迁移前备份。建议修复并定向复核后再验收#23。 |

本报告不修改实现，不将后续恢复CLI、恢复后会话失效或真实组织飞书人工验收算作已完成。

## F1 / P2：已有public类型的数据库绕过备份保护

**定位：`apps/api/src/database.ts:99`**，`migrate`的existing查询及100–104行条件分支。

父规格要求“已有数据库且有待迁移项时默认先备份，失败中止；空库初始化或无迁移跳过”。实施计划同样要求先识别真实已有用户对象，备份完成前不创建/更改迁移表。

当前查询只识别指定relkind的关系、非public应用schema和public函数。独立存在的public enum位于pg_type，不满足这些条件，被当成空库。无迁移历史时便跳过beforeChange，直接创建历史表并应用迁移。

**最小实际复现（仅自有库）**：

1. 创建空数据库 `enum_only`，执行 `CREATE TYPE public.review_status AS ENUM ('draft','active')`；无迁移历史。
2. 使用最终标准Dockerfile target对应的 `t22-root-migration`，连接该库，配置 `TEMPLUX_BACKUP_DIR=/proc/backup-impossible` 后执行 `--json`。该路径不可能完成备份。
3. 实际退出0，stdout为 `{"ok":true,"schemaVersion":"0010","applied":10}`，stderr为空。之后历史表10行、原enum仍存在；没有调用自动备份。

证据：`test-results/t22-review/enum-setup.log`、`enum-migration.json`、`enum-migration.stderr`、`enum-after.log`。不是用模拟回调推测：运行了最终标准migration编译产物。既有类型未被删除；问题是**非空结构没有迁移前恢复依据，保护分支未执行**，不是本次已经观察到数据丢失。

建议：使空库判断覆盖用户定义类型等实际用户对象，避免以不完整的关系枚举代替“空库”；至少加入public enum/domain/独立composite类型的目录识别，并审查其它被遗漏的用户对象类别。新增真实坏备份路径回归：类型独存且pending必须非零、不得创建迁移元数据；真正空库仍跳过备份，普通已有0008与无pending对照不退化。不要通过收窄文档把已有非空库重定义为空库。

Context7核对[Postgres18 pg_type](https://www.postgresql.org/docs/18/catalog-pg-type.html)：enum/domain/独立composite均为独立用户类型。本轮实际复现为enum；domain/composite是建议的修复覆盖，不冒称已逐个实际复现。

## 其它源码检查

- 固定PG18.6工具只进入management/migration/checks，API/Web不增加宿主客户端依赖；标准migration target包含最终编译及工具。pg工具argv没有连接URL/密码，私有0600 PGPASSFILE转交密码并转义冒号/反斜线，最小子进程环境和原始stderr屏蔽保持；未知URL/TLS选项不静默丢弃。
- root/件目录0700，文件0600，属主严格核对，拒符号链接；随机exclusive件目录，不提供覆盖入口。custom归档头、非空、工具退出/诊断、list及完整解码、SHA/fsync后才发布成功manifest。标记发布后的失败明确未确认，不自动重试；不能把工具可读当作业务恢复成功。
- HMAC绑定根dev/inode、项目与来源，保留按可信automatic序号，不按墙钟；manual、外部参考、未知、损坏、改权限、复制根、缺key旧归属保守不删。签名是本地删除归属保护，不是恢复密钥或防宿主篡改证明。
- 锁顺序为迁移锁→数据库backup try锁→根exclusive锁；跨源同根仍被根锁排斥。保留失败通过BackupResultError区分backupSucceeded/retentionSucceeded，临时清理另有结果。未取得T21维护锁，pg_dump一致快照不自动停写或持续同步。
- 迁移在备份前不写历史表，F1以外常规已有结构路径通过beforeChange；明确外部参考只有确认并写入0600 unverified记录后才能替代重复dump，非失败自动fallback。start构建migrate target，迁移成功才启动应用。无历史SQL迁移改动。
- UID/GID覆盖成对严格校验在Docker前，默认id映射保持；没有静默root降级。init/凭据交付使用同一属主配置的影响明确记录，未将macOS数值映射推广到Linux。

结构按index/search→双向trace→snippet核对backup和migrate调用链。全部22差异路径及相关ADR检查覆盖；`.dockerignore`为not_tracked信号，已完整直读，其余metadata_match。图谱为best-effort，不作动态调用或完整安全性证明。

通过Context7 resolve→query核对[pg_dump18](https://www.postgresql.org/docs/18/app-pgdump.html)、[custom恢复](https://www.postgresql.org/docs/18/backup-dump.html)及[PGPASSFILE](https://www.postgresql.org/docs/18/libpq-pgpass.html)。源服务器支持9.2–18、不可向更老主版本保证恢复、全局角色/扩展/配置/密钥另行准备等限制有明确记录。

## 独立执行

仅自有Compose **t22-review**、隔离PG18.6库和专用备份根；本轮根本没有启动Web/API，实际备份不依赖它们。所有PG工具及SQL在容器内，无宿主PG客户端、无生产或原0004连接。

| 检查 | 实际结果与证据（`test-results/t22-review/`） |
| --- | --- |
| 最终包专项 | `t22-checks node --test --test-concurrency=1 tests/backup.test.mjs tests/backup-faults.test.mjs`，显式隔离TEST_AUTH_DATABASE_URL；**8/8**，fail/cancel/skip0，`targeted.log`。根测试还检查真实uid1001子进程3项结果。 |
| 直接非root故障 | 再以容器uid/gid1001直接运行backup-faults，**3/3**；权限改动旧件、key丢失/复制根/坏key、真实另一SQL会话锁冲突均通过；`unprivileged-faults.log`。 |
| 类型与工具 | API/Web typecheck退出0，`typecheck.log`；最终标准target实际pg_dump18.6，`pg-version.log`。 |
| 镜像对应 | 主机/checks的11源（含3测试）、checks/API/management/migration/标准root-migration的7编译文件逐一SHA匹配；`integrity.json`。使用最终镜像，没有宿主源码覆盖旧包。 |
| 真实备份→scratch | 2行含中文的合成PG数据，标准dump复制到没有HMAC/manifest的临时目录，真实pg_restore --exit-on-error到独立scratch后逐行相等；生产结果仍restored:false；`real-proof.log`。 |
| 默认保留 | 同一真实库manual+6次automatic成功，留下最新5份automatic、保留manual及无关文件、任务锁已清；同`real-proof.log`。 |
| 权限 | 容器根/件目录700、dump/manifest600；宿主独立stat核对501:20、目录700/文件600，`host-permissions.json`。本机容器0:0映射是显式测试选择，非默认降级；不外推其它平台。 |
| 迁移正常对照 | 空库+不可用备份路径仍初始化0008；普通已有0008+相同坏路径非零并保留历史0008/8行；合法自动备份后applied2到0010；无pending+坏路径applied0。`empty-to8.*`、`upgrade-blocked*`、`upgrade-success.*`、`no-pending.*`。 |
| 外部参考 | 独立0008库缺confirm非零；确认后applied2，受限记录600/verified:false，stdout/stderr不回显参考；`reference-{unconfirmed,success,proof}.*`。 |
| 包装入口校验 | PATH中自有Docker记录stub，未配对/空/前导零/溢出四组均退出1且未调用Docker；`uid-validation.json`。没有让原部署执行包装动作。 |

除已确认F1外没有其它独立失败。以上scratch仅验证标准归档与数据，不开放恢复库，不提前声称恢复CLI、旧会话撤销或生产切换。

## 开发证据核对（不混同独立执行）

- `test-results/t22/full-final-288.log`：最终产品源码对应288/288、0fail/cancel/skip，67.6秒；未机械重跑全部UI。标准target构建和最终11源/7编译hash映射已独立复核。
- 真实PTY菜单25、实际包装器backup/start、Web/API/entry停止后备份、非Compose外部Postgres备份记录已核对。本轮只启动自有DB，未重复完整start/真实密码登录矩阵。
- 开发scratch实证accounts5/audit40/sessions13/password_credentials5一致，标准归档脱离key恢复；原私有归档未输出内容或密钥。EROFS新件成功但retention=false、真实16KiB磁盘满无成功manifest/临时文件、Linux volume1001属主和macOS绑定501:20、默认6留5及公开证据无生成密码匹配日志均已核对。
- RED/失败准备尝试与最终结果分开，包括旧墙钟保留、新复制根归属、非法DB配置JSON、宿主bind映射、早期测试库命名/DEV、只读挂载笔误；不以失败尝试当最终通过。

## 清理及局限

自有t22-review容器、网络、数据卷及临时备份根已删除（含本轮dump/key/参考记录）；未创建浏览器、真人账号或凭据。保留ignored公开脚本和日志。开发原有700/600归档不修改。`cleanup.log`及`original-status.json`确认原服务仍ready/connected/schema **0004**；原.env、现用presentation、部署、Ego31、真人及飞书不动，无push/关票；提交仅本报告。

Standards0 / Spec1(P2)，建议先修F1再验收。未重复288、生产构建或全平台/外部TLS矩阵；未物理注入最后fsync后ACK丢失、等待15分钟超时或验证所有PG版本/全局角色扩展恢复。逻辑备份不是停写证明，容量与异地留存由部署负责；签名/校验不防已授权宿主篡改。T03真实组织人工验收及后续恢复/会话撤销继续单列。
