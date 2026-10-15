# T16 独立审查：通知计时、队列与合并

2026-10-15，审查者：审查。固定范围 `fcbd5dbda737d92782cff7f5d9be66e1c9ee7bf2..9fc5fd1637e09106cf7af7c357d7f0a2b249c7ef`；开始时HEAD为上界、工作区干净。按Team权限同一独立审查者依次执行Standards/Spec，不新增成员。

依据Gitea #17及已读取父规格#1、ADR0012/0013/0020、top-notifications、web-elements、T16计划/验收，检查全部18文件差异。使用code-review、codebase-memory、Context7、ego-browser及完成前验证流程。结构search/trace/snippet核对Notifications和控制器update；首次短名update查询歧义后使用完整限定名定位通知模块。改动18路径coverage均metadata_match/无报告缺口，best-effort不是完整性证明，另直接读源码/测试/配置。Context7首次resolve网络失败，重试成功并取得React官方useSyncExternalStore快照/清理文档，没有以失败充当文档证据。

## Standards

**0项发现。** 纯状态/单调时钟与React计时/焦点/媒体接入分离，公开快照缓存且冻结；通用模块不依赖examples。copy及品牌变量集中复用，纯文本渲染，无业务API、SQL、持久消息中心、维护能力、外发或认证fixture。输入/呈现配置运行时校验与项目所有者清理责任明确。未发现需单列的规范/代码异味问题，不重复报告工具已检查的类型项。

## Spec

**1项发现F1/P2。建议修复后定向复核，再按#17完整验收。** 无身份或业务权限扩大。

### F1（P2）：收缩前补位把从未显示项错误放入受保护暂停区

- **位置**：`shared/notifications.mjs:11` 的 `advance();fill();action()` 与 `setLimit` `:27` 的组合；容量淘汰在`:22`只处理waiting。
- **触发**：桌面可见上限3、合法等待容量2，顺序推A/B/C/D/E。已发布快照可见A/B/C、等待D/E。下一次协调时已过15秒（独立测试推进到16000ms），直接调用setLimit(1)，没有先tick。
- **实际**：advance移除A/B/C；旧上限的fill先提升D/E，但尚未publish；setLimit再把E移到suspended。最终唯一发布结果D可见、E暂停。**E从未出现在任何已发布visible快照，却被当作此前已显示项保护。**
- **后果实证**：再推F/G/H，实际suspended E、waiting G/H、omitted=1（只丢F）；关闭D后显示E。按合同“只有已显示项进入暂停区，满只丢最早从未显示等待项”，收缩后应D可见、E仍等待；推F/G/H应丢E/F、omitted=2，关闭D显示G。实际淘汰对象、省略数和后续显示顺序均不同。
- **独立证据**：checks容器实际createNotifications与注入单调时钟，`test-results/t16-independent-resize-expiry.json`记录before/shrunk/overflow/next，不是只断言内部调用。该条件也适用于恢复/resize发生于到期后、下次周期tick之前，不限精确同一毫秒。
- **建议**：setLimit协调到期后先应用新上限，仅把操作前确实已显示且仍存活的尾部项移入suspended，再按新上限补位；不能把同一操作内尚未发布的临时提升当已显示历史。补“到期+收缩+入队溢出”交错回归，核对快照、被丢ID、省略数和下一可见项，同时保留真正已显示项的余量/恢复优先及有界性。

### 其它已核对行为

- 默认15000ms/3与窄屏1，单调时间拒绝倒退/非法值；协调先移除到期，等待显示时才有可消耗余量，晚恢复不追溯扣等待时间。hover/focus为独立Set原因，内部焦点不恢复；触屏正文不新增鼠标悬停原因，后续键盘仍暂停。
- 显式相同key/level只合并活动项，保留首次内容/时长/位置/剩余/暂停，结束/不同级/无键不误合并。队列容量50、1–500可配，常规overflow丢最早等待、摘要饱和累积；常规收缩保留已显示项余量/清无DOM原因/优先恢复。F1是两种已测试正例的组合缺口，不能由单独通过否定。
- 焦点项关闭/收缩后移到可见关闭入口或returnFocus，不让普通到期项自动抢焦点；独立polite/atomic文本区不随进度文本更新，长文可键盘滚动，原生dialog top layer优先。没有声称真实读屏测试。
- clear/end清内容与省略，end永久拒push；视图session-ending同步end，所有者卸载clear、视图解除计时/订阅。旧实例不可跨账号重用，非持久通知。
- notifications整个省略/旧三字段缺capacity补默认，显式空/不完整/类型/未知/越界拒绝；共享loader与CLI保持启动快照、重启生效，不改现用presentation。严重度仅标签/语义/样式，不改FIFO优先级。

## 独立实际验证

复用checks镜像，不建数据库或凭据。自有 `t16-review-components` 仅把版本化fixture挂测试路由，API_INTERNAL_URL指向不可用本机端口1，127.0.0.1开发来源配置只在自有容器。HTTP200后新建自有Ego57，观察DOM再执行版本化notificationClock(page)。

| 命令/证据（test-results/） | 实际结果 |
| --- | --- |
| checks `node --test tests/notifications.test.mjs tests/editor.test.mjs tests/editor-deadline.test.mjs tests/presentation.test.mjs` | **40/40，失败/取消/跳过0**；t16-independent-targeted.log |
| checks `npm run typecheck` | API/Web退出0；t16-independent-typecheck.log |
| 自有组件容器Web workspace typecheck | 含fixture退出0；t16-independent-fixture-typecheck.log |
| notifications控制器/视图/presentation镜像与宿主SHA256 | 相同、diff退出0；independent-image-hashes.log/source-hashes.log |
| 版本化8组真实组件场景 | 全通过；t16-independent-components.json |
| 额外到期/收缩/overflow交错 | 发现F1；t16-independent-resize-expiry.json |

8组独立组件覆盖：hover与focus并集保留14秒、内部移动不恢复、均离开余量13秒；键合并×2保持原内容及余量；8条3可见/2等待/省略3；同刻到期7/8号满15秒；常规收缩/扩展保留余量并移走失效焦点；键盘关闭补位/焦点；end后清空且producer不能重用。专项另含14999/15000边界、90秒延迟、1000次入队有界、配置/真实CLI/重启快照及T14/T15控制器回归。未把可控时间当真实后台精确计时或真实SQL身份验收。

## 开发证据、清理与限制

开发最终194/194对应最终构建源码，此后仅文档，完整点与最终40专项准确区分。已核对首轮suite中examples预期200实得403及修正Origin后的suite-correct.log 194/194；合同与测试发送localhost、浏览器自有API先改127.0.0.1造成环境来源不一致，后只还原自有配置重跑，没有改同源校验或据此归咎产品。

已核对开发正常密码15秒/合并容量/真实touch与键盘后暂停/长文/撤权114ms/生产fixture404与匿名protected401 JSON，查看desktop和long窄屏截图。上述生产登录/SQL撤权、真实触控协议和完整长文窄屏为**开发执行证据**，本次独立执行限上表，不冒充全部重跑。维护通知、消息中心、产品API/SQL或飞书外发不在本票。

Ego57已finish({keep:[]})，自有容器删除，t16-independent-cleanup.log；原三服务healthy、API ready/schema0004，无迁移/重启。无数据库/凭据，.env/原presentation/Ego31/真人及飞书通知不动，未push/关票；本次只新增报告和忽略目录证据。

前台/休眠单调时钟与恢复协调不保证OS休眠一致推进或后台精确15秒；Chromium视口/触控协议不等于物理手机、全OS软键盘、读屏或TLS矩阵。原生top layer/焦点跨平台仍有限制。T03真实飞书组织人工仍未完成另列，密码链路不替代。整体验收建议待F1修正后复核。

## F1 定向独立复核附录（2026-10-15）

固定修复范围 `5f0f28a58ecffd0918009d113ec4fe39824f844a..d6a042409f2d8c66003454912f0fce7dbdea14bf`，开始时HEAD为上界、工作区干净。已读全部5文件差异、修复验收和合同补充，保留以上初审历史。同一审查者依次双轴；本次 **Standards 0项新增、Spec F1/P2关闭，0项新增**。结合初审其它覆盖，建议T16按#17验收；T03真人组织人工待办仍另列。

### 修复判断

`shared/notifications.mjs:11`的内部update仍默认前置fill，仅`:28`的setLimit传refillBefore=false。在一次发布内先advance移除到期项，再应用新上限、迁移原已发布且仍存活的尾部，最后按新上限fill。没有中间发布，也没有把新补位项当作已显示历史；既有suspended恢复优先。push/close/pause/tick的默认顺序没有改动，未扩大公共API或业务范围。合同明确原有保护语义，未通过重定义“显示”掩盖原缺陷。

独立执行15000及16000ms原ABC/DE条件：收缩一次仅通知订阅者一次，D显示且余量15000、E等待、suspended空；入FGH后省略E/F共2条、waiting G/H；关D下一个为G。14999ms对照保留B/C各1ms。新增5项还覆盖部分到期仅迁移存活尾部、清失效DOM暂停原因而保留余量、同键合并、已有暂停区在过期扩展时优先恢复。断言已发布快照、被丢ID和下一项，不仅检查内部状态名称。

### 本次独立实际执行

复用旧checks依赖镜像，**不是原生已含补丁的新镜像**。专项read-only挂最终shared及notifications测试；类型检查挂最终控制器；自有开发容器挂控制器及版本化fixture，API指向不可达本机端口1，不建立数据库/凭据或身份。HTTP200后自有Ego59执行版本化notificationClock。证据均位于ignored test-results/：

| 验证 | 结果与证据 |
| --- | --- |
| checks `node --test tests/notifications.test.mjs tests/presentation.test.mjs tests/editor.test.mjs tests/editor-deadline.test.mjs` | **45/45，失败/取消/跳过0**；t16-fix-independent-targeted.log |
| checks `npm run typecheck` | API/Web退出0；t16-fix-independent-typecheck.log |
| 挂fixture容器Web workspace typecheck | 退出0；t16-fix-independent-fixture-typecheck.log |
| 额外原条件及发布次数 | 15000/16000与14999对照断言通过；t16-fix-independent-boundaries.json |
| 原8组真实DOM组件场景 | **8/8**；t16-fix-independent-components.json；暂停并集/内部移动/合并、常规overflow、多项同时到期、收缩扩展余量及焦点、键盘关闭、end拒复用 |
| 源对应 | 控制器、未改React视图及fixture宿主/容器SHA256一致；t16-fix-independent-{container,source}-hashes.log。控制器docker cp后cmp逐字节退出0；mounted-controller.mjs |

相关8路径coverage均metadata_match、无报告缺口，best-effort不证明完整性；修复、视图、fixture、场景及新增测试另直接读取。沿用初审已取得React官方订阅/快照语义；本次无新框架API。核对开发red/green与修复验收的覆盖说明，开发证据与上表独立执行分开。**194全套为初次交付历史点，本次没有重跑194、生产构建、正常密码/SQL身份或无关截图矩阵**；本次45对应最终挂载源码。

### 清理与限制

Ego59已finish({keep:[]})一次，自有t16-fix-review-components已删除；t16-fix-independent-cleanup.log显示仅原三服务healthy，original-status.json为ready/database connected/schema0004。无数据库/凭据、迁移或原部署重启，.env/现用presentation/Ego31/真人/飞书通知均未动，未push/关票；只追加本审查文档。

可控单调时钟与Chromium组件验证不代表真实后台精确15秒、OS休眠一致推进、物理手机/全软键盘/读屏或TLS矩阵。正常密码/生产fixture边界/SQL撤权仍沿用初审已核对开发证据，未声称本次独立重复。以上初审限制继续适用，无剩余本票阻塞发现。
