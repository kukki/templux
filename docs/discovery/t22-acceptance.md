# T22 数据库备份与自动保留验收

## 范围与实现

工单 #23，父规格 #1 故事55/57，既有备份规范及故事56显式外部参考。基线 `148f39ba83a07c46fbab89193c6b525c33312ee2`；不改任何历史迁移，本票无SQL迁移。原部署schema0004不动，T03真实飞书组织人工验收继续pending。

新增backup服务、CLI菜单25/一行backup、带固定PG18工具的migration镜像与management工具层。已有结构+pending迁移在迁移锁内先备份，成功后才改结构；start复用该入口。手动/自动/外部参考分开；归档和成功清单0700/0600，成功标记最后exclusive发布，签名及流式SHA只限制清理归属/字节一致，不冒称已恢复。默认仅保留同项目/来源5件可信成功automatic，未知/坏件/手动不删；时钟回拨按签名序号，不让新件自删。详细权限、锁、未知完成、宿主映射、TLS/工具兼容和恢复前提见 [备份合同](../specs/backup-and-recovery.md#t22-已实现容器备份与迁移前置)。

全部测试仅自有 `t22-dev` Compose、独立外部容器 `t22-external-db`、独立数据库与目录。宿主只用Docker/Shell/Python编排与读证据，无宿主PG客户端；SQL、pg_dump、pg_restore均在工具容器。没有使用Ego31、真人或飞书，不修改实际.env/presentation，不发通知。目录 `test-results/t22` 是公开文字证据；受限归档/清单另存700根/600文件，不把密码写普通证据。

## 最终验证点

最终完整命令：

```sh
docker run --rm --network t22-dev_default \
  -e TEST_AUTH_DATABASE_URL=postgresql://templux_test:isolated-test-only@database:5432/templux_auth_test \
  -e TEST_API_URL=http://api:8080 -e TEST_WEB_URL=http://web:3000 \
  -e TEST_SSR_WEB_URL=http://ssr-body-web:3000 t22-checks npm test
docker run --rm t22-checks npm run typecheck
```

测试/证明库分开：suite的破坏性fixture只用templux_auth_test；正常密码与备份恢复证据用templux，外部另有outside。API在suite期间明确连接同一个templux_auth_test，证据恢复后重新指回templux，不拿其它库结果假装登录贯通。

最终完整288/288通过，0失败/取消/跳过，67.6秒，结果在 `full-final-288.log`；专项 `tests/backup.test.mjs` 与 `tests/backup-faults.test.mjs`（根执行时再真实uid/gid1001子进程执行三种文件系统/锁场景，清掉NODE_TEST_CONTEXT并检查其真实tests3/fail0，不只检查子进程退出）。类型检查 `typecheck-delivery.log`。最终镜像/源码与编译文件映射在 `final-images.log`、`source-integrity.json`。末次只将migrate的连接池初始化移入统一错误处理，新增非法URL仍一个JSON失败/独立诊断回归；其后不改运行源码。

标准Dockerfile `--target migration` 实际构建成功，含API编译及既有Web构建阶段；最终记录 `root-migration-build-delivery.log`，PG工具版本 `production-pg-version.log`。早期为避免重复网络使用本地不可变T21镜像派生构建，但同样复制最终源码/实际tsc；工具层逐字使用固定PG镜像的bin+ldd运行库，最后标准migration编译与派生API/management/migration/checks逐文件hash一致。没有把旧镜像结果冒充最终源码；不要求本票无Web改动重做浏览器/截图矩阵。

## 实际SQL、HTTP、CLI与标准恢复

- `real-scratch-restore-final.log`：版本化工具驱动 `tests/scenarios/backup-proof.mjs` 创建自有人员→真实CLI授权admin→正常Web密码登录→受保护HTTP200→手动备份。恢复到独立scratch后逐项计数一致：accounts5、audit40、sessions13、password_credentials5，并核对本次用户名存在。测试用pg_restore --exit-on-error/--no-owner/--no-privileges，未验证全局角色/权限恢复或业务应用恢复；没有开放scratch服务，恢复会话失效属于后续票。
- 同驱动将标准dump复制到不含HMAC密钥/清单的位置后恢复，证明标准custom归档独立可读。结果单列 restored:true 仅指此scratch；生产备份结果仍 restored:false。
- `wrapper-backup.json`：实际复制的templux包装入口，对自有Compose运行完整非交互命令，JSON stdout一条、日志stderr；`menu-tty.log`：真实PTY菜单25→展示目标→yes→人类备份结果，非仅测试函数。
- `start-final.json/.stderr`：实际包装器start调用Compose build/migrate/up/health，结果localhost:31222；自有配置复用已有测试镜像（无build定义时Compose明确跳过build），生产标准镜像构建另列。`web-stopped-backup.json`：明确停止自有Web/API/entry后仍备份成功，DB保留，不依赖Web。
- `external-backup-final.json/.stderr`：非Compose数据库服务的独立Postgres容器/用户/库，普通backup命令成功；来源指纹区别于主测试库。外部库没有templux审计表，best-effort运行审计有脱敏不可用诊断但不妨碍有效备份；不冒充应用强审计变更。

## 迁移前置与失败阻断

标准最终工具镜像实际测试：`final-empty-skip.json` 将空库初始化至0008，即使备份路径不可用也无须备份；`final-migration-blocked.json/.stderr` 在已有0008时同路径失败，`final-migration-blocked-proof.json` 证明仍0008/pending未执行。`final-auto-migration.json/.stderr` 先成功automatic清单再0008→0010 applied2；`final-no-pending-skip.json` 无pending、坏路径仍applied0。内部库函数在已有结构但无历史表时也先调用backup gate，失败后迁移表仍不存在，见专项。

父规格故事56真实显式路径：`final-reference-unconfirmed.json` 缺confirm非零；`final-reference.json/.stderr` 明确确认后只记录external-reference，再迁移2项；`final-reference-proof.json` 验证受限600记录、verified:false且输出不回显原参考。该记录不进入自动保留，也不验证云快照/外部可恢复性，不是备份失败后的隐式降级。

## 权限、完整性、并发与保留

- `default-retain-five.json`：6次成功automatic，仅5件留下，最新成功存在、最早成功删除，另一次manual完整保留。专项覆盖自定2、损坏dump不删除、失败新连接不prune、时间回拨、新清单/根身份/项目保护。
- `retention-readonly-final.json`：真实只读挂载旧合法归档目录，旧件删除EROFS；新件仍成功，backupSucceeded:true、retentionSucceeded:false、cleanupSucceeded:true，调用不冒充成功清理。后续需核对，不自动重试迁移。
- `disk-full-final.json`：16KiB tmpfs导致真实pg_dump失败，非空/格式检查之前已非零，没发布成功清单；仅根归属文件留下，无backup目录、任务锁或连接凭据临时目录。不用人工抛异常代替磁盘满。
- `owner-faults-final.log`与最终suite：真实1001进程，权限被改旧件保守排除；缺密钥新归属不误删旧件；完整目录复制即使携带key也因设备/inode归属不符拒绝；损坏key不覆盖；真实第二PG会话持backups锁时立即冲突且不生成归档。
- `linux-owner-final.json`：真实Docker Linux volume上dump为1001:1001/0600，根和件目录700；`host-final-permissions.log` 独立宿主检查显示绑定产物501:20、根700/文件600。当前macOS共享层容器报告0:0，默认传501:20会拒绝，已保留 `automatic-migrate.log`，没有自动root降级。仅自有测试用成对0/0映射覆盖，并另做宿主验证；`uid-*.log` 证明未配对/空/非法/溢出在Docker前拒绝。既有凭据/init专项与全suite继续通过，随机密码交付文件也600。
- 源连接凭据不放pg工具argv；原始工具stderr不透传；私有passfile始终清理。`secret-scan.json` 只对自有3份生成密码扫描公开证据，无匹配；不读取或扫描实际.env秘密。没有将dump/清单密钥写普通输出。

## RED、失败尝试和局限

`red-cli.log/red-tests.log` 为原命令/模块缺失；`retention-clock-red.log` 真实新成功因墙钟回拨被删，改序号后GREEN；`copied-owner-red.log` 验证旧代码认领复制目录，加入目录身份后拒绝；`human-label-red.log` 保证backup不标维护结果；`invalid-migration-json-red.log` 原非法配置无JSON失败，移入统一catch后GREEN。

早期完整suite的测试库名称不满足既有安全断言（203/194/9），调整到专用templux_auth_test；随后Web示例默认PROD导致1项404（283/282/1），设自有DEV；中间287完整通过，增加目录复制case时CP新目录权限未固定导致1个fixture失败，明确700后专项3/3及完整最终再验。只读故障曾因zsh的`$var:ro`修饰符挂错目录，保留诊断，不作EROFS证据；改`${var}:ro`后的final记录才是实际故障。标准Docker初次npm ci等待较久，尝试停止的旧中间容器已结束，构建最终成功；不将这个尝试说成产品故障。

PG协议文档经Context7 resolve PostgreSQL→/websites/postgresql_18 后查询[pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html)、[custom dump/restore](https://www.postgresql.org/docs/18/backup-dump.html)、[passfile](https://www.postgresql.org/docs/18/libpq-pgpass.html)。写SQL/restore前已读Postgres技能；结构index/search→trace→snippet及17路径覆盖检查无记录缺口，图信号best effort而非完整证明。

实测环境为macOS宿主Docker/Linux容器PG18.6，不声称Windows/WSL/其它主版本/受信TLS外部云数据库已验收。未物理故障注入最后fsync后ACK丢失或等待15分钟工具超时，合同保守报告未确认、不自动重试；SHA/解码不是完整环境恢复承诺。挂载、剩余空间、manual/未知产物容量、备份异地保存与密钥/配置备份由部署负责，不增加调度/恢复产品功能。

## 收尾

关闭并移除自有Compose、外部DB、数据卷/UID证明卷/网络及私有明文交付目录；受限dump/清单保留700根/600文件供审查。`cleanup.log` 与 `original-status.json` 记录结果，原3个服务继续健康/schema0004。最终git干净、本地提交、不push、不关闭#23，交TL独立审查。
