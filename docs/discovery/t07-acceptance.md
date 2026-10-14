# T07 持久密码失败限制验收

日期2026-10-15；Gitea Swython/Templux #8/#1；审查基线 `cb006d417a760047f408862d1343ca39b109bedc`。已有18本地提交保留，本票不推送/关工单。T03真人组织验收仍另列。

## 实现与合同

同IP/规范用户名哈希组合，首次失败15分钟窗口内5次触发固定15分钟限制；受限不延长/累加，成功清除仅此组合。Postgres短事务、每组合advisory lock、锁后DB当前时钟及限制/最新资格复查，先提交失败计数再返回错误；正确密码在KDF期间新产生限制也不绕过。新不可变0005迁移及过期索引，60秒/100条SKIP LOCKED清理，正常重启和同库实例共享。正常登录审计例外保持，整体DB/计数故障不放行。

401统一错误覆盖未知/错误密码/disabled/Agent不允许；第五次及受限429、Retry-After，页面一致且不自动重试；已验证Pending仍仅账号状态/无业务权限。现有T04 Agent策略拒绝测试更新为统一401，授权及会话失效保护未取消。

可靠来源合同见 [password-failure-limits.md](../specs/password-failure-limits.md)：最小Node Web入口从socket提取并覆盖内部标记，Next正常handler/独立镜像/3000/原路径及SSR保持；默认不信伪造头，API仅精确匹配显式代理地址、动态DNS、缺标记/解析失败拒信。外部代理明确CIDR，右至左到首个不受信地址，不取任意最左XFF。IPv4-mapped/IPv6规范化；默认Compose同源API与认证可用性probe使用相同配置语法校验，无新增共享秘密，无Redis。

## 迁移前备份

只处理隔离库templux_auth_test：先用基线checks镜像初始化0001–0004，再在0005写入/应用前保存受限pg_dump。部署原库未迁移或重启，未操作.env/真人/Ego31。

```sh
docker compose --profile tools up -d --wait auth-database
# 在新增0005前使用基线镜像执行；输出schemaVersion0004/applied4。
docker compose run --rm --no-deps \
  -e DATABASE_URL=postgresql://templux_test:isolated-test-only@auth-database:5432/templux_auth_test \
  checks node apps/api/dist/migrate.js
docker compose exec -T auth-database pg_dump -U templux_test -d templux_auth_test -Fc > test-results/t07-pre-migration.dump
chmod 600 test-results/t07-pre-migration.dump
```

备份实际恢复到临时独立t07_backup_restore，再查询历史max(version)/count=0004/4、新失败表不存在，最后删除临时目标。日志t07-baseline-migrate.log、t07-backup-restore.log，dump0600保留。该基线隔离库尚无业务账号，不把此演练称为真人数据恢复。0001–0004未改写；正常测试随后自动应用0005。

T10备份CLI尚未实现，部署现有库升级前仍须按既有备份合同在受控容器/外部设施保存并记录；不能把 ./templux start 当前旧备份能力当作本票已补齐。数据库恢复的全会话失效要求保持另列。

## 真实容器命令

macOS Docker/Compose，Node24.21.0、Next16.4.0、Postgres18.6；显式隔离SQL，不回退部署数据库。

```sh
docker compose build checks api web
TEST_AUTH_PUBLIC_URL=http://127.0.0.1:31040 \
  docker compose --profile tools up -d password-api password-web ssr-body-api ssr-body-web
docker compose run --rm --no-deps checks node --test tests/password-limit.test.mjs
docker compose run --rm --no-deps \
  -e TEST_API_URL=http://password-api:8080 -e TEST_WEB_URL=http://password-web:3000 checks npm test
docker compose run --rm --no-deps checks npm run typecheck
```

原安装仍运行0004，故本票完整suite将安装状态检查显式指向新镜像的隔离password-api/password-web（0005）；不为通过测试迁移真人库。最终日志t07-build.log、t07-suite.log、t07-typecheck.log；完整104/104、API/Web类型检查通过，构建退出0。

先挂载新测试在旧镜像运行，第5次仍401而非429（t07-red.log），然后实现。T07定向14/14（t07-limit-expanded.log）覆盖：

- 初次4次401、第5次429；DB截止固定、受限正确/错误密码不改变次数/时间、Retry-After。
- 12个并发错误跨两个独立连接池/HTTP实例，仅4个401/8个429，次数=5，无会话。
- 真实127.0.0.1/127.0.0.2来源、用户名大小写/首尾规范化、组合隔离、默认忽略伪造XFF/内部头。
- 合法成功清理当前组合、另IP保留、真实SQL会话可访问业务；Pending验证但业务403。
- 首失败窗口到期后归1、窗口后段第5次从该次开始15分钟、服务重启保留、主动block不能用正确密码清理、到期恢复。
- 验证正确密码时已有SQL锁等待，在它等待期间提交新的限制，最终429无会话（观察实际pg_locks）。
- 受信peer才接受单一来源标记，非受信忽略；非法/多值标记400、受信缺标记503。
- 仅改隔离checks容器/etc/hosts，可信DNS从127.0.0.1改127.0.0.2后旧peer不再被信任；未解析.invalid返回503，不使用声称来源，原hosts最终恢复。
- 过期清理只删除到期项，不删除当前限制；SQL计数写故障/计数表不可用均拒绝，正确密码也无Cookie，readiness503；正常成功审计单独故障仍登录并清理。
- Node IP标准化、IPv6/映射、逐跳边界以及非法CIDR/代理主机配置与认证probe一致拒绝。

旧T02–T06全部回归包含于suite；真实Next body截断/坏JSON/解码/超时、401/403导航、Cookie与原路由重试继续通过。未重复昂贵独立安装/无关主题截图。

## 实际Web来源链路

两个同时运行的客户端tools容器经生产Web入口/API发送相同未知用户名，均携伪造XFF/X-Real-IP/内部头；SQL验证实际TCP来源组合各计1，不是Web单一IP，也没有伪造地址记录。日志t07-source-a.log/t07-source-b.log记录真实172.24.0.11与172.24.0.6及不同组合哈希。客户端脚本为tests/scenarios/password-proxy-client.mjs，只在tools测试，无认证发行入口。

```sh
# 并行运行（不同容器才有不同真实TCP源），不使用同一容器伪造头充当两个客户端。
docker compose run --rm --no-deps --name templux-t07-source-a checks node tests/scenarios/password-proxy-client.mjs
docker compose run --rm --no-deps --name templux-t07-source-b checks node tests/scenarios/password-proxy-client.mjs
# 仅隔离工具Web显式信任测试Docker网段以验证入口链；随后恢复为空。
TEST_AUTH_PUBLIC_URL=http://127.0.0.1:31040 TEST_WEB_TRUSTED_PROXY_CIDRS=172.16.0.0/12 \
  docker compose --profile tools up -d password-api password-web
docker compose run --rm --no-deps -e T07_PROXY_USERNAME=t07-trusted-chain \
  -e 'T07_PROXY_CHAIN=198.51.100.9, 192.0.2.7, 172.17.9.2' \
  -e T07_EXPECTED_SOURCE=192.0.2.7 checks node tests/scenarios/password-proxy-client.mjs
TEST_AUTH_PUBLIC_URL=http://127.0.0.1:31040 docker compose --profile tools up -d password-web
```

显式逐跳场景实际得到192.0.2.7而非最左198.51.100.9或伪造内部地址，日志t07-external-chain.log；此宽网段仅测试工具容器，不作为生产推荐。脚本有真实Web就绪等待；首轮在服务重建立即请求时ECONNREFUSED，补充就绪等待后正常通过，没有加入生产模拟入口。

## 正常密码浏览器

ego-browser新建本票TaskSpace37，只操作自建页面，finish后关闭；127.0.0.1测试端口避免用户localhost Cookie。通过正常CLI新建独立人员、随机密码写本票0700目录/0600文件，再CLI授user，浏览器仅读取用于正常表单，不打印密码。未使用生产测试身份或换票。

页面先实测4次401统一错误，5次429/Retry-After900、持续限制文案；随后填写正确凭据仍429（Retry-After881），留在/login。SQL前后key/次数/截止完全一致（cmp日志）。仅在隔离库把该限制截止移到当前DB时钟，再正常提交正确密码进入/account与/protected；失败表计数0，真实保护页通过。这是持久时间调整后的真实HTTP恢复验证，不声称实际等待15分钟，也不是生产时钟/认证后门。

证据t07-browser-evidence.json、t07-browser-{before-correct,after-correct,expiry,after-success}.log；代表性现有品牌登录页t07-password-limited.png。浏览器fetch观察只记录status/error/Retry-After，不记录请求体、密码或Cookie；截图与配置文案人工检查。没有重新跑本票无关窄屏/主题全矩阵。

## 覆盖与局限

codebase-memory先index/search/trace/snippet，逐依赖文件check_index_coverage；SQL0005部分解析缺口3–10行直接读取，并由真实PG应用/约束回归验证。Context7核对Next custom server/NextRequest IP移除、Fastify默认trustProxy与Node BlockList/DNS；SQL写对象前加载Postgres技能。文档/spec/config直接读取。

Docker Desktop发布端口NAT可能把多个本机客户端显示为网关，不能从未经信任的头恢复隐藏真实地址；实际不同容器已证明内部Next代理不额外合并。生产真实TLS网关配置/组织真人登录、Linux/WSL2矩阵仍待部署验收。新增配置示例写.env.example，用户.env原值未读取输出或修改。无真人权限/Ego31/通知操作。

已清理本次工具容器及受限随机明文凭据目录，TaskSpace37已finish；保留0600基线备份、非敏感日志/截图。21项本票日志/JSON检索未发现随机凭据明文，生产API镜像tests目录不存在、limits模块存在（t07-production-boundary.log）。t07-cleanup.log/t07-final-services.json记录清理及原API/Web/database仍running/healthy。工作区本地提交干净；独立审查由TL安排。
