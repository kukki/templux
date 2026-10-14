# T04 独立 Standards / Spec 审查

日期：2026-10-15（Asia/Hong_Kong）。范围：`151e3fcb293a90040d830152cbad4e37091801f7...978de78720c53267100fe50c9d0037b28789551f`，30个变更文件，审查时HEAD与指定终点一致。

按TL与Team治理，由同一独立于实现者的审查者依次双轴检查，未创建新成员。依据Gitea Swython/Templux #5/#1、相关ADR及认证/CLI规范、密码合同、开发验收与实施计划；使用code-review、codebase-memory、Context7、Postgres best practices及verification-before-completion流程。未修改实现、部署配置、.env或真人权限；未推送或关闭工单。

## Standards

**0项人工编码规范发现。**

新增逻辑使用TypeScript、pg参数化SQL及新增0004迁移，保留已有迁移历史；人员/Agent/责任人和认证方式有独立字段。密码派生、受限文件、SQL账号操作、HTTP与CLI职责可分别定位。新增命令沿用宿主容器入口、明确确认、日志与JSON分离；客户端仍调用正常密码API。未发现值得报告的Fowler基线异味；工具已覆盖的类型/格式不重复计入人工发现。

业务安全不变量的问题列在Spec轴；Standards通过不意味着该不变量通过。

## Spec

**1项P2需修复；建议修复后再验收。**

### F1 / P2：不可用的历史飞书身份被计作备用，允许降权最后可用密码管理员

- 位置：`apps/api/src/authorization.ts:23`，相关检查位于第18–29行。
- 依据：父规格“常规网页及CLI拒绝停用或降权最后一个有效管理员”；当前认证规范同样要求已建立管理员后先建立另一个有效管理员。T04合同明确有效计数考虑当前飞书身份、可用密码方式、Agent环境与责任人；密码身份不依赖飞书密钥，可独立运行。
- 最小触发：数据库有一个active、密码凭据enabled且可实际登录的person/admin；另有一个active/admin只保留历史Feishu身份，没有可用密码方式。部署未配置飞书（realm为空），密码认证继续正常运行。当前SQL的 `$1::text IS NULL OR ...` 把任意历史Feishu身份算作有效，因此降权实际唯一密码管理员后计数仍为1，错误提交。
- 影响：新权限检查会使旧会话失效；实际密码管理员重新登录后不再有管理员访问，历史飞书管理员也不能登录或使用旧会话，部署变成零个可用应用管理员。宿主CLI仍可救援，不是凭据泄漏或未经授权提升；等级P2。该行为属于本票最后有效管理员保护，不能推到T05/T07/T08。

本轮仅在独立 `templux_auth_test` 构造上述两类测试账号，保留真实密码哈希和实际API/CLI，未操作部署库。执行脚本位于忽略产物 `test-results/t04-review-last-admin.mjs`：

```sh
docker compose run --rm --no-deps \
  -v /Users/jkoo/git/Templux/test-results/t04-review-last-admin.mjs:/opt/templux/tests/review-last-admin.mjs:ro \
  checks node tests/review-last-admin.mjs
```

脚本通过正常POST `/api/auth/password` 登录，先验证 `/api/admin/access` 200；飞书start为503、历史飞书会话管理员访问401。随后真实执行容器内CLI：

```sh
node apps/api/dist/manage.js authorize --account <password-person-id> \
  --roles user --confirm --non-interactive --json
```

**实际退出0；再次正常密码登录后管理员API403，可用密码管理员SQL计数0。** 日志 `test-results/t04-independent-last-admin.log`：

```json
{"realm":null,"passwordAdminBefore":200,"feishuStart":503,"historicalFeishuSession":401,"demotionCLIExit":0,"passwordAdminAfter":403,"usablePasswordAdmins":"0"}
```

为区分触发边界，另作同一风险对照：

| 备用账号/环境 | 实际CLI降权结果 |
| --- | --- |
| 没有身份或密码方式 | 退出1，正确拒绝最后管理员移除 |
| 仅有disabled密码凭据 | 退出1，正确拒绝 |
| 历史飞书身份与当前realm不匹配 | 退出1，正确拒绝 |
| 完全没有飞书配置，但有历史Feishu身份 | 退出0，错误放行 |
| realm匹配但App Secret缺失，readAuthConfig为null | 退出0，仍错误放行 |

建议：有效管理员计数应与实际认证可用性一致。realm不存在时不把历史Feishu身份当作通配匹配；realm存在但飞书认证关闭/凭据不完整时，也不能仅凭数据库身份计作可用备用。保留密码、Agent开关/责任人与当前身份域检查，并增加上述混合身份组合的实际CLI/API回归，断言拒绝后角色/状态/版本及审计没有提交。

管理容器目前故意不接收App Secret，因此不要简单在管理进程直接调用readAuthConfig来决定所有飞书管理员是否有效。应定义不泄露秘密的部署认证可用性信号/共享合同，使CLI与API一致，同时保持Web未启动时可执行管理的合同。

### 其它已检查范围

- `password.ts:3`：异步scrypt N32768/r8/p3、maxmem64MiB、16字节随机盐与64字节结果；版本化编码，长度合法后timingSafeEqual。未知合法用户名执行同样派生；输入长度有HTTP及字节上限。
- `password-accounts.ts:9`：仅受限目录内文件名，exclusive+O_NOFOLLOW，描述符写入，设置宿主属主/0600并fsync。已有文件/符号链接不覆盖；输出/审计不返回明文。默认credentials目录从Git/Docker上下文排除，API/Web不挂载。
- 创建person/agent默认active零角色，Agent责任人为active人员；授权仍需独立明确命令。创建/重置/角色和关键审计同事务；确认回滚清理本次文件，COMMIT未知保留私有文件并明确提示核对，不自动重试。合同承认文件与SQL跨存储无法物理原子提交。
- 正常密码POST要求同源Origin，表单显式method=post/action，SSR按钮禁用直至hydrate；客户端preventDefault，待提交禁重复。不会以默认GET把密码放进URL。
- Agent生产缺省关闭、true/false覆盖与角色独立；登录和已有会话逐次检查开关、责任人、当前凭据enabled、状态/版本与Agent最长/闲置期限。重置Agent提高版本并拒绝旧密码/会话。
- 管理创建/重置审计失败回滚；已验证且已保存会话的独立成功登录审计故障允许登录并记录login_audit_failed；整体DB故障503、无Cookie。两种审计合同未混同。
- API/admin/access与前端admin页实际检查accounts:manage；user与明确admin不同。生产API未注册fixture或公众注册路由，无测试/凭据目录。

## 独立验证与证据

| 本轮命令/检查 | 实际结果 |
| --- | --- |
| `docker compose run --rm --no-deps checks npm test` | 50/50、0失败/跳过、退出0；`test-results/t04-independent-test.log`。包含T02/T03回归及密码SQL/HTTP/CLI、受限文件、Agent环境、审计和COMMIT故障。 |
| `docker compose run --rm --no-deps checks npm run typecheck` | API/Web通过、退出0；`test-results/t04-independent-typecheck.log`。 |
| F1独立实际构造与对照 | 如上，脚本退出0表示准确复现错误放行及对照拒绝；`t04-independent-last-admin.log`。现有50项没有覆盖该配置组合。 |
| 生产API镜像边界 | 一次性API容器内检查tests/credentials目录均不存在，退出0；没有启动新生产服务进程。 |
| Shell与补丁 | `sh -n templux tests/presentation-installation.sh`、指定差异 `git diff --check`退出0。 |

复用已更新镜像，未重构建或重启部署服务。测试只启动独立auth-database tmpfs，所有SQL写入/清理在该库；结束后移除自有测试数据库容器，部署三服务仍健康。重读开发50项/typecheck日志与本轮结果一致；查看现有Agent管理员窄屏与PROD拒绝截图，拒绝图密码输入为空。没有操作真实用户Ego31或重跑整套浏览器验收，菜单和完整浏览器角色演练采用开发记录/源码核对。

Context7先resolve Node.js并使用 `/websites/nodejs_latest-v24_x_api` 核对异步scrypt/maxmem、timingSafeEqual、O_EXCL/O_NOFOLLOW、fchown/fchmod/fsync与文件描述符写入，依据[官方crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html)和[官方fs](https://nodejs.org/docs/latest-v24.x/api/fs.html)。另resolve/query官方React，核对hydrate、preventDefault与事件提交语义。密码参数由本票合同固定，不以Node默认值替代本项目实际参数。

codebase-memory项目generation `2026-10-14T18:08:38Z`；图定位并双向追踪createPasswordAccount→文件/派生/事务/审计→CLI，读取setAuthorization原文。30个变更证据文件及相关规范/实现scope均检查覆盖；0004第10–11行parse_partial已直接读取完整迁移并由真实SQL验收，.dockerignore not_tracked已直接读取。覆盖为best-effort，不声称图证明全仓库完整。

## 结论与局限

Standards：0项编码规范发现；Spec：1项P2（F1），需修复后定向复核；当前T04不建议验收。没有发现其它需修复项，不因50项通过而忽略本轮实证组合。

本轮限macOS/Docker Desktop上的Linux容器，未执行完整Linux/WSL2宿主、实体移动设备、外部HTTPS代理或负载/全面渗透测试；文件/SQL进程崩溃跨存储边界按现有合同保留，未宣称跨介质原子性。T07持久化失败限制、T08验证关联/人员重置、T05心跳/全部退出仍由后续票交付，未计作本票缺陷。T03真实组织人工链路仍未完成，与本次密码审查分开报告。

仅本地提交审查记录，工单及后续修复由TL处理。

## 附录：2026-10-15 F1 修复独立复核

复核范围：`a71e22a51cfa31afb88ad8bec56457c4aef266f3...fd425fe31f207540e6c6ab664e8ceb87fc242581`，全部10个修复变更文件。上述初审结论保持历史原样，以下为最新状态。

### Standards / Spec 最新结论

**Standards：未发现新增编码规范或宿主职责违规。Spec：F1关闭，未发现新增问题。结合初审其它范围及本次复核，T04可按#5范围验收；T03真实组织人工验证仍另列未完成。**

`authorization.ts:23`移除null通配，仅精确匹配非空可用Feishu身份域。默认身份域由共享`authenticationAvailability()`调用完整`readAuthConfig`校验产生；无realm、缺失/空白Secret不再计作备用。密码enabled、Agent环境与active责任人条件仍独立检查。

管理镜像要求版本1非秘密投影；API镜像一次性`auth-config-probe`与部署API复用Compose同一auth-environment锚点，校验完整配置后只输出身份域或null及agentEnabled。宿主包装只调用容器和转交该JSON，不计算应用授权；不依赖Web/数据库在线来判断配置，符合既定宿主入口边界。management没有App Secret，并检查投影字段、版本、身份域与Agent策略一致；缺失或探针失败的空值不会静默放行授权。其它运维命令可以继续执行以修复配置。

投影是已获Docker/数据库权限操作者的受信任配置合同，不是浏览器输入；不声明抵御宿主自行伪造环境/SQL。它反映本次Compose配置，配置更改仍要求重启API；完整配置不证明官方接受实际凭据。

### 本轮独立实际验证

复用当前镜像，仅在独立auth-database tmpfs写SQL；未重建Web或运行浏览器截图。

- `docker compose run --rm --no-deps checks npm test`：**58/58、0失败/跳过、退出0**；`test-results/t04-f1-independent-test.log`。新回归实际验证无realm、匹配realm缺Secret/空白Secret均拒绝降权，状态/角色/授权版本/审计保持，原密码会话仍admin200。
- 同一套件验证三项原正确对照（无认证方式、disabled密码、非匹配realm）仍拒绝；完整匹配配置通过外部协议模拟的正常OAuth回调建立真实SQL会话/admin200，无Secret的管理子进程接收公共投影后可降权密码管理员，备用Feishu管理员仍admin200。模拟只替换外部HTTP，不替换SQL/权限。
- 原并发最后管理员、Agent开关/责任人、密码/受限文件/重置与审计/COMMIT回归继续通过。新测试未删减旧不变量。
- `docker compose run --rm --no-deps checks npm run typecheck`：API/Web通过、退出0；`test-results/t04-f1-independent-typecheck.log`。
- 额外独立投影边界检查：管理模式缺投影、错误版本、未知/缺失字段、Agent策略冲突、空/不可用身份域都拒绝；合法`{schemaVersion:1,feishu:null,agentEnabled:false}`正确返回null。`test-results/t04-f1-independent-projection.log`退出0。
- 新回归核对probe/API使用同一校验：别名冲突、无效公开地址/回调/期限导致probe退出1且stdout空，不泄露合成Secret；身份域或Secret空白反映不可用。已读源代码确认一致调用，无独立手填enabled布尔逻辑。
- 一次性真实management镜像仅作布尔内省：`secretPresent=false`、`projectionRequired=true`，退出0；没有读取/打印凭据值。
- 实际宿主包装恢复检查：仅本次命令传入合成App ID/Secret/tenant及非法回调`http://attacker.invalid/callback`，调用`./templux status --non-interactive --json`；probe明确失败但status仍退出0，stdout只有一个ok/status JSON，诊断在stderr。证据`test-results/t04-f1-independent-recovery.json/.log`。没有修改.env或运行服务配置；该检查执行包装自身要求的缓存构建，未进行无关构建。
- 开发实际wrapper disabled/no-secret/enabled三组日志分别为拒绝/拒绝/成功，已读取并与本轮SQL/投影结果及包装源码核对；不将这三次开发执行冒充本轮再跑。菜单解析、明确确认与完整参数分支未改；现有菜单/TTY合同及本轮完整CLI回归保持。
- `sh -n templux tests/presentation-installation.sh`、指定修复差异`git diff --check`退出0。工具auth-database已清理，部署三服务保持健康，未操作真人或Ego31。

### 结构、文档及局限

图generation `2026-10-14T18:24:27Z`；读取availableAuthRealm原文、双向追踪probe/availability→完整认证与会话校验→授权服务。10个修复证据文件与相关scope覆盖无已记录缺口，信号仍为best-effort。此次没有新SQL迁移，初审SQL缺口的直接读取结论仍适用。

通过Context7先resolve `/docker/compose`，核对CLI -e覆盖、环境解析、一次性run/no-deps/--rm语义；投影经显式`-e name=value`转交，不依赖Docker自动继承任意宿主变量。Node/React相关API仍沿用初审已核对文档，本次未更改密码派生或界面代码。

本轮限macOS/Docker Desktop/Linux容器，未重跑完整Linux/WSL宿主矩阵、截图或真实Feishu组织授权。配置可用性表示完整配置校验通过，不能替代官方兑换/tenant/Pending人工成功；该局限不改写为T04已发现代码错误。文件/SQL跨存储和后续T05/T07/T08范围仍按初审记录。

审查阶段只追加本文件，并仅本地提交审查记录。
