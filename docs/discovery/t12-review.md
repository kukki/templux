# T12 独立审查：多选热区与列表筛选时机

2026-10-15，审查者：审查。范围 `b670a0e2d6c37fd33550272e95787fb698a08112..b544e1b3f423dbe475137cef78d4c8f58b28c0eb`，开始时HEAD为上界、工作区干净。按Team权限同一审查者依次执行Standards/Spec，不新增成员，不改实现。

依据Gitea #13与已读取父规格#1、ADR0012/0013、搜索合同、multiselect-and-list-filter、web-elements、T12计划/验收及全部18文件差异。应用code-review、codebase-memory、Context7及完成前验证流程。结构search/trace/snippet核对ListMultiSelect→MultiSelect及SearchList，相关改动及依赖逐路径coverage均metadata_match、无报告缺口；best-effort不是完整性证明，另直接读源码/配置/测试。Context7 React官方核对受控checked/onChange/label；MDN核对auto popover轻关闭与toggle事件合并。

## Standards

**0项发现。** 通用elements/shared单向供examples采用，无反向示例依赖；基础受控组件与列表提交时机分离，显式选项和值校验，原生label只由checkbox onChange切换，没有重复行toggle。可见文案集中，沿品牌变量、名称、焦点与原生键盘语义。新增配置仍走共享严格shape/范围校验，不改原文件；没有业务API、表、迁移或认证fixture。未发现本范围需要修复的职责混杂或额外未来业务接口，不重复报告工具已检查的类型问题。

## Spec

**1项P3，F1；无权限或最终结果正确性阻塞。** TL已决定本票内最小修正，修正后应定向复核再记录完整通过结论。

### F1（P3）：另一筛选器仍待应用时，搜索提交提前呈现“正在读取”

- **位置**：`apps/web/app/components/elements/search-list.tsx:7`，对照读取启动条件`:6`。
- **触发**：默认搜索400ms、筛选1000ms。输入alpha，迅速打开分类并取消展示，保持浮层开启；搜索计时先到，分类仍在待应用窗口。搜索apply无条件setState(loading)，但effect因filterPending为true不调用active.run。
- **独立实际复现**：复用最终Web镜像、0008隔离SQL库，通过CLI创建零角色人员、显式授user、正常密码表单登录，Ego自有TaskSpace44。page.fill搜索，再可见触发按钮与展示checkbox的DOM原生click；取消展示后**452.6ms**标题“正在读取”、aria-busy=true；**1155.2ms**最终“没有匹配记录”、busy=false。证据 `test-results/t12-independent-combined-state.json`。这是搜索/筛选交错的短暂状态不准，最终alpha+排除展示结果正确，没有发现权限变化或卡住。
- **依据/影响**：合同将waiting与loading分开，任一未应用意图仍在等待；此窗口实际尚未启动新的源读取，却对视觉及辅助技术呈现读取中。结果取消/generation保护仍有效，不误报为过期结果覆盖、额外授权或错误空结果。
- **建议**：搜索提交后若filterPending仍为true保留waiting，只有真正run读取时置loading；补搜索先到、筛选后到的真实组件回归，观察中间waiting/busy=false和最终合并结果。基础组件时机与筛选条件提交无需改变。
- **证据限制**：本次没有记录闭包load调用计数或内部pending时间戳；“没有启动读取”的原因来自`:6`的明确条件，不把aria-busy当作实际调用计数。首次实证后按TL最新指令收尾；准备中的额外计数复核取消，未再创建浏览器空间。

### 其余核对

- `multi-select.tsx:5–10/25–27` 校验显式唯一options/values，按label整段搜索；全选当前结果仅操作可见值，隐藏保留、半选、无匹配禁用；稳定value不依赖名称。`multiselect.mjs:7`保留声明顺序，空值不解释为全部。
- `multi-select.tsx:20–23` 原生auto popover、开关状态、打开聚焦搜索、Escape非composition时明确关闭/回触发焦点、关闭清词；外部点击及Tab离开关闭。热区无重复toggle，长文本换行、浮层视口定位及内容滚动。旧Popover不支持版本未声称兼容。
- `list-multi-select.tsx:5–9` 草稿即时显示、每次变更新意图、停顿只提交末次值，关闭取消timer并提交dirty值，无confirm；干净关闭不重复、卸载不悄悄提交，不强加基础表单。
- SearchList搜索和筛选分别pending、共同invalidate旧任务，最新筛选load回调与query提交结合，均完成后读取最新term/筛选；晚成功/异常由generation/closed保护。示例全选无额外限制、全空无结果，合成分类与名称编号匹配不作为后台授权。
- `presentation.mjs:20/50` 缺multiselect补1000，整数1–1000、显式null/空/类型/未知字段/越界拒绝；共享API/Web/CLI校验、进程快照及重启生效。原文件不改写，新增分支不承诺旧镜像可读。

## 独立验证与开发证据

| 本次独立执行 | 结果/证据（test-results/） |
| --- | --- |
| checks迁移，DATABASE_URL明确指向templux_auth_test；仅auth-database/password-api/password-web | schema0008；t12-independent-migrate.log |
| checks挂载当前tests，显式TEST_API_URL=password-api、TEST_WEB_URL=password-web，`node --test --test-concurrency=1 tests/multiselect.test.mjs tests/search.test.mjs tests/examples.test.mjs` | **14/14，fail/cancel/skipped0**；t12-independent-targeted.log |
| checks `npm run typecheck` | API/Web退出0；t12-independent-typecheck.log |
| 五个组件/共享配置与匹配文件镜像、宿主SHA256对照 | 全相同、diff退出0；t12-independent-image-hashes.log/source-hashes.log |
| 正常CLI密码人员及真实浏览器交错状态 | F1实证如上，独立执行；受限凭据未打印，随后删除 |

14项覆盖选项/选择校验、隐藏选择/中文/整段匹配、配置缺省/非法、真实CLI config-check成功0失败1/JSON且不改文件；实际HTTP旧慢新快和新意图等待窗口；真实SQL/密码/CLI/Web示例权限、人员/Agent许可但管理审计403、匿名/零角色/Pending/禁用/撤销拒绝，真实管理与审计可用，无示例表。

已核对开发t12-final-targeted.log/typecheck及早期suite.log：**160/160发生于Escape修正与新增CLI测试之前，不是最终161项全套**；最终源码仅14项专项/typecheck及浏览器。本次不重复完整构建、全SQL矩阵或全浏览器。

开发mouse/touch/policy/race/safety/variant/relogin JSON及相应脚本已核对，desktop/narrow截图已查看：三热区每次恰1change、Space半选、非空搜索Escape/Tab/外部焦点、末次约1002ms与关闭3.8ms、隐藏项/成功空5表头、晚结果不发布、403/离线保留、窄屏352浮层/长文本/触屏滚动、600→未重启仍600→重启300、撤权即时重登。上述全面交互/配置变体为**开发执行证据**，本次独立浏览器仅F1，不冒充全部重跑。

## 清理与局限

TaskSpace44已finish({keep:[]})，自有凭据目录及三个工具服务删除。补充计数准备因TL最新收尾指令取消，准备阶段仅新建同隔离工具服务并再次删除，未新建第二浏览器空间；t12-followup-cleanup.log。原三个服务仍healthy，原API ready/schema0004，无迁移/重启。.env/原presentation/真人/Ego31/实现保持，不push/关闭工单。

前台浏览器计时不保证后台精确1秒或网络完成；本票沿T11composition证据，未重跑人工OS候选窗。未验收全部浏览器、旧Popover、软键盘、辅助技术、TLS或宿主矩阵。多筛选器仍由采用者聚合提交，动态选项须迁移值或重挂载；真实后台授权/来源/字段/分页由项目提供。T03真实飞书组织人工仍未完成且另列，不被密码测试替代；后续分页排序不列作T12缺陷。

## 附录：F1/P3 修复独立复核（2026-10-15）

固定范围 `4fda286b674ec895ba5247a2d62d4466aff23ede..551c80a72efba1e206228dc3916d27dc377f34bc`；恢复任务时HEAD仍为上界且工作区干净。读取修复验收、合同补充、全部五文件差异及新fixture/scenario。初审历史保留。

**Standards：0项新增发现。Spec：F1关闭，0项新增发现。结合初审与本次复核，T12可按#13验收。**

产品唯一修改删除SearchList.apply提前setState(loading)；搜索提交仍更新term/revision、invalidate，另一条件pending时保留原waiting。实际effect获准run时由createLatestQuery发布loading。默认400/1000、提前关闭、独立pending、取消/generation/closed及正式身份处理未改变。结构search→trace→snippet核对协调器，修复、fixture/scenario、依赖及Dockerfile等coverage均metadata_match/无报告缺口，结论保持best-effort，并直接读取。

### 本次独立实际组件验证

只新建 `t12-review-components` 自有checks容器，用现有镜像/源文件挂载运行Next dev，fixture仅挂到该容器的app/t12-component/page.tsx；仅测试next.config允许127.0.0.1开发资源。没有改原部署/Next配置，没有建测试数据库。按既有ego-browser流程新建自有TaskSpace46，先观察DOM，然后导入版本化 `tests/scenarios/search-filter-browser.mjs`，执行 `combinedState(page)` 和 `directCases(page)`；全部断言通过。

| 场景 | 独立实际观察（load为本轮增量） |
| --- | --- |
| 双计时交错 | 452.8ms waiting/busy=false/load0；1101.4ms loading/true/load1，term alpha、selected test；完成后正确空/false |
| 仅搜索 | 452.8ms loading/true/load1，alpha/全选；完成Alpha/false |
| 仅筛选 | 452.4ms waiting/false/0；1101.8ms loading/true/1，空搜索/test；完成正确空 |
| 500ms提前关闭 | 452.9ms waiting/false/0；651.2ms已loading/true/1，alpha/test；完成正确空，不等1000ms |
| 旧成功迟到 | 702.3ms仍waiting/false/新增0，没有旧成功发布；1100.8ms新load1；完成正确空 |
| 旧错误迟到 | 701.4ms仍waiting/false/新增0，没有旧错误发布；1101.3ms新load1；完成正确空 |

证据 `test-results/t12-fix-independent-components.json`。实际load入口向DOM output记录id/term/selected/time；StrictMode初始两个调用先作为基数，断言本轮增量，不以aria-busy倒推计数。fixture的可控Promise故意忽略abort，旧请求仍实际活动并由测试按钮成功/失败结束；因此迟到用例检查发布保护而非只检查abort调用。这里是实际React组件/合成Promise，**不是正式业务HTTP或SQL调用次数**。初审的452.6ms错误状态在本轮相同边界已改为waiting。

### 其它独立执行及证据边界

- checks `node --test tests/multiselect.test.mjs tests/search.test.mjs` **9/9，fail/cancel/skipped0**，包括实际HTTP过期响应和真实容器CLI配置入口；t12-fix-independent-logic.log。
- checks `npm run typecheck` API/Web退出0；自有组件容器 `npm run typecheck --workspace @templux/web` 含挂载fixture亦退出0；independent-typecheck.log、independent-fixture-typecheck.log。
- 单独启动最终生产Web镜像自有 `t12-review-production`（31044），HTTP `/t12-component` **404**。Dockerfile生产仅复制编译Web、运行模块/shared/config，apps中没有fixture/scenario入口引用；测试页仅靠自有开发容器显式挂载，不能形成生产认证或业务旁路。
- 已核对开发 red/green/components、targeted/typecheck及production-browser证据：开发修复后14/14正式隔离0008/API/Web、正常密码生产页面453ms waiting→1004ms实际读取状态→1088ms正确空且测试页404。本次复用该正式身份回归证据，**没有独立重跑14项权限矩阵/生产密码页或完整suite**；一行UI修复风险已由独立六组件场景、9项逻辑与类型检查覆盖，不重复无关SQL/构建/截图。

TaskSpace46已finish({keep:[]})，自有两个容器删除；t12-fix-independent-cleanup.log。仅原api/database/web仍healthy，原API ready/schema0004，无数据库迁移或原服务重启；未改.env/presentation/真人/Ego31、未push/关工单。T03真实人工、前台计时、OS输入法/旧Popover/跨平台/TLS等初审局限继续保留。首次恢复前的额度暂停没有产生实现修改，本附录为恢复后的实际执行结果。
