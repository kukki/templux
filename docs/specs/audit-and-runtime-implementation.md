# T09 审计查询与运行日志实现合同

依据Gitea #10/#1、ADR0026/0027/0028与既有登录、会话、CLI合同，2026-10-15。具体字段、批次和容量是本票实施选择。

## 审计查询与身份

管理员从 /admin 进入 /audit，只读查询，不提供导出或运行日志网页。GET /api/admin/audit-access 供SSR准入；GET /api/admin/audit 服务端在共享授权事务锁取得后读取最新会话/状态/版本，要求accounts:manage和audit:read。普通/Pending/零角色与只有audit:read的非管理角色不因此获得访问。来源与Agent环境检查沿原会话合同，401统一失效，403/网络故障不误退出。

| 条件 | 合同 |
| --- | --- |
| q | 事件和安全操作者标识，去首尾空白、不区分大小写、字面包含；最多200字符，不搜索姓名/用户名/全部JSON |
| source | cli/password/feishu/system精确选择 |
| target | 目标账号正bigint ID；匿名/运维未指定目标为null |
| result | success/denied/failed；只表示该事件实际结果 |
| from / to | ISO8601含Z或偏移，from包含、to不包含，保留微秒；非法日期/反向区间拒绝 |
| page / pageSize | 正整数，默认10与项目5/10/15/20/25/50配置；末页夹紧，时刻倒序再ID倒序稳定排序 |

总数/页夹紧/当前页在同一SQL语句快照读取，避免并发清理产生矛盾数量；不在取得权限锁之前建立过期REPEATABLE READ快照。参数化SQL，LIKE特殊字符按字面处理。空结果保留表头；失败提示不可用，不当空结果。文本搜索400ms停止输入后应用；来源/结果即时，目标/完整时间显式应用。分页沿管理页基础合同，通用完整控件后续票另交付。

返回ID、原始UTC六位微秒时刻、项目时区显示值、事件、来源、结果、安全actor、可信度、actor/target类型与责任人ID快照、安全摘要；不返回密码/哈希/远程subject、Cookie/token/code/OAuth state、IP/用户名或私有交付文件。显示使用既有formatManagementTime、默认Asia/Hong_Kong到秒，项目time配置可覆盖，原始时刻不截断。

0008只增加新字段/枚举和时刻、来源+时刻索引，不改0001–0007。旧记录保留、actor_assurance=legacy，不伪造历史归属或身份。新记录在INSERT SELECT同一SQL语句捕获actor/target kind及责任人ID，后续变化不反写历史。应用actor只能来自服务端正常验证账号/会话；登录/注册为verified_identity，其它会话操作为application_session。Agent仍独立账号，明确责任人快照；不把责任人当Agent操作者。

CLI为host_claim，只接收数字host-uid或unknown显示标识，任意自报名称丢弃为host-uid:unverified，actor_account_id为空；宿主执行授权与应用身份不同，不宣称UID已独立核验。匿名认证拒绝为unverified，无目标/用户名推断；清理为system/service。历史未知actor不显示原任意文本，也不作为隐蔽搜索字段。

详情使用名单：账号状态重命名accountState、角色before/after、kind/method、owner/requestId、清理数量/留存天数、已知运维命令和拒绝原因；未知字段及深层对象丢弃。只传递服务端已校验元数据，不整体序列化请求、文件或provider payload。

## 逐类失败语义

| 类别 | 审计与失败 |
| --- | --- |
| 注册、账号创建/授权、关联/验证/重置、范围撤销、当前/全部退出 | 原同客户端事务强审计保持；审计失败回滚、不报成功；拒绝/已回滚运行诊断不冒充持久成功 |
| 密码/Feishu成功登录 | 账号/会话真实验证提交后，独立成功审计失败仍允许登录并记录login_audit_failed；整体DB故障不放行 |
| 密码错误/受限、Feishu开始/回调拒绝或协议失败 | 最佳努力匿名拒绝审计，denied/failed；故障只诊断authentication_audit_failed，保持原状态与T07计数，不泄露资格 |
| 非数据库运维init/start/stop/test/typecheck/config-check | 结果后最佳努力maintenance_command审计，CLI/host_claim，同时结构化实际结果；无DB/审计故障不改变实际退出码、不阻断救援，不声称已保存 |
| 普通运行日志 | 失败不改变已确认认证/事务结果，不落隐蔽备用文件；I/O丢失时不承诺诊断完整 |
| 自动清理 | 删除和摘要强审计同事务；故障当前批不提交，诊断audit_cleanup_failed，服务可用；此前提交批次不假称回滚 |

运维审计在动作结束后尝试，stop已停止DB时不能可靠记录完成，只保留结构化完成与maintenance_audit_unavailable；有DATABASE_URL但不可达时受原连接/查询超时限制。救援例外不扩展关键数据库管理。

## 自动清理与生命周期

AUDIT_RETENTION_DAYS默认90（1–3650）；AUDIT_CLEANUP_INTERVAL_SECONDS默认3600（10–86400）；AUDIT_CLEANUP_BATCH_SIZE默认1000（1–10000）；AUDIT_CLEANUP_MAX_BATCHES默认10（1–100）。空值/非法/越界拒绝启动。Compose仅对未设置提供默认，显式空值保留；management的start/config-check复用同一审计校验器，不能吞空值或在启动迁移前跳过配置检查。启动后及每周期后台清理，先验证迁移/结构，再事务try advisory锁；多实例同批不互等，FOR UPDATE SKIP LOCKED选cutoff之前旧事件，时刻/ID索引排序，有界删除。

每批statement_timeout4秒，删除数量与audit_retention_cleaned摘要同事务。单次默认最多10批/10000行，不因积压无限占服务；同实例防重入，跨实例每事务锁，新强审计不等待旧事件行。90天是可清理阈值，积压/故障会延迟淘汰，按量调节批次/周期。无pg_cron、Redis或新平台。

onClose停timer、禁止下一批、等待当前事务；API随后结束池。重启按持久记录继续清理。清理不更新会话活动或改变权限。

## 运行日志与容量

API Pino自定义destination、Web Next console/error adapter仅输出时间/service/level/event和有限数值诊断、已知stage、代码、命令/结果。禁请求日志；不输出原URL、请求体/headers、错误message/stack或任意provider文本，保留httpStatus/providerCode/stage及故障事件。Web直接node入口避免npm包装，启动/请求错误安全结构化；原始Node warnings禁用，由安全监听记录。

Docker json-file同时设max-size/max-file，默认RUNTIME_LOG_MAX_BYTES=10485760（16KiB–100MiB）与RUNTIME_LOG_MAX_FILES=10（1–30），不压缩便于预算核验；新API/Web/database各约100MiB，三长期服务约300MiB预算。容量参数同样仅未设置使用默认；应用/CLI入口拒绝空值及非法范围，Docker驱动可能在应用启动前拒绝空日志options（此时非零、stderr诊断，不伪造JSON应用结果）。约14天是目标，容量先到更早淘汰；驱动末条记录/元数据有小额边界，不宣称硬磁盘配额。应用日志名单限制单条大小，不让巨大原始错误载荷撑破预算。

tools各有自身预算，--rm结束删除；并行/保留停用容器额外占量，非整个Docker宿主全局配额。原0004服务未重建，不声称已替换其旧日志配置，正式升级/重建才启用。

Docker compose logs --no-color --tail 100 api web database，或 ./templux logs --json --non-interactive 读取保留日志。CLI JSON stdout仅结果，日志/诊断stderr；无网页浏览器/导出。标准stdout/stderr预留外部采集，不强制安装平台。容量、读取与实际Docker文件验证见验收。

## T21 运维扩展

新增entry长期容器沿用同一json-file容量上限，四个长期服务默认各约100MiB、合计约400MiB预算，仍不是宿主全局配额或14天保证。CLI logs包含entry；维护关键状态/授权回执审计同事务，Docker动作的maintenance-halt/resume/rescue结果另最佳努力运维审计。公开提醒正文不进入审计或运行日志。完整失败/救援合同见[维护](maintenance-operations.md)，不改变既有成功登录独立审计故障例外。
