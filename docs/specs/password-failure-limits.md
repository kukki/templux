# T07 密码失败与可信来源合同

依据Gitea #8/#1故事37，T04密码及T05会话合同；2026-10-15。实施选择不作为额外用户决定。限制参数按既定规格固定，不新增Redis或T08关联/重置功能。

## 组合与时间

来源IP规范化（IPv4-mapped IPv6转IPv4、IPv6规范表示）及用户名trim/ASCII小写规则复用现有normalization。数据库组合键为SHA-256(IP + NUL +规范化用户名)，不保存IP或用户名明文到失败表、响应或诊断。不同IP/用户名互不影响；同NAT公网地址的不同用户名仍分离，同IP/同用户名共享限制。

合法语法用户名的失败认证进入同一计数，不依账号是否存在或资格给额外反馈。第一次失败开启15分钟窗口；窗口内第5次失败以触发时的数据库时钟开始固定15分钟限制。受限期间即使密码正确也返回429，不验证新凭据、不累计、不延长；截止时间<=当前DB时钟则可重新尝试。未触发限制的15分钟窗口到期后下一次失败计为新的第1次。成功通过最新资格验证并提交SQL会话后，仅清除该组合；其它IP/用户名不清除。

每次失败计数先提交再返回401/429。每组合使用Postgres事务advisory lock，同库多实例共享，不依进程缓存；锁后复核限制。密码KDF在短事务外，但正确结果也不能绕过等待期间新提交的限制；会话发行前仍取得既有授权锁并复查凭据、账号状态及Agent责任人/策略。所有比较使用DB clock_timestamp，计数更新在单一物化时刻确定窗口/期限，不使用锁等待前的事务起始时间或应用时钟。正常重启保留限制。

## 正常认证与页面

未知用户名、错误密码、disabled账号/密码方式、Agent环境/责任人不允许、验证期间凭据变化：统一401 `invalid_credentials`，同样累计；不继续返回可辨认Agent资格的403。这是T07对T04登录失败反馈的收敛，既有已验证会话失效的agent_login_denied原因保持。合法Pending和零角色可验证登录，之后账号页显示状态，业务/管理API仍403，没有额外权限。

第五次及受限请求为429 `login_limited`，Retry-After整数秒1–900来自当前DB截止；没有账号存在信息。Next代理保留该响应头，正常密码页显示同一限制文案。页面不自动重试，也不以客户端倒计时判断能否登录；到期由用户再次正常提交。非法请求结构/用户名语法不构成有效账号认证尝试，沿用统一invalid_credentials；跨源Origin仍403且不计数。

SQL计数/会话存储或整体DB失败返回503，无Cookie。成功会话与清除记录同一事务；COMMIT不确定不给成功/不自动重试。正常登录审计单独失败仍不阻止已经验证并提交的身份，沿用login_audit_failed无秘密诊断。新表是认证状态，不记录密码、会话或请求body。

## 来源IP边界

Fastify保持trustProxy默认false，直接API请求以真实socket.remoteAddress为来源，不信XFF/X-Real-IP/Forwarded。NextRequest缺少socket/IP接口，故Web采用最小Node HTTP入口server.mjs调用Next官方getRequestHandler：从原始IncomingMessage socket读取，覆盖x-templux-client-ip并清除转发头后交给Next。原页面/API/SSR/独立构建/3000端口及健康路径保留；不启用standalone输出（官方custom server不兼容该模式）。客户端伪造内部头会被覆盖。

API `PASSWORD_PROXY_HOSTS`默认为空（纯直接API）；Compose缺省为API/probe共同配置web，显式空值可关闭，测试API明确配置password-web。认证可用性探针使用同一字段校验，非法配置不能仍宣称认证可用；不读取或输出额外秘密。允许逗号分隔受信主机名/IP，最多16，不接受通配、全网CIDR、true/false或跳数、空项、非法名称。每次密码请求重新解析受信地址并与真实API socket peer精确比较，支持服务重建和DNS返回多个实例；只有匹配的受信代理才可携带单一合法IP标记。未匹配peer即使伪造标记也忽略；受信peer缺标记或DNS不能解析返回不可用，非法/多值标记拒绝。不得把受信代理故障时的peer猜作真实客户端。Docker服务DNS及代理工作负载属于受信部署边界，操作者须控制这些名称，不能指向调用方可控制的公共DNS。

Web `WEB_TRUSTED_PROXY_CIDRS`默认空，忽略任何调用方XFF。仅外部TLS/入口代理实际存在时明确配置其精确IP/CIDR；拒全网/0、通配/布尔/跳数、重复/空项、非法地址和前缀。最多32项；XFF最多16个纯IP，无端口/zone。仅真实socket peer在清单时读取，从右向左逐跳，遇第一个不受信地址即停止，绝不盲取最左值或固定跳数。可信入口必须覆盖/正确追加真实来源，部署不能让不受信调用者占据所配置网段。IPv4/IPv6均规范化。

默认开发Docker Desktop发布端口可能NAT成宿主网关，多个本机连接共享该TCP来源是网络事实；模板保证Next内部转发不再额外合并来源。生产需由实际TLS代理传递真实地址并显式受信；没有可信入口时不猜测被NAT隐藏的地址。独立部署/API多实例须配置仅Web/可信网关的实际地址，限制API直连网络。内部IP标记没有承载认证身份，授权仍独立正常会话检查。

## 持久化与清理

新增不可变0005_password_failure_limits.sql，key_hash主键、1–5次数、first_failed_at/blocked_until/expires_at及一致性CHECK、过期索引。API每60秒清理最多100条已经到期记录，FOR UPDATE SKIP LOCKED避免影响正在核验的组合；不删除未到期限制。清理故障记录结构化事件，不放行/延长会话；无流量时也清理。实例并行清理通过行锁协调。未清理的到期行也按时恢复，不依赖清理调度。

应用前先备份已有库；空库可按既有合同跳过。本票隔离0004库已pg_dump并在另一个临时数据库实际恢复核对，再应用0005；已应用0001–0004校验不改写。T10备份CLI尚未建设，部署原库升级前须由受控容器/现有外部备份完成并记录参考；本票不迁移部署真人数据库。数据库恢复开放前旧会话失效仍属既有恢复合同，失败表不是会话撤销替代品。

## 验证与文档

真实SQL/HTTP独立连接池、并发、重启、固定窗口/期限边界、组合隔离/成功清理、资格统一、计数/审计故障；实际Web/API两个客户端容器、伪造头与显式代理逐跳、动态DNS/解析失败、IPv4/IPv6规范化，以及正常密码页限制/到期恢复。没有生产认证fixture或时钟后门；时间边界仅在隔离数据库调整持久时间后通过正常HTTP请求验证。

Context7核对 [Next custom server](https://nextjs.org/docs/app/guides/custom-server)、[NextRequest IP移除](https://nextjs.org/docs/app/guides/upgrading/version-15)、[Fastify trustProxy/request.ip](https://fastify.dev/docs/latest/Reference/Server/#trustproxy)、[Node net.BlockList](https://nodejs.org/docs/latest-v24.x/api/net.html#class-netblocklist)与[dns.lookup](https://nodejs.org/docs/latest-v24.x/api/dns.html#dnspromiseslookuphostname-options)。证据见docs/discovery/t07-acceptance.md；T03真人组织验收继续另列。
