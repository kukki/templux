# T14 独立审查：表单校验与未保存离开保护

2026-10-15，审查者：审查。固定范围 `035550be473c778500832deace9d9f3112371efe..703999ae7806cbd7f9f7c9eb3282d7c7522dd11b`；开始时HEAD为上界、工作区干净。按Team治理同一独立审查者依次执行Standards/Spec，不新增成员、不改实现。

依据Gitea #15及已读取父规格#1、ADR0012/0020、web-elements/session生命周期规范、forms-and-unsaved-edits、T14计划与验收，检查全部19文件差异。应用code-review、codebase-memory、Context7、ego-browser及完成前验证流程。search→trace→snippet核对编辑控制器/导航，相关改动、测试与session-client逐路径coverage均metadata_match/无报告缺口；保持best-effort限制，另直接读源码。Next官方onNavigate/Link边界与MDN beforeunload文档已核对。

## Standards

**0项发现。** 编辑控制器、React接入/字段呈现与导航职责分离，业务校验/规范化/保存均显式传入；通用模块不反向引用examples。表单可见文案集中配置，采用既有品牌变量及原生字段/label/错误描述/焦点。示例仅内存，没有业务API、SQL、迁移、生产fixture或认证后门；不以客户端校验替代后端字段/权限验证。未发现本范围需单列的规范或代码异味问题，不重复工具已检查的类型项。

## Spec

**2项发现：F1/P2、F2/P3。建议修复并定向复核后再按#15完整验收。** 没有发现权限扩大或服务端访问检查被绕过。

### F1（P2）：EditLink的同页hash仍确认，并可清空未保存编辑

- **位置**：`apps/web/app/components/elements/edit-navigation.tsx:42`；对照document捕获过滤`:32`。
- **依据**：合同明确“仅hash导航不离开当前编辑，不提醒”。document捕获遵守该规则，但EditLink的onNavigate无条件再次requestLeave。
- **复现**：在自有测试页使用原样Provider/useEditor/EditLink，增加真实React消费者 `<EditLink href="#local-target">Hash Link</EditLink>`。输入Hash draft使dirty=true，点击该链接；受控confirm计数并返回true。**确认1次，地址只增加#local-target，值却恢复Alpha，dirty=false**。原生a同页hash对照确认0次、值Native hash draft/dirty=true保持。
- **证据**：自有Ego TaskSpace49，`test-results/t14-independent-components.json`（hash与11个原组件状态点）及 `t14-independent-native-hash.json`。只新增忽略目录测试页，未改产品代码；不是给现有DOM改href冒充React属性，也不是原生beforeunload弹框限制。
- **影响/建议**：本应只定位页面内内容的操作触发丢弃确认；接受后实际重置当前编辑。EditLink需与捕获层共享“是否真正离开编辑文档”的判断，跳过同路由/search仅hash变化，并保留普通Link/target/download/修饰键及一次确认合同。加入dirty状态下原生a和EditLink hash的取消/确认计数及值保持回归，不能只测document捕获过滤。

### F2（P3）：旧保存成功清掉较新输入已经显示的校验错误

- **位置**：`shared/editor.mjs:28`，成功结果无条件 `errors:copy({})`。
- **复现**：初始Alpha，修改Beta并submit挂起；保存等待中把名称改空并blur，当前errors.name=Required；旧Beta保存成功返回。当前空值/dirty=true虽保留，**errors却变为空**，字段失去就近错误及aria-invalid反馈，直到再次blur/submit。独立Linux checks容器直接执行实际createEditor，证据 `test-results/t14-independent-newer-errors.json`。
- **依据/影响**：首次失焦应给当前字段校验反馈；较新编辑已有的错误不应由旧快照成功删除。并非旧值覆盖或已保存假成功，后续submit仍会校验，所以定P3反馈问题。
- **建议**：成功结果只清理对应已确认快照的错误；对保存期间变化且已暴露校验的字段保留或重新验证当前值。补“等待中改成非法值并blur→旧成功返回→当前错误保持”的回归；同时核对fields响应合并不会覆盖其它较新字段的本地错误，不扩展为每次输入全字段首次报错。

### 其它核对结果与导航边界

- `editor.mjs:3–18/23–31` 基线为规范化确认值，dirty非触碰次数；还原clean/reset重置，submit验证全字段，blur单字段/已有错误修改复查。保存快照冻结，saving阻止重复；revision保护当前新值，字段响应只附仍等于提交值的字段；reset/cancel/generation使忽略abort的晚结果失效。useEditor卸载cancel/release，内存不持久化。
- 表单字段名称在上方，render prop提供id/aria-invalid/describedby，错误就近/formError分类；示例正常/字段/表单/403/网络/延迟为内存消费者，真实HTTP映射合同要求sessionFetch/ended，不能把网络或403当401。
- 普通锚点捕获与显式requestLeave协调多个注册源、取消保留/接受重置；新窗/下载/修饰键不离开，_top/_parent同窗考虑。实际发现的EditLink hash例外见F1，不据普通a测试概括全部Link。
- dirty时才安装beforeunload；session-ending监听取消保存、释放原生守卫，既有session捕获与endSession优先，晚保存不能恢复已失效控制器。开发真实撤权后protected401/持续原因重登证据已核对，本次不重复真人或权限矩阵。
- 未接入的同文档工具栏back/forward不保证拦截已在公开合同/README明确；采用文档编辑入口或显式requestLeave包装历史按钮。该平台边界与#15“支持的原生提示”以及新项目接入合同一致，不要求不可可靠取消的popstate回滚或历史哨兵；不能据此声称所有浏览器工具栏离开均受保护。

## 本次独立执行

| 执行/证据（test-results/） | 结果 |
| --- | --- |
| checks `node --test tests/editor.test.mjs tests/search.test.mjs tests/multiselect.test.mjs tests/list-state.test.mjs tests/presentation.test.mjs` | **32/32，fail/cancel/skipped0**；t14-independent-targeted.log |
| checks `npm run typecheck` | API/Web退出0；t14-independent-typecheck.log |
| 自有组件容器挂载测试页，`npm run typecheck --workspace @templux/web` | 退出0；t14-independent-fixture-typecheck.log |
| Ego49导入版本化controlledEditor(page) | 11状态点通过：blur/submit/纠错/还原、保存新值、fields/form、reset晚返回/卸载重挂；t14-independent-components.json |
| 同页hash实际组件消费者与原生a对照 | F1如上；受控confirm计数，不冒充原生浏览器确认框全平台验收 |
| checks实际createEditor延迟成功/新错误交错 | F2如上；t14-independent-newer-errors.json |
| 三个核心editor/导航/React接入文件镜像与宿主SHA256 | 全相同、diff退出0；independent-image-hashes.log/source-hashes.log |

原32专项没有覆盖F1/F2触发组合，不能以通过否定实际发现。检查前曾创建自有auth-database，确认本次32项不需SQL后直接删除，**没有迁移/使用该库或原库**；没有创建password-api/Web、没有真实凭据。组件只挂自有t14-review-components，允许开发资源的配置只在自有容器；测试页与hash消费者不进入生产路由。

## 开发证据、清理与局限

已读取开发组件/正常表单/链接边界/原生离开/撤权证据及验收，查看desktop/narrow截图：名称/错误布局与390页面宽、焦点/键盘、正常保存与失败留输入、普通Link/router保留放弃、受控历史按钮、真实104ms撤权优先均有开发材料。本次独立限上表，未冒充重跑正常生产密码页、真实撤权、全浏览器/历史矩阵。

开发172/172发生于download过滤修正前；最终源码32项/typecheck/构建和边界浏览器另列，**未将172冒充最终全套**。MDN及开发实证说明beforeunload可请求取消但该Ego环境实际未显示原生框；本次不宣称原生框通过，也不将该已声明平台限制列作缺陷。

Ego49已finish({keep:[]})，自有组件与未使用的工具库已删除，证据independent-cleanup.log/db-cleanup.log。原三服务healthy，API ready/schema0004，未迁移/重启原服务。.env/原presentation/真人/Ego31/实现不动，不push/关工单。T03真实组织人工仍未完成另列；所有浏览器/OS输入法/软键盘/辅助技术/TLS及原生关闭限制继续保留。取消不保证远端写入回滚，真实项目仍须后端最终验证。

## 附录：F1/F2修复独立复核（2026-10-15）

固定范围 `46c9142b0d320b89ec7a977c38b657adc185945f..ce3cd50e5bbaba43b10bb29a93756036cccca4ed`。开始时HEAD为上界、工作区干净；读取全部七文件差异、修复验收和合同补充，保留初审历史。结构search/trace/snippet核对EditLink与recheckExposed，相关修复/测试/合同逐路径coverage均metadata_match/无报告缺口，另直接读源码；best-effort限制不变。

**Standards：0项新增。Spec：原F1/P2与F2/P3关闭；新发现F3/P2。建议修复F3再按#15完整验收。**

### 原发现关闭证据

- F1：捕获与EditLink共用解析后href的origin/path/search判断；真实React相对hash、完整同页hash、对象hash及原生a均确认0次，Hash draft/dirty=true保持，地址实际更新hash。
- F2：成功只复查已暴露的当前错误，fields响应合并仍适用的快照服务端错误。实际组件Beta挂起→改空blur→旧saved，Required、aria-invalid=true、就近错误、当前空/dirty均保持；改Gamma后错误和aria-invalid清除。新增纯回归还验证多字段、未触碰非法字段不提前暴露、交叉校验、当前本地错误优先及未变字段服务端错误合并。
- 原controlledEditor的11个状态点再次通过。真实route/search/外部取消各确认一次且保留Gamma/dirty，download/_blank/Meta修饰点击零确认且保留；接受search离开确认一次并回已存Beta/clean。上述下载/新窗消费者主动阻止实际副作用，不声称真实外站或下载验收。

### F3（P2）：消费者取消EditLink点击后，捕获层已经重置编辑

- **位置**：`apps/web/app/components/elements/edit-navigation.tsx:33`（document capture提前requestLeave/reset），与`:45`转发消费者onClick的执行顺序冲突。
- **复现**：自有隔离组件页在原fixture基础上只加真实React消费者 `<EditLink href="/account" onClick={event=>event.preventDefault()}>Prevented route</EditLink>`。页面为 `/t14-component?leave=1`，已存Beta，输入Prevented draft使dirty=true；受控confirm计数并返回true，点击该链接。结果**确认1次、URL完全不变、当前值却回Beta且dirty=false**。消费者确实阻止了导航，但document捕获在消费者处理前已经丢弃编辑。
- **证据**：`test-results/t14-fix-independent-prevented-click.json`，自有Ego51，实际组件/原生click路径。不是伪造href或只根据源码推测；属于本次复核新发现的原有捕获路径问题，不声称是本修复新引入的回归。
- **影响/建议**：明确不导航的消费者仍触发离开确认，接受后没有离开却丢掉草稿。Next Link消费者应先有机会取消click，再对真正onNavigate作统一确认；让捕获层与EditLink协调避免提前reset/重复确认。补消费者onClick preventDefault时零确认、URL/值/dirty保持，正常转发及真实离开仍一次确认；同时保留hash/download/target/修饰键和session-ending优先。这里不要求通用可取消popstate或改变原生beforeunload合同。

### 本次独立命令与证据范围

| 验证 | 实际结果（test-results/） |
| --- | --- |
| checks `node --test tests/editor.test.mjs tests/search.test.mjs tests/multiselect.test.mjs tests/list-state.test.mjs tests/presentation.test.mjs` | **36/36，fail/cancel/skipped0**；t14-fix-independent-targeted.log |
| checks `npm run typecheck` | API/Web退出0；t14-fix-independent-typecheck.log |
| 自有组件容器workspace Web typecheck（含新增测试消费者） | 退出0；t14-fix-independent-fixture-typecheck.log |
| 实际浏览器controlledEditor、hashLinks、newerValidation、leavingBoundaries | 全部版本化断言通过；t14-fix-independent-components.json；另加消费者阻止场景发现F3 |
| editor.mjs/edit-navigation.tsx镜像与工作区SHA256 | 全相同、diff退出0；independent-image-hashes.log/source-hashes.log |

只启动现有checks镜像的自有 `t14-fix-review-components`，API_INTERNAL_URL指向不可用本机端口9，不接原API/SQL，无新数据库/凭据。原fixture及新增消费者仅挂自有dev路由，未修改实现。现成场景使用公开DOM输出/错误节点/URL及受控confirm计数，不冒充生产身份或原生对话框验收。未重复172全套、SQL权限矩阵、生产构建或无关截图；原真实401/撤权优先证据仍为初审已核对开发材料，新增代码显式sessionIsEnding取消路径源码保留，本次没有再触发真实身份失效。

Ego51已finish({keep:[]})、自有组件容器删除，t14-fix-independent-cleanup.log；原三服务healthy、ready/schema0004。未改.env/presentation/Ego31/真人、未迁移/重启原服务、未push/关工单。T03真实组织人工与原生beforeunload/未接入历史遍历/跨平台局限继续保留；本次仅追加审查文档，整体验收待F3修正。

## 附录：F3修复独立复核（2026-10-15）

固定范围 `93cc7a755f2361934ebbea2de92db46b764dc581..488f70dc42ffb4a0c3e9d7f8ad4e0b125b2b8005`，开始HEAD为上界、工作区干净。读取全部五文件差异、F3验收和更新合同，继续同一审查者双轴。结构search/trace/snippet核对EditLink/sameWindowClick，修改文件及正式消费者逐路径coverage均metadata_match/无报告缺口，保持best-effort限制并直接读源码。Context7 Next官方核对onNavigate同步取消和外部replace先于冒泡的实现语义。

**Standards：0项新增。Spec：F3/P2关闭，0项新增。原F1/F2保持关闭，结合全部独立审查及复核，T14可按#15验收。**

### 修复与接入范围

普通a兜底移到document冒泡，尊重消费者处理后的defaultPrevented；EditLink的onClick与onNavigate消费者先有同步取消机会。Next已preventDefault的SPA点击不再重复走兜底；外部replace在Next跳转前、消费者onClick后单独守卫。保留同窗/download/修饰键/hash及sessionIsEnding优先，无定时补跳、popstate回滚或历史哨兵。

已直接核对正式编辑路由：FormDemo的客户端链接采用EditLink，命令式router.push包requestLeave；页面壳品牌/返回账号为保留冒泡的普通a，Provider包住整个壳。没有遗留未经接入的普通Next Link，列表replaceState不注册编辑。因此本次没有用收窄合同掩盖正式消费者保护退化。新项目Next消费者仍必须采用EditLink，原生a需允许事件冒泡；不承诺任意第三方stopPropagation、普通Next Link已发起SPA或异步才决定取消的消费者。原未接入工具栏/原生提示平台边界继续明确。

### 独立实际组件与回归

仅现有checks镜像自有 `t14-f3-review-components`，fixture只读挂测试路由，API_INTERNAL_URL指向不可用本机端口1，DEV。无数据库/凭据/真实身份；Ego自有空间53，先观察DOM，再执行版本化场景。

- `consumerOrdering(page)` **7场景通过**：原F3 onClick、原生a、onNavigate取消各0确认/回调各1次，URL/Prevented draft/dirty保持；普通a与外部replace拒绝各1确认、草稿保持；正常转发拒绝/接受每次仅1确认、onClick累计1→2，接受实际到?forward=1并回Alpha/clean。证据 `test-results/t14-f3-independent-ordering.json`。
- 原 `controlledEditor` **11状态点通过**；`hashLinks`四种hash均0确认/保留Hash draft和dirty；`newerValidation`旧Beta saved后当前空值Required/aria-invalid与就近错误保持、改Gamma清错；`leavingBoundaries`路由/search/外部拒绝各1、download/_blank/Meta零、search接受一次且回已存Beta。证据 `t14-f3-independent-regressions.json`，原F1/F2未回退。
- `forcedEnding(page)` 调用现有真实endSession：dirty且确认策略恒拒绝，仍到 `/login?reason=authorization_changed`，确认次数**0**。这是现有结束机制的组件整合，**不是后台认证、SQL撤权或组织登录验收**；仅自有sessionStorage计数键并已删除。
- 自有Ego53已finish({keep:[]})，未操作其它空间。受控confirm用于验证回调次数/数据与URL，不冒充原生beforeunload弹框显示或外站真实访问。

| 独立容器命令 | 结果/证据（test-results/） |
| --- | --- |
| checks `node --test tests/editor.test.mjs tests/search.test.mjs tests/multiselect.test.mjs tests/list-state.test.mjs tests/presentation.test.mjs` | **36/36，失败/取消/跳过0**；t14-f3-independent-targeted.log |
| checks `npm run typecheck` | API/Web退出0；t14-f3-independent-typecheck.log |
| 自有组件容器 `npm run typecheck --workspace @templux/web` | 含最终fixture退出0；t14-f3-independent-fixture-typecheck.log |
| editor/navigation镜像与宿主SHA256 | 相同、diff退出0；independent-image-hashes.log/source-hashes.log |

没有重复172完整suite、SQL权限矩阵、生产构建/截图；旧172及真实撤权/原生提示证据仍按初审准确源码与执行范围解释。组件和纯控制器不冒充正式业务写入。

自有组件容器已删除，t14-f3-independent-cleanup.log；仅原三服务healthy、API ready/schema0004，未迁移/重启原服务。.env/原presentation/Ego31/真人不动，不push/关票。工作区仅审查附录，本地提交；T03真实组织人工、原生提示/未接入历史/跨平台等局限保留。
