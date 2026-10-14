# T11 统一搜索与响应式只读列表验收

2026-10-15。Gitea Swython/Templux #12/#1，基线cb81a37b0823540b121b06e0a5a3c6ad455303f7，保留31个原本地提交。开发验收，独立审查由TL另排。合同：[搜索与只读列表](../specs/search-and-readonly-list.md)。

## 实现边界

通用UnifiedSearch/ReadonlyTable/SearchList及样式位于components/elements，纯匹配/异步协调位于shared；不import示例。fields/read、matches、load、列/稳定ID和名称提示显式必填，无默认全字段或业务API。整段trim/lower、任一指定字段包含，不按空格拆词。默认400ms、按钮隐藏；清空/Enter立即，IME组合不查、提交后重计时，转换中Enter及结束后100ms保护避免误提交。

新输入意图立即使旧请求失效，含debounce等待、IME开始/提交、清空、销毁；版本/取消/关闭共同保护，即使source不理abort也不覆盖。等待输入与实际读取分开；success-empty、loading、error、forbidden不混同。成功空跨五列标题说明，保留表头/搜索与上层控件；默认只读，无表内编辑入口。

受保护/examples沿真实认证/SQL/SessionGuard，仅新增独立合成五列表及内存异步情景，不增加产品业务API/SQL表或认证fixture，不实现完整筛选/分页排序/表单。elements.search为可省schema1分支，缺省补400/false，显式空/部分/非法拒绝；原config/presentation.json与.env未修改。新分支需要本票读取代码，不声称旧镜像能识别未知配置。

结构按codebase-memory search/trace/snippet及逐依赖coverage（best-effort，metadata_match/无报告缺口），配置/规范直接读；Context7 React官方核对composition、lazy state及异步cleanup。沿品牌变量及原生键盘、语义表头/状态与可聚焦滚动容器。

## 容器命令和回归点

| 命令/场景 | 实际结果（test-results/） |
| --- | --- |
| 旧Web+新tests/examples.test.mjs真实HTTP | 缺unified-search/只读表，红灯；t11-red.log |
| docker compose build api management checks web | 退出0；t11-build.log |
| checks node --test --test-concurrency=1 tests/search.test.mjs tests/examples.test.mjs | 初始9/9；t11-targeted.log |
| checks npm test，TEST_API_URL=password-api、TEST_WEB_URL=password-web，独立0008及SSR工具 | 回归点156/156，fail/cancel/skipped0，约58秒；t11-suite-final.log |
| 补新意图等待窗口回归后，重建web/checks并执行同两项专项 | 最终10/10，fail/cancel/skipped0；t11-targeted-final.log |
| 最终组件/响应式构建 docker compose build web checks | 退出0；t11-final-build.log、t11-responsive-build.log |
| checks npm run typecheck | 最后API/Web退出0；t11-typecheck-complete.log |

完整回归第一次因测试配置切换过早：测试用localhost Origin而API已改浏览器127.0.0.1，真实同源检查返回403导致5项失败；t11-suite.log保留。恢复测试来源后完整156通过；此后再切浏览器环境，不削弱同源校验。

156回归发生于后续T11输入意图等待窗口及长标签CSS修正之前。后两项仅影响本票UI/状态，最终10项专项、typecheck和深度实际浏览器分别覆盖，未将此前156宣称为最终源码重新跑过的157项，也未无关重复整套昂贵SQL矩阵。

## 语义、真实HTTP与配置

- 明确名称/编号字段，混合大小写/trim/空词匹配；alpha demo不跨字段拆词，未指定hidden不搜索；空字段、缺读取、重复key拒绝。
- actual Node HTTP测试源仅在测试容器进程127.0.0.1:随机端口：旧140ms、新10ms且故意忽略abort，实际收到两请求，最终只发布new。新输入意图先invalidate、尚未dispatch新请求时，旧已完成结果仍不发布；再派发新词后正常成功。清空替换、销毁、错误/forbidden/成功空分别测试。没有生产测试服务或固定业务接口。
- 旧呈现缺search补默认，null/空对象/部分字段/类型错/越界拒绝，完整800/true覆盖成功；共享loader同时用于前后端与初始化，既有CLI/启动配置回归在156项中执行。旧项目文件不重写。
- 正常Web专项沿CLI创建/授权、随机密码登录、真实SQL/SSR：普通人员/Agent可看样例，管理/审计403；零角色/Pending拒绝，禁用/撤销旧会话拒绝，管理员真实账号和审计仍200。没有示例表。

## 实际浏览器（Ego TaskSpace42）

仅独立password-api/password-web及0008测试库，正常CLI随机测试人员/授user、正常密码表单，匹配127.0.0.1:31040公开来源；auth-config-probe提供隔离非秘密投影，未手填布尔绕过。受限0600文件只供脚本填写，不打印。

| 案例 | 可观察结果与证据 |
| --- | --- |
| 停顿触发与语义 | 原生输入混合大小写整段词，实际aria-busy触发404.4ms，匹配Alpha Beta；未指定“展示”列不参与；t11-browser-query.json |
| 空/清空/Enter/只读 | 空保留query alpha demo、五表头、colspan5及标题说明；清空恢复3行，Enter查编号成功；表内编辑控件0，默认搜索按钮0，显式显示成功 |
| 旧结果等待窗口 | 较早查询延迟1600ms，1400ms后新输入，再观察250ms；仍“等待输入完成”，没有旧Alpha行，之后只显示新编号结果 |
| 加载/错误/无资格 | 慢读取先显示正在读取；失败/无资格分别标题且保留输入，不是假空，不跳登录；上述query证据 |
| 中文组合 | Chromium原生Input.imeSetComposition，文本中间态“中”保持1100ms仍waiting/busyfalse，组合中Enter未提交；最终“中文”仅匹配中文样例；t11-browser-ime.json |
| 布局/键盘/触屏 | 桌面1680，表1010/内容1010、五列齐；390页面scrollWidth390，表304/内容960，键盘ArrowRight实际滚8px，原生touch拖到656，最后列完整可见；t11-browser-layout.json |
| 长字段标签 | 复现超长无空格标签使390页宽变2527，补max-width/换行后同输入页宽390；t11-browser-safety.json。非默认短名截图不作像素门禁 |
| 真实403/离线 | 普通账号真实审计403；CDP离线后实际protected请求失败，页面保持/examples，恢复后session200，无误退出；safety证据 |
| 运行配置变体 | 同镜像、独立公开config挂载800/true，默认按钮显示、触发803.4ms；t11-browser-variant.json。变体初次缺运行auth-copy导致/login500，补完整公开config并仅重启该自有容器后/login200；t11-variant-login.json |
| 慢读取时授权撤销 | 正常CLI authorize --roles none修改本票人员；online立即检查后1185ms（含CLI执行）到login?reason=authorization_changed，早于1600ms读取完成，不等查询；t11-browser-relogin.json/revoke.log |

截图t11-list-desktop.png、t11-list-narrow.png、t11-list-touch-right.png均已查看：主题一致，窄屏仅表内横滚，全部五列保留。TaskSpace42已finish关闭，没有操作Ego31。

最后撤销测试初次误用空--roles被既有CLI明确拒绝；改用真实合同none成功，不改产品CLI。新增情景及故障均用合成数据，未接来源业务或真实人员。

## 清理与局限

35份T11日志/JSON扫描单个随机测试密码零泄露，t11-secret-scan.json；0600私密文件随后删除。自有变体Web和工具库/API/Web/SSR均删除，只有原api/database/web仍运行；t11-cleanup.log、variant-cleanup.log、final-services.json。原/api/status ready/schema0004，/login200，t11-original-status.json；.env、真人/Ego31/通知/历史迁移不动，T03真人组织人工仍另列未完成。

平台macOS/Docker Desktop、Linux容器、Ego Chromium。IME是实际浏览器composition协议而非人工OS候选窗全流程，不代替其它浏览器/输入法/宿主及TLS/组织矩阵。定时器受后台/忙碌调度影响，不承诺网络完成1秒；已测前台400/800触发。真实项目必须提供授权范围、字段/解码/匹配与HTTP错误适配；本模板没有虚构生产业务API。取消不保证远端停止或回滚；只读组件不接写操作。

仅本地提交、不push/关闭工单，TL另排独立审查。
