# T22 F1 修复验收：已有用户对象与空库

基线 `1a438064078b27dc4558c4f88f14b2d4a5e7b428`。初审原文保留在[t22-review.md](t22-review.md)，本文件是开发修复交付，不代替独立复核。唯一产品源码变化为database.ts的existing检测查询和说明；无新迁移、历史改写、Web/API行为或凭据配置改动。

## RED与根因

自有新PG18.6容器/网络 `t22-fix-db` / `t22-fix`，没有复用原库或审查库。标准旧 `t22-root-migration` 真实连接enum_red（只有public.review_status），坏路径/proc/backup-impossible仍退出0、applied10；之后history10/type_count1。`test-results/t22-fix/enum-red.json`、`enum-red-after.json`、stderr证明反馈成立，不把类型仍存在说成已丢失数据。

原判断只有指定relkind关系、自定义schema、public函数，未检查独立类型及其它命名对象。新增失败测试在旧包真实SQL下暴露enum/domain/composite/collation/operator/text-search和非schema对象同类遗漏，`objects-red.log`为RED；不是只用模拟返回值推测。

## 最小修复

保留原迁移锁、pending/历史校验及beforeChange调用位置。替换existing查询：schema对象使用pg_depend→namespace的通用依赖；空自定义schema仍需备份；非schema对象按目录补查，避免只加enum名称特例。extension/language/cast包含内置对象，通过PG FirstNormalObjectId区分正常创建与initdb记录，默认plpgsql不使新库变非空。

完整定义见[备份合同](../specs/backup-and-recovery.md#t22-f1-修复空库与已有对象定义)。只读目录查询不增业务模型、权限绕过、认证入口或环境开关，失败不退化为空库；不使用pg_shdepend的owner边作为唯一判断，因为对pinned角色的依赖可被省略。

## 最终测试

证据均在 `test-results/t22-fix/`。

```sh
docker run --rm --network t22-fix \
  -e TEST_AUTH_DATABASE_URL=postgresql://templux_test:isolated-test-only@database:5432/templux_auth_test \
  t22-fix-checks node --test --test-concurrency=1 \
  tests/migration-objects.test.mjs tests/backup.test.mjs tests/backup-faults.test.mjs
docker run --rm t22-fix-checks npm run typecheck
```

`targeted-final.log` **34/34**、fail/cancel/skip0，约2秒；`typecheck-final.log` API/Web退出0。包含既有8项备份/非法配置/真实非root故障和新增用户对象、空控制与竞争测试；不重跑288 UI或截图。根测试还真实执行uid1001子进程三项，既有权限/保留/归属和备份锁不退化。

新增 `tests/fixtures/migration-object-cases.mjs` 只含工具测试SQL，`tests/migration-objects.test.mjs`逐库执行；不进入生产HTTP/认证流程。

### 实际标准target、备份和scratch

`build-standard-migration.log`：真实标准Dockerfile target migration构建成功，非仅覆盖旧包源；最终tag **t22-fix-standard-migration**。检查镜像用本地T22基镜像复制最终API源码与测试、实际tsc，源码/编译比对独立记录。构建过程因既有legacy多阶段顺序也经过已有Web build，不据此宣称重验UI。

版本化驱动 `tests/scenarios/migration-objects-proof.mjs` 在旧management工具壳内执行（只提供Docker客户端和pg），只调用新的标准migration镜像；挂载tests只读，不给API添加测试入口。实际复跑命令：

```sh
docker run --rm --network t22-fix --entrypoint node \
  -e TEMPLUX_FIX_PROJECT=t22-fix \
  -e TEMPLUX_FIX_HOST_ROOT="$PWD/test-results/t22-fix" \
  -v "$PWD/tests:/opt/templux/tests:ro" \
  -v "$PWD/test-results/t22-fix/private:/opt/templux/backups" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  t22-management tests/scenarios/migration-objects-proof.mjs
```

需先启动同名自有数据库/网络，准备700私有根及公开0001–0008迁移副本目录；驱动会创建指定t22_standard_*测试库，不能用于真实部署。连接/PG工具/restore全在容器内，无宿主PG客户端。

`standard-objects-proof.log`（stderr为空）实际结果：

- 21类单独对象：enum、domain、composite、range、table、sequence、view、function、procedure、collation、operator、text search dictionary、自定义空schema、自定义schema类型、pg_catalog内hstore扩展、large object、FDW、publication、cast、用户language、default ACL。每类在全新独立库+坏备份路径非零，历史表均不存在。
- 仅三类类型的组合库，合法根先成功automatic归档后才applied10；真实pg_restore到独立scratch后类型目录一致，enum标签draft/active、domain正值可读/负值约束拒绝、composite值(name=proof,amount=7)保持。scratch没有history，证明归档在迁移之前。归档1912字节、标准可读，不把这些检查冒充应用恢复或恢复会话撤销。
- 真正空库（默认系统schema/public/plpgsql）+坏路径仍applied10；已到0010后+坏路径applied0。
- 空库先用0001–0008副本初始化，已有0008+坏路径非零且仍0008，合法根发布备份后applied2到0010。
- 另一个真实SQL会话在beforeChange等待时持迁移锁，第二migrate立即拒绝；第一次备份失败后第三调用可重新获得锁，但未写history。与现有备份锁/根锁专项一起覆盖顺序/异常释放。

## 来源、镜像和局限

Postgres技能在SQL/restore前加载；Context7 resolve PostgreSQL→/websites/postgresql_18，核对[pg_depend](https://www.postgresql.org/docs/18/catalog-pg-depend.html)、[pg_shdepend](https://www.postgresql.org/docs/18/catalog-pg-shdepend.html)、[pg_cast](https://www.postgresql.org/docs/18/catalog-pg-cast.html)和[OID](https://www.postgresql.org/docs/18/datatype-oid.html)。目录文档未充分解释16384，补查[PG18 transam.h官方源码](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/include/access/transam.h)，正常OID生成及wrap后不使用initdb保留范围；不是按当前样例最大OID猜测。

codebase-memory index/search→双向trace→snippet，相关路径覆盖检查，仍只作为best-effort。`source-integrity.json`及`images.log`记录主机/checks/标准target的源与编译SHA，最终标准target和checks同一database/migrate/backup编译文件。没有把旧root-migration的RED包当作新包。

实际PG18.6/Linux Docker，未扩展PG版本/云TLS/全平台验收。非schema目录中transform/server/user mapping/event trigger/subscription分支经过空库SQL和编译运行，但本轮未单独构造每一类（其依赖对象已由代表性案例覆盖）；不把21项称成每种PG DDL均已实验。项目新增功能/PG大版本须审查目录变化，目录读取失败或其它版本缺catalog时保守阻断，不能把工具可读服务器范围当作迁移版本承诺；本轮未另造缺catalog/权限故障，不冒充该类实证。非空识别不等于全部对象已进入dump，集群角色/表空间不在此单库备份内。

所有变更仅自有库/目录/镜像；原.env、现用presentation、Ego31、真人权限、飞书不动，T03真实人工仍pending。`cleanup.log`记录删除自有DB容器/网络及私有dump/key，不保留本轮敏感产物；原部署 `original-status.json` 仍ready/connected/schema0004。保留公开脚本/日志与本地审查镜像，不push/不关#23；待TL安排独立复核。
