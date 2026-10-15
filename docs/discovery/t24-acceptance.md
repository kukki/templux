# T24：升级迁移备份与失败阻断验收

2026-10-15；Gitea #25，父#1故事50/55–57；基线 `1306546e74bcef6a989fc2d1f00191715d056000`。T03真实飞书组织人工验收仍单独pending，本票密码/SQL演练不替代该验收。

## 差异与设计

T22已经提供existing+pending才备份、私有归档/保留、迁移锁、逐项事务、外部参考与后置结构验证；T01/T21启动已在migrate退出0后才up应用。T24复用这些实现，不新增迁移、依赖、恢复器或产品业务。

发现并修复真实编排差异：management中`TEMPLUX_BACKUP_DIR=/opt/templux/backups`被子Compose优先拿来插值，错误成为宿主bind源。新增Compose内部`TEMPLUX_BACKUP_BIND_DIR`保存宿主原值，manage的子进程env复制仅还原该项；管理工具自身仍写容器路径，DATABASE_URL/项目/其它环境不改。绝对、相对、带空格路径均保持单个值。产品差异仅manage.ts的子进程环境与compose.yaml一个环境投影。

隔离场景由版本化`tests/scenarios/upgrade-proof.py`生成自有`t24-proof`配置及私有目录，标准Dockerfile构建api/migration，使用标准management命令。`upgrade-seed.mjs`只在工具容器直接建立真实0001–0008历史、两类账号/责任关系/角色/真实scrypt凭据/历史持久会话/审计，未增加HTTP认证入口。失败迁移只挂载于测试migrate服务，原SQL文件不改。

## RED → GREEN：宿主bind

```sh
# /workspace为本checkout只读挂载；不挂Docker socket，不运行真实Docker操作。
docker run --rm --entrypoint node -v "$PWD:/workspace:ro" \
  -v "$PWD/tests/scenarios/upgrade-bind.mjs:/opt/templux/tests/scenarios/upgrade-bind.mjs:ro" \
  t24-management --test tests/scenarios/upgrade-bind.mjs
```

测试Docker进程接缝只执行真实`docker compose --env-file /dev/null ... config --format json`，从配置中只输出两项备份source；不输出整个配置或.env。旧`t23-management`运行修复前3项全部失败：错误源均`/opt/templux/backups`，未投影宿主值。修复后与最终标准management各3/3通过，0skip。旧镜像与当时旧Compose的组合见`bind-red.log`；独立调用原子复现见`nested-command-red.json`。没有因RED实际在错误宿主路径写归档。

## 真实Compose/SQL/HTTP演练

```sh
docker build --target management -t t24-management .
docker build --target migration -t t24-migration .
docker build --target checks -t t24-checks .
python3 tests/scenarios/upgrade-proof.py
python3 tests/scenarios/upgrade-proof.py --cleanup
```

最终`proof.json`包含**21个行为场景与1个completed标记**，不是22项Node测试。首次主流程17项，补充`--controls`3项及`--login-proof`1项；这些入口均版本化，当前完整脚本一次执行全部21项。补充期间没有修改产品源码；最后标准start又独立通过。

| 实际场景 | 观察结果 |
| --- | --- |
| 旧0008→0010标准start | 迁移前自动归档落在指定宿主`approved backups`（含空格）；history8→10，账号2/凭据2/会话2/种子审计1保持；人员/Agent旧会话各200 |
| 归档真实scratch恢复 | 容器pg_restore读归档并恢复至独立scratch库；上述各计数及history8相同，不用SHA代替恢复验证 |
| 正常API/Web重启 | 两个旧会话仍200；未按升级或普通重启清除会话 |
| 重复start/no pending | history10，无新备份；仍执行schema验证 |
| 备份路径不可写 | 非零，history仍8，归档清单不增加，无entry/api/web运行 |
| 测试0009 SQL失败 | 非零，history8；同事务创建探针表不存在，应用未启动 |
| 0009成功/测试0010失败 | 非零，history9，探针表不存在；不能声称全批回滚；核验后显式重试标准发布成功到10 |
| 测试0010仅SELECT1 | 该项已提交、history10，但gate列缺失导致后置校验非零，应用未启动 |
| checksum/未知9999历史 | 各非零，无新备份、无后续应用启动 |
| 外部参考缺confirm | 立即失败，未执行后续启动 |
| 显式外部参考 | 私有0600持久记录`verified:false`且实际reference正确，普通stdout/stderr无参考内容，不产生dump |
| 迁移/备份锁各被真实会话持有 | 标准migration各及时非零，history仍8；持有会话退出后迁移成功 |
| offline与restore-block | start可以启动健康进程，但phase/gate不变、入口仍503；block仍在，显式resume亦拒绝 |
| 配置外部目标 | 第二个自有PG容器的独立库8→10；原Compose库history不变；外部目标历史人员/Agent会话200，没有改.env或自动切连接 |
| 多次升级保留 | 同来源成功automatic仅5件，manual归档与外部参考仍存在；失败备份未替换旧成功件 |
| 真空库+不可用备份路径 | 标准start成功到10，0账号、无新归档，空库跳过备份 |
| 无pending+不可用备份路径 | 标准start成功，无新归档 |
| 外部参考写入失败 | 非零，history仍8，无应用启动、无新归档 |
| 正常密码链路 | 升级后人员/Agent各通过正式POST密码认证及保护API200；旧历史会话各200 |

所有JSON CLI stdout均由`json.loads`整体解析，额外文本会使演练失败；Compose/构建/迁移事件在stderr。迁移器错误`migration_failed`与CLI非零真实传播。SQL/工具原始连接诊断不透传。早期事务提交与后置失败的准确含义及人工核验/重试指引已补至原备份合同，没有添加自动重试或回滚。

## 最终验证点与编译对应

最终三个标准target构建均退出0。`integrity.json`核对checks的7项相关TS源及3项新fixture/driver与checkout逐字节SHA相同；management/migration/api的7项相应编译JS与checks全部相同。包括唯一修改的manage.ts/manage.js。生产迁移历史相对基线diff为空。

| 镜像 | 最终ID |
| --- | --- |
| management | `sha256:777b255a44f480bc59a9265f2c77310a5661ba2d9017a7bbf861b7e22c36d24a` |
| migration | `sha256:4223e18cc287e6b9ce41bf8543755add76f0290b2cdaf98d25d51e6eca2580b5` |
| checks | `sha256:0bed835e87aed2360904cc361426f718c38e806c39f2b72111eba94b3daf8278` |
| api（标准start所建） | `sha256:ff4b5e0c2ae3281e7381499764893bf06e9da6ec62ccf638b3150b338f0e75cc` |

最终镜像再次运行：

- bind专项3/3，`bind-final.log`。
- `node --test --test-concurrency=1 tests/backup.test.mjs tests/backup-faults.test.mjs`：8/8，0skip；包括真实受限UID文件故障、竞争备份锁、自动保留/损坏保守保留、已有库前置与JSON诊断。`backup-final.log`。
- restore参数相关3/3，`restore-parser-final.log`；未重跑无关69 SQL/wire或332全套。
- `npm run typecheck`：API/Web均0；`typecheck-final.log`。此前API编译亦0。
- 最后标准management start：history10、人员/Agent历史会话200；`final-standard-start.json`及同名stdout/stderr。
- `git diff --check`、POSIX包装器`sh -n`及历史SQL相对基线diff均0。

未变化的Web应用源码/配置相对T21基线无差异，隔离演练复用`t21-web`标准旧镜像`32f255498ddb…`，不声称重建了最终Web镜像或跑了浏览器视觉验收。共享runtime-log已有T22的backup命令白名单一行差异，旧Web镜像不包含该行；本票没有修改它，Web不执行备份CLI，本次验证的是公开HTTP与后端升级编排。未重复生产Web构建/布局矩阵。

## 证据、限制与清理

忽略目录`test-results/t24/`保留safe结果：`proof.json`、主/补充日志、各case分离stdout/stderr、RED/GREEN、构建/typecheck/专项、integrity及cleanup。各CLI原始日志0600；无密码/Cookie/归档字节/私有HMAC输出。第一次自有夹具仅复制presentation导致maintenance-copy导入缺失，未执行备份；修正为复制非秘密配置后继续，失败另存`setup-missing-copy.*`，不计为产品失败或通过证据。

本机macOS Docker Desktop、Linux工具容器、PG18.6；未重做Linux宿主/WSL2、其它PG大版本或真实外部云数据库矩阵。第二PG容器证明不同目标/环境传递，不代表所有云权限/TLS配置已验收。初始旧会话由受限工具SQL夹具建立，最终又通过正式密码HTTP新登录；无生产测试认证路由。迁移COMMIT断线未知语义本票不另造故障代理，不宣称新增覆盖，继续按合同人工核验；T23恢复ACK故障的既有证据不冒充本票迁移实测。

清理命令移除仅`t24-proof`自有容器、tmpfs库、网络、维护卷，以及私有备份/归属密钥/随机密码/Cookie文件/失败迁移夹具；镜像和非秘密证据保留。原项目0004、.env、现用presentation、Ego31/真人/飞书从未迁移、重启、停止或授权。本票不替代T03人工验收，不推送、不关闭Gitea票；交TL独立审查。

## 调查依据

codebase-memory Tier2：index→search migrate/schemaVersion→双向trace→snippet，相关产品/测试路径coverage检查。图为best effort，0002/0004/0005/0009解析缺口已直接读对应SQL；最初四个猜测文件名无记录后用实际文件名复查，不作图穷尽性声明。

Context7读取[Compose插值优先级](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)、[PG18 dump一致快照](https://www.postgresql.org/docs/18/backup-dump.html)、[PG18事务边界](https://www.postgresql.org/docs/18/sql-commit.html)与advisory锁；Docker首轮文档查询传输失败，重试resolve/query成功。已加载Postgres技能及锁参考、brainstorming/计划/inline执行/TDD/完成前验证；既有授权允许在限定范围内自主实施，无额外审批中断。
