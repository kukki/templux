# T22 F1 第二轮：自定义访问方法补齐

基线 `393c1f1b0b2ee4b1f145b494fc9041834f6e0af2`。原审查及前轮修复历史均保留，F1是否关闭由独立复核决定；唯一产品变化为database.ts增加一行pg_am用户OID检测。无新迁移或历史SQL改写。

## 复现与修复

自有PG18.6容器/网络 t22-am-fix-db / t22-am-fix，证据在test-results/t22-am-fix/。旧标准镜像t22-fix-standard-migration，独立am_red库仅含review_heap table AM、handler为内置heap_tableam_handler。坏备份路径/proc/backup-impossible仍applied10/history10/am_count1，am-red.json、am-red-after.json及stderr证实审查反馈；不是已发生AM删除或数据丢失。

先给既有SQL fixture添加table/index AM：旧包am-test-red.log两项缺少预期备份失败。修复仅在原pending锁内existing查询加 `OR EXISTS (SELECT 1 FROM pg_am WHERE oid>=16384)`，不更改锁/历史/备份调用/错误处理。普通查询错误仍抛出到统一迁移失败路径，不能通过catch变为空库。内置AM不因目录非空触发备份。

## PG18.6 有界对象核对

Context7 resolve PostgreSQL→/websites/postgresql_18核对[pg_am](https://www.postgresql.org/docs/18/catalog-pg-am.html)及[CREATE ACCESS METHOD](https://www.postgresql.org/docs/18/sql-create-access-method.html)。另直接读取与实际工具18.6匹配的官方[pg_dump.h](https://github.com/postgres/postgres/blob/REL_18_6/src/bin/pg_dump/pg_dump.h)、[pg_dump.c](https://github.com/postgres/postgres/blob/REL_18_6/src/bin/pg_dump/pg_dump.c)，ignored副本及pg-source-sha.log记录读取内容。

重点检查DumpableObjectType、selectDumpableAccessMethod/getAccessMethods/dumpAccessMethod及g_last_builtin_oid设置。pg_dump自身对非namespace AM按initdb保留OID识别内置，正常生成分界为FirstNormalObjectId；本次不是硬编码一组当前AM名字。

| 有界类别 | 检测映射/边界 |
| --- | --- |
| 独立非schema根：extension、procedural language、cast、access method | pg_extension/pg_language/pg_cast/新增pg_am，区分initdb与正常OID |
| 独立非schema根：transform、FDW、server、default ACL、large object、event trigger、publication、subscription | 原有对应目录；subscription限制当前数据库 |
| user mapping | 虽无单独DO根，由server输出，原有pg_user_mapping检测 |
| namespace、类型/壳类型、函数/aggregate、operator/opclass/opfamily、collation/conversion、关系、文本搜索 | 原schema依赖/用户schema判定；不是再按示例名字枚举 |
| attach、列default、index、统计、rule/trigger、constraint/policy及复制关系子对象 | 依附关系、类型、namespace或publication/subscription父对象；父对象已识别 |
| data、sequence set、large object data、refresh、边界等 | 数据/归档组织类别，不是新增独立用户根 |
| 数据库根元数据、共享角色/tablespace、环境/插件文件 | 不以数据库存在判非空；共享角色/表空间及文件不在单库dump覆盖承诺内 |

在此版本根对象清单内，明确遗漏为AM，未发现另一需要追加的独立非schema根目录。该核对不是所有SQL DDL/属性变更或未来版本完备性证明，也不等同每种对象已实测恢复；不扩展集群备份功能。目录/权限/版本错误仍fail closed；只实际验证PG18.6，不把工具9.2–18可读范围当模板迁移支持承诺。

## 最终实际验证

- build-standard-migration.log：标准Dockerfile target migration实际构建t22-am-standard-migration；不是挂载补丁源到旧标准镜像。checks派生现有工具镜像，复制最终API源/测试并实际tsc。source-integrity.json、images.log记录主机/checks/标准target源和编译对应。
- targeted-final.log：`tests/migration-objects.test.mjs tests/backup.test.mjs tests/backup-faults.test.mjs`，**36/36**，fail/cancel/skip0，约2.1秒。包含table/index AM新增2项，原21对象、空库、无pending、迁移锁竞争/失败释放、既有8项备份及真实1001子进程故障。typecheck-final.log API/Web退出0。不机械重跑288/UI。
- standard-proof.log及空stderr：版本化tests/scenarios/migration-objects-proof.mjs实际Docker调用新标准target。23类各自独立库，坏备份路径全部非零、历史表不存在。
- 仅含fix_heap/fix_btree的独立库：坏路径拒绝/no history；合法路径先发布automatic归档才applied10，归档1593字节。真实pg_restore --exit-on-error到scratch，table/index类型及heap_tableam_handler/bthandler分别正确，scratch无history，证明备份先于迁移。使用内置handler注册的合成AM，不宣称验证任意C插件或跨版本ABI恢复。
- 原三类型scratch目录/enum标签/domain约束/composite值继续通过，归档1912字节；真空库默认heap/btree（保留范围OID）存在但仍跳备份/applied10，无pending+坏路径applied0；0008+坏路径保持0008，合法备份后applied2。

最终专项命令：

```sh
docker run --rm --network t22-am-fix \
  -e TEST_AUTH_DATABASE_URL=postgresql://templux_test:isolated-test-only@database:5432/templux_auth_test \
  t22-am-checks node --test --test-concurrency=1 \
  tests/migration-objects.test.mjs tests/backup.test.mjs tests/backup-faults.test.mjs
docker run --rm t22-am-checks npm run typecheck
```

标准driver在旧t22-management工具壳中运行，仅提供Docker/pg客户端，不使用其旧迁移实现；tests只读挂载。复跑须先准备自有同名DB/网络、700私有根及0001–0008公开迁移副本：

```sh
docker run --rm --network t22-am-fix --entrypoint node \
  -e TEMPLUX_FIX_PROJECT=t22-am-fix \
  -e TEMPLUX_FIX_HOST_ROOT="$PWD/test-results/t22-am-fix" \
  -e TEMPLUX_FIX_MIGRATION_IMAGE=t22-am-standard-migration \
  -v "$PWD/tests:/opt/templux/tests:ro" \
  -v "$PWD/test-results/t22-am-fix/private:/opt/templux/backups" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  t22-management tests/scenarios/migration-objects-proof.mjs
```

驱动会创建t22_standard_*库，不能指向真实部署。所有SQL/pg_dump/pg_restore均在容器内；无宿主PG客户端或新增生产测试/认证入口。原task driver的t22-fix上下文仍可使用，当前AM场景需选择含该修复的镜像。

## 收尾与局限

codebase-memory按index/search→trace→snippet、相关路径coverage，best-effort信号；Postgres技能在SQL/restore前应用。初审/复核原文只追加本交付链接，不更改此前结论。实际单库非schema根类别的若干分支未逐个新造故障，源码映射不替代全部运行矩阵；不增加新功能来声称完备。

仅自有临时PG/目录。cleanup.log记录删除容器、网络、private目录内dump/key；保留公开脚本/日志和审查镜像。original-status.json确认原部署ready/connected/schema0004，实际.env、presentation、Ego31、真人/飞书不动；T03真实组织人工验收仍pending。不push、不关#23，提交后交TL独立复核。
