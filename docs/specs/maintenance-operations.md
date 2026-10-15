# 持续提醒与停服维护（T21）

Gitea #22 / 父#1故事85、86；ADR0025/0026/0028。本票选择宿主授权CLI管理提醒，不增加网页管理API；普通人员/Agent不会因看到提醒获得管理权限。T03真实组织人工验收仍独立pending。

## 持久事实、公开内容及提醒

0009单例维护状态：版本、online/offline、active、planned_at、公开message及更新时间；0010增加独立gate_version。提醒和业务状态独立：start仅提醒；到点不关服务、不只读，倒计时归零仍持续；cancel或end只清提醒且须online，绝不把offline自动改为online。提醒active时刷新/导航仍读取持久状态，正常重启不清除。无关闭/收起按钮，不进普通toast队列，不等待普通通知完成；独立粘性顶部区域，普通通知避开其高度。默认每5秒查询，恢复可见/联网立即核对；客户端时钟按服务器采样偏移显示，不承诺网络故障下准确同步。ARIA不每秒播报，计划时刻显示项目时区。

`GET /api/maintenance`公开返回必要状态、版本和服务器时间，无操作者、账号、IP、文件路径或凭据。start时刻要求合法显式时区ISO、秒及最多3位毫秒，拒绝非法日历日期；说明1–300字符单行纯文本，禁止控制字符，按文字显示不执行HTML。说明是公开内容，不能放内部故障详情或秘密；审计及运行日志不保存该说明。状态/DB故障显示未知，不能当作已结束或假称计划维护；ending中停止请求、时钟及旧内容。

## CLI（菜单18–24与同一参数校验）

所有变更明确确认，非交互缺参数直接非零；JSON stdout只有一个结果，Compose/运行诊断在stderr。CLI是宿主执行授权，actor为host-uid/host_claim，不冒充已验证应用用户。首先读取版本，下一命令显式使用该版本，不自动追随并发变更。

```sh
./templux maintenance-status --json --non-interactive
./templux maintenance-start --expected-version VERSION --at 2030-05-01T22:00:00+08:00 --message '计划维护，请及时保存。' --confirm --json --non-interactive
./templux maintenance-cancel --expected-version VERSION --confirm --json --non-interactive
./templux maintenance-end --expected-version VERSION --confirm --json --non-interactive
./templux maintenance-halt --expected-version VERSION --confirm --json --non-interactive
./templux maintenance-resume --expected-version VERSION --confirm --json --non-interactive
./templux maintenance-rescue --confirm --json --non-interactive
```

start可显式更新已有提醒，相同内容为幂等；cancel/end无active亦幂等。halt在offline时再次明确执行停止检查，不反向开放；resume总是重新启动/检查已有业务镜像，即使数据库已online，也不能未经检查声称健康。普通`start`会构建/迁移并启动entry/API/Web，但不会替代维护恢复；普通`stop`是包括入口与DB的全停，不承诺维护页。上线前遵循已有迁移前备份合同，先备份/验证，再应用迁移；本票未提前交付后续备份产品命令。

常规状态修改在维护操作session advisory锁内CAS，exclusive业务写屏障在单例行/修改之前取得；更新及名单关键审计同一事务。锁忙/版本冲突直接失败；无变化不伪造变更审计。COMMIT结果未知不重试，不执行后续停服或发布入口回执。维护gate及notice审计记录事件、版本、phase、active、时刻，不记录公开message之外的任意请求字段；实际Docker动作完成/失败另最佳努力运维审计，不能替代关键事务审计。

## 入口、停写和恢复

public端口TEMPLUX_HTTP_PORT由独立entry容器占用，Web不再发布宿主端口，entry只反代Web（Web代理API）。DB与entry在maintenance-halt时保留。entry读取SQL，offline返回项目品牌、设计变量及必要公开说明的HTTP503维护页，Retry-After/no-store，无Cookie清除；上游失败、DB/结构未知或释放回执不明为不同的“状态暂时无法确认”503。entry的/health/live仅证明进程存活，不声称DB或业务健康。入口本身、DB、整机或网络全停不能保证页面。须把反向代理/Ingress公共流量指向entry，绕过到Web无此页面保证；直接API亦执行gate检查，宿主DB访问始终须受控。

halt/resume先核对entry的存活入口，失败不由该命令停止/恢复业务；需先启动并检查entry。halt顺序：持有维护操作锁→独占业务写锁等待已经进入写事务→提交offline/递增gate版本及强审计→停止web/api（30秒宽限）。所有新写在共享锁后看到offline而拒绝。停止Docker失败时SQL仍offline，入口保持维护页；错误不声称SQL回滚或业务全部停止，先status/容器/审计核对，再显式执行。没有自动部署、自动迁移或倒计时停服务。

resume顺序：同版本和维护操作锁→`up --no-build --wait api web`检查现有发布→强审计提交online/新gate版本→确认COMMIT后原子发布非秘密回执→再核对SQL→成功结果。启动/健康/审计失败保持offline；SQL提交ACK丢失不发布回执，入口保持503。状态已online但缺正确回执时，status显式accessReady=false，不称业务完全恢复；核验后再次明确resume可重新检查并发布；即使SQL已经online，重新发布仍须先同事务保存maintenance_release_authorized强审计，失败不写回执。取消/end通知不发布回执，不能绕过停服或未知恢复状态。

回执位于`TEMPLUX_MAINTENANCE_RELEASE_FILE`，默认/opt/templux/maintenance/release.json，Compose维护卷management可写、entry/API只读。仅schemaVersion与gateVersion，无秘密；临时O_EXCL/NOFOLLOW文件、显式0644、fsync、同目录rename及目录fsync，失败清临时文件；读拒绝符号链接/非普通文件/大文件/坏JSON或错误版本。phase在线且版本0无文件允许首次启动；其它缺失/不匹配均关闭。提醒自身version变化不影响gate_version。最终文件rename可见是发布点；其后目录同步或进程返回异常可能已经生效，CLI只报未确认，须核对实际状态，不声称回滚。DB提交ACK未知则完全不调用发布。共享卷必须持久保留，与DB/配置一同纳入部署恢复核对；恢复旧DB/删除回执不能作为绕过入口手段。数据库实际online提交与公开入口释放不是跨存储原子事务，保守顺序只允许延迟开放，不以文件替代持久审计。

SQL屏障覆盖accounts、identities、account_roles、auth_sessions、oauth_requests、password_credentials、password_failures、login_method_requests的INSERT/UPDATE/DELETE/TRUNCATE statement；共享事务锁持续至COMMIT/ROLLBACK，函数VOLATILE在锁后用新READ COMMITTED快照。其它隔离级别写入直接拒绝，避免旧快照读到online。审计、维护和迁移元数据不纳入业务屏障以保留恢复/审计职责。GET中的last_active_at更新同受屏障保护；不能把GET都称为只读。

项目新增业务表必须在迁移中显式创建同类statement trigger执行templux.guard_maintenance_write()，或在事务开始按同一共享锁/状态合同接入；外部系统写者同样负责协调。模板不自动扫描/固化业务模型，不保证恶意DB owner、禁用trigger或未接入的新表被阻止。直接SQL以实际已提交phase为准；online提交ACK未知但回执未发布时，公开HTTP仍关闭，宿主DB运维不得借此开始未协调写入。

## 救援、失败与代理来源

rescue只用于DB无法确认等故障下的宿主显式停止web/api，不修改/伪造持久SQL状态、不强行开放，不绕过应用权限授予；结果标注barrierVerified=false、auditSaved=false、state=unknown。实际已停与未知写屏障分开，stderr指出审计可能不可达。DB回来后先核对在途管理命令和SQL/容器，必要时halt建立可靠屏障，再显式resume；不自动重试、不因数据库恢复就承诺应用开放。维护操作锁是活动DB session保护，连接或进程中断后须人工核对Docker在途动作，不能当跨系统事务或无限租约。

entry默认不信客户端XFF/私有IP头，按socket来源覆盖内部声明；仅项目显式ENTRY_TRUSTED_PROXY_CIDRS才接收外部反代链。Web仅信WEB_ENTRY_PROXY_HOSTS明确DNS解析出的entry peer，直连仍按原WEB_TRUSTED_PROXY_CIDRS处理且不信伪造私有头。API仍仅信PASSWORD_PROXY_HOSTS中的Web，防止所有用户被错误归为Web/entry单IP或客户端换头绕T07。Docker Desktop/NAT可能只提供宿主网关IP，需在真实入口代理部署中按现有来源合同配置；不保证凭网络拿不到的客户端原地址。

默认Compose维护卷按项目名隔离，entry/API只读、management可写；不得把不同项目手工指向同一卷。回执不是身份或跨项目认证凭据。新安装无回执/gate0和已有0008安装逐步备份升级的实证见[T21验收](../discovery/t21-acceptance.md)。
