# T07 独立审查：密码失败限制与可信来源

日期：2026-10-15；审查者：审查。固定范围 `cb006d417a760047f408862d1343ca39b109bedc..1ab6228d96b3c2b453a4fff4715cbd58b371f78c`；开始时 HEAD 为后者且工作树干净。按 Team 权限由同一独立审查者依次完成 Standards/Spec，没有新增成员。

## 双轴结论

| 轴 | 结论 | 发现/阻塞 |
| --- | --- | --- |
| Standards | 通过；范围内未发现需修复问题 | 0/0 |
| Spec | 本票可按 Gitea #8 验收，以下实际部署局限保留 | 0/0 |

已核对 #8、父规格 #1 故事37及认证/审计例外、ADR0015/0016/0018/0019/0028、仓库规范、合同、计划、验收和全部30文件差异。采用 code-review 双轴和 codebase-memory 结构覆盖流程；不是完整首版验收。T03 真实组织人工链路仍未完成。

## Standards

- PostgreSQL 认证状态独立于配置与秘密：组合键为规范IP、NUL分隔符和规范用户名的 SHA-256，失败表不存明文IP/用户名、密码或令牌（`apps/api/src/password-limits.ts:8`）。迁移0005追加，0001–0004差异为空；key格式、1–5计数、阻断/期限一致性CHECK及到期索引有明确约束。
- 限制/计数、会话与清理使用同一事务客户端；KDF在短事务外，事务advisory锁协调组合，行锁避免与清理竞争，成功发行仍复用授权锁重验身份（`password-accounts.ts:82`）。失败返回在计数事务提交之后；成功提交与清理原子，不因在事务内抛401而丢失计数。
- 时间来自 `clock_timestamp`，计数更新采用 MATERIALIZED moment 的同一时刻；不以应用时钟或锁等待前的 now 决定限制。清理每60秒最多100条、SKIP LOCKED、实例关闭清除定时器，清理错误脱敏（`password-limits.ts:14`、`auth-routes.ts:24`）。
- 最小 Node Web入口因 NextRequest 无可靠socket接口而保留原生IncomingMessage，覆盖内部来源标记并清除调用方转发头；仍调用官方 Next handler，不采用不兼容的 standalone。自定义入口明确打包在独立Web镜像，API不承担SSR（`apps/web/server.mjs:4`、`Dockerfile:45`）。
- 代理配置运行时严格校验、源地址规范化；API默认raw socket，显式host/IP每次重新解析后精确比较peer，未解析/缺可信标记拒绝猜测来源（`password-source.ts:6`）。不是 trustProxy:true 或固定跳数。来源标记不承载身份权限。
- 错误文案集中；429和Retry-After经Next透传，无新增账号资格反馈、自动重试、Redis、生产fixture或迁移后门。测试新表加入既有隔离TRUNCATE，不改变业务数据边界。

结构先search_graph→trace_path→get_code_snippet追踪passwordLogin及计数/来源依赖，再核对源码。全部30变更路径和认证/事务/构建/历史迁移依赖进行check_index_coverage：0005第3–10行、0002第3–6/20–21行、0004第10–11行为SQL解析缺口，已直接完整读取；其余依赖metadata_match。图为best-effort证据，未据其宣称SQL解析完整。Postgres技能核对短事务/advisory锁；Context7核对Next custom server、Node BlockList/lookup和Fastify默认socket来源。

## Spec

- 首失败开启15分钟窗口，第5次从该次DB时钟开始固定15分钟限制。受限请求返回429、Retry-After，不验证新凭据、不增次数或延长期限；到期可正常重试，未达5次窗口到期重置1次。成功只清理本IP/用户名组合（`password-limits.ts:9`、`:18`）。
- 跨两个真实连接池/HTTP实例12次并发，仅4次401、8次429、次数5；重启保留；正确密码在KDF/锁等待期间新提交阻断不能绕过，旧凭据/账号/Agent责任人资格在授权锁后检查（`password-accounts.ts:85`、`:88`）。
- 未知、停用账号/密码方式、Agent环境或责任人不允许均为401 invalid_credentials并累计；合法Pending可验证但业务仍403。正常登录审计单独失败仍可登录并记录脱敏错误；计数/会话SQL或整体数据库故障503且无Cookie，不扩大审计例外（`password-accounts.ts:99`）。
- Web默认不信XFF，只有socket peer在明确CIDR时才从右向左剥离到第一个不受信地址。IP解析拒多值、端口、zone和非法配置；IPv4 mapped与IPv6规范化。API只有明确可信Web peer才能提供单一标记。动态DNS与解析失败测试、默认伪造头测试通过（`shared/client-ip.mjs:20`、`password-source.ts:14`）。
- 正常Next页面、API代理、SSR与健康行为完整回归。没有对部署0004库迁移/重启；标准 npm test 以显式TEST_API_URL/TEST_WEB_URL指向独立0005服务，未回退原部署。已有库应用0005前备份要求保持；T10尚未交付的备份CLI不在本票虚报完成。

## 独立实测与证据

复用现成checks/API/Web镜像，仅在独立 `templux_auth_test` 应用0005。未重复昂贵构建或全浏览器验收。

| 命令/场景 | 实际结果 | 本次日志 |
| --- | --- | --- |
| checks以独立DATABASE_URL执行 `node apps/api/dist/migrate.js` | schemaVersion0005、applied5；空的临时测试库 | 工具命令输出 |
| `docker compose run --rm --no-deps -e TEST_API_URL=http://password-api:8080 -e TEST_WEB_URL=http://password-web:3000 checks npm test` | 104/104；fail/cancelled/skipped均0，包含T07全部14计数及既有SSR/权限回归 | t07-independent-suite.log |
| `docker compose run --rm --no-deps checks npm run typecheck` | API/Web均退出0 | t07-independent-typecheck.log |
| checks挂载 `test-results/t07-review-boundaries.mjs` 运行独立补核 | 以下三项通过，退出0 | t07-independent-boundaries.log |
| 两个并行checks容器运行 `tests/scenarios/password-proxy-client.mjs`，同用户名 `t07-review-real-sources` | 经生产Web入口，实际172.24.0.10/172.24.0.11各计1、不同哈希；伪造XFF/X-Real-IP/内部标记未写入SQL | t07-independent-source-a.log、t07-independent-source-b.log |

独立补核在执行前断言数据库名，仅创建本次账号/触发器/组合并清理：

1. 成功密码已经验证，但失败记录DELETE触发SQL故障：503，无Cookie/session，原失败记录仍为1。证明成功会话与清理整体回滚。
2. 正确密码请求等待授权advisory锁，观察真实pg_locks等待后提交账号停用：401，无Cookie/session，失败次数从1升2。证明KDF完成后的最新资格重验。
3. 105条到期记录并锁住其中1条：第一轮只删除100条且跳过被锁行，下一轮清理剩余；未到期活跃组合保留。证明实际批量/行锁边界，而非只看SQL字符串。

开发提供的证据另行读取：t07-browser-evidence.json显示正常密码页4次401、第5次429/900秒、正确密码仍429/881秒、限制文案和截止不变、调整隔离SQL截止后正常进入protected。没有把它记作本次审查者浏览器重跑，也不是实际等待15分钟。开发 external-chain/source日志对应真实工具Web的显式CIDR路径；本次实际双来源验证使用默认不信外部头设置，CIDR/IPv6规则在本次suite中按共享纯函数与真实API来源测试核对。

开发 t07-backup-restore.log显示独立恢复schema0004/4且新表不存在；结合受限备份步骤、历史迁移未变及源码复核。该恢复本次未重演，不证明真人业务库恢复。生产boundary日志为tests不存在、limits模块存在，Dockerfile独立检查相符。

本次日志不记录密码、Cookie或请求body；临时秘密只在容器内存，未写明文凭据文件。已移除本次全部password/SSR/auth-database工具容器，默认API/Web/database仍原镜像、持续healthy。没有修改实现/部署/.env/真实权限、推送或关闭工单。

## 局限

- T03真实飞书组织人工验收另列，未操作Ego31。
- 实际生产TLS网关、DNS控制权、NAT及Linux/WSL2/移动宿主矩阵未验收。默认Docker Desktop发布端口可合并为网关IP；不从未经信任的头恢复被NAT隐藏的地址。双客户端容器证明内部Next转发没有额外合并，不等于所有实际入口部署已正确配置。
- 期限边界使用独立SQL时间调整；未实际等待15分钟或注入操作系统时钟跳变。未额外重演COMMIT网络回包丢失和真实长时间无流量定时器；提交未知语义沿用此前事务审查，定时器生命周期核对源码，清理函数行为本次真实SQL验证。
- 不做容量/拒绝服务压力、完整无障碍或全部主题截图验收；T08关联/重置、T09审计页及T10备份CLI按各自任务验收。

文档核对：[Next custom server](https://nextjs.org/docs/app/guides/custom-server)、[Node BlockList](https://nodejs.org/docs/latest-v24.x/api/net.html#class-netblocklist)、[Node DNS lookup](https://nodejs.org/docs/latest-v24.x/api/dns.html#dnspromiseslookuphostname-options)、[Fastify request](https://fastify.dev/docs/latest/Reference/Request/)。
