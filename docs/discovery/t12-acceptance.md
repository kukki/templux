# T12 整行多选与列表筛选验收

2026-10-15。Gitea Swython/Templux #13/#1，基线 b670a0e2d6c37fd33550272e95787fb698a08112，保留33个已有本地提交。开发交付，独立审查由TL另排。使用合同见 [多选与列表筛选](../specs/multiselect-and-list-filter.md)。

## 实现与边界

- 受控MultiSelect提供显式options/values/名称/变更实现，原生label覆盖checkbox、文字与空白，唯一onChange；选项搜索按label整段trim/lower包含。全选当前结果有原生半选态，仅操作匹配项，隐藏值保持，无匹配提示/禁用全选。
- 基础控件不提交业务。独立ListMultiSelect从全选开始，立即草稿/新意图，停顿默认1000ms或提前关闭应用，无确认；表单/显示字段可独立采用基础控件。SearchList接入一个聚合筛选器，搜索/筛选各自pending，共同取消过期读取；关闭筛选不提交未应用搜索/IME，搜索提交不提前应用筛选。
- 顶层auto popover非模态dialog、字段名称/摘要、原生checkbox键盘、搜索标签，长文本换行/内部滚动/视口边界与resize/scroll定位；Escape/关闭按钮回触发焦点，外部点击保留目标焦点，Tab离开关闭。品牌与设计变量沿既有配置。
- /examples仅合成内存分类和名称/编号组合，没有业务API、表、迁移或模拟认证。正式API/SQL/SessionGuard不变。全选不额外限制，空选无结果；刷新/重置全选且清搜索。loading/waiting/error/forbidden/成功空仍分开，空保留五表头/跨五列说明。
- elements.multiselect可省分支补delayMs1000；完整整数1–1000覆盖，显式null/空/部分/错误类型/越界/未知拒绝。共享loader支持旧文件且不改写；运行进程快照，重启生效。原config/presentation.json、.env与历史迁移未改；新增分支需匹配读取代码，旧镜像不保证识别。

结构探索按codebase-memory ready/search_graph/trace_path/get_code_snippet及逐依赖coverage，相关TS/MJS均metadata_match/无记录缺口，结论为best-effort；配置与规范直接读取。Context7 React官方核对受控checkbox/label与cleanup，MDN核对auto popover顶层、轻关闭和toggle事件。公共elements/shared无examples导入，示例单向使用；T13分页排序未实现。

## 命令与精确源码回归点

所有Docker命令在仓库根目录执行，日志在test-results/（忽略目录，保留供独立审查）。

| 命令/场景 | 实际结果 |
| --- | --- |
| 旧checks+挂载新tests/multiselect.test.mjs运行 | ERR_MODULE_NOT_FOUND，尚无shared/multiselect；t12-red.log |
| checks挂载shared/tests，node --test tests/multiselect.test.mjs tests/search.test.mjs | 初始8/8；t12-core.log |
| docker compose build api management checks web | 退出0；t12-build.log |
| docker compose up -d --wait auth-database password-api password-web ssr-body-api ssr-body-web | 隔离数据库与正式API/Web/SSR工具启动；t12-services.log |
| docker compose run --rm --no-deps -e TEST_API_URL=http://password-api:8080 -e TEST_WEB_URL=http://password-web:3000 checks npm test | 此回归点160/160，fail/cancel/skipped0，58.2秒；t12-suite.log |
| 浏览器发现Escape搜索框边界后，docker compose build web checks，并仅重建password-web | 退出0；t12-escape-build.log、t12-escape-services.log |
| checks挂载当前tests，node --test tests/multiselect.test.mjs tests/search.test.mjs | 含新增真实CLI配置回归9/9；t12-final-logic.log |
| checks npm run typecheck（Escape修正后的构建） | API/Web退出0；t12-final-typecheck.log |
| 浏览器结束后恢复password-api默认测试Origin；checks挂载当前tests，node --test --test-concurrency=1 tests/multiselect.test.mjs tests/search.test.mjs tests/examples.test.mjs，TEST_API_URL/TEST_WEB_URL指隔离服务 | 最终14/14，fail/cancel/skipped0；t12-final-targeted.log、t12-final-http-services.log |

160项发生在后续仅UI Escape修正和增加CLI配置测试之前；最终14项/类型检查及实际浏览器覆盖最终实现，没有声称最终全套161重跑。原有密码/Agent/Feishu隔离协议、最后管理员/授权并发/审计事务、T07失败限制、T05持久会话等在160点贯通；未无关重跑全部配置/物理移除构建矩阵。

纯逻辑覆盖显式唯一选项与选中值、未知/重复值拒绝、中文/整段匹配、隐藏保留/空选、不匹配不操作，以及缺省/完整覆盖/显式非法。真实容器CLI config-check分别读旧文件/600/非法分支，成功0、失败1、JSON ok准确且不改文件。T11实际Node HTTP旧140ms/新10ms、故意不理abort及新意图等待窗口回归仍通过。

最终Web权限专项沿正常CLI随机人员/Agent密码、正式HTTP和SQL0008：匿名/Pending/零角色拒绝示例，普通user与Agent可看；直接管理/审计403；禁用/撤销旧会话拒绝；真实管理员页/账号API/审计可用；没有示例表。没有生产fixture认证入口。

## 实际浏览器（Ego TaskSpace43，已finish）

仅password-api/password-web及0008独立库；CLI auth-config-probe可信非秘密投影、随机普通人员user授权、正常密码表单。凭据文件0600，仅脚本读，不回显。实际浏览器127.0.0.1:31040与API公开Origin一致，测试结束前恢复localhost供HTTP专项。

| 场景 | 观察与证据 |
| --- | --- |
| 鼠标checkbox/文字/空白 | 展示项true→false→true→false，每次change计数恰加1，即时checked变化、waiting且busy=false；最终距末次1002.4ms读取，仅Beta。t12-browser-mouse.json/mouse-escape.log |
| 触屏三热区 | CDP原生touchStart/End，三次分别恰加1且状态翻转；不是只派发事件不检查结果。t12-browser-touch.json/log |
| 键盘与半选 | 原生Space仅1次change，checked翻转且全选indeterminate=true；Enter打开聚焦搜索。Escape带非空选项搜索也关闭并回按钮，搜索词清空；Tab末项离开关闭到列表滚动区，外部点击保留外部checkbox焦点。touch/safety证据及快照 |
| 停顿与提前关闭 | 为隔离自动化命令延迟，用浏览器DOM原生click测试同一提交路径：连续250ms/250ms三次勾选，只触发1次读取，距末次1002.1ms/距首次1506.4ms；同任务内切换后立即点击关闭按钮，3.8ms触发读取，仅Beta，不等1秒。t12-browser-policy.json/policy-final.log |
| 当前结果操作/无匹配 | 搜索展示后全选恢复展示；搜索测试后取消仅测试，展示及8隐藏扩展值均保持；无匹配提示且全选禁用，关闭清搜索。mouse证据 |
| 全不选/组合/重置 | 空选摘要全部未选、成功空标题、5表头和colspan5，搜索/筛选保留；选展示与ALPHA BETA只得Alpha Beta。刷新/重置恢复全部已选/空搜索。mouse/policy/race证据 |
| 异步交错 | 原慢源1600ms；开始后1100ms通过可见checkbox切换分类，1861ms时原结果已可完成但仍waiting、无旧Alpha行且busy=false；新提交/读取完成后alpha+排除展示正确空，约3717ms。t12-browser-race.json/log |
| 错误与真实权限/网络 | 合成error与forbidden各自标题且保留alpha与选择；正式审计请求403仍/examples。CDP离线真实protected请求失败但页面保留，恢复session200。race/safety证据 |
| 窄屏/长文本/滚动 | 390×844，页面scrollWidth390；浮层left26/right378/top6/bottom738.125，width352，长无空格文本换行，scrollHeight935/clientHeight730；原生触屏实际滚205px。t12-browser-touch.json，t12-multiselect-narrow.png |
| 桌面 | 1680×1000，字段、摘要、浮层和只读表沿既有变量；可见焦点与长文本滚动。t12-multiselect-desktop.png，两个截图均已查看 |
| 配置重启快照 | 同一Web镜像、自有t12-variant-web完整公开config挂载，600实测605.3ms；改文件300但不重启仍604.5ms；只重启自有变体后303.7ms。t12-browser-variant.json/log；未改原呈现文件 |
| 正式授权撤销 | 正常CLI authorize --roles none修改仅本票测试人员，online立即检查，撤销后106ms到/login?reason=authorization_changed并持续说明，不受控件等待阻挡；t12-browser-relogin.json/log、t12-browser-revoke.log |

浏览器脚本位于test-results/t12-browser-{mouse,touch,policy,variant,race,safety,relogin}.mjs，命令ego-browser nodejs < 对应脚本，读其中TaskSpace43为本次实例；重新验收需在自有新任务空间和隔离正式身份重走登录后替换实例ID，不能操作真人空间。计时使用DOM change/beforetoggle/aria-busy事件时钟，不把自动化请求延迟或网络完成混入。

最初观测脚本误等不存在的data-row，以及从多次勾选中取首个读取时钟，分别超时/负差；修正观察，不改产品逻辑。其后真实复现原生search框Escape只清空不关浮层，已明确处理Escape（组合输入取消仍交浏览器）并重新构建/完整相关行为复验。全不选脚本最初假定半选而连续点两次导致全选，改为按可见checked判断；失败日志保留，不掩盖为通过。

## 清理、局限与交付

48份本票日志/JSON/脚本/截图按随机测试密码扫描零命中，t12-secret-scan.json；0600私密目录已删除。Ego43 finish({keep:[]})结束。自有变体/隔离API/Web/SSR/工具库均删除；t12-cleanup.log、t12-variant-cleanup.log、t12-final-services.json。仅原api/database/web仍运行，/api/status ready/schema0004，/login200，t12-original-status.json。.env/原presentation/真人/Ego31/通知与迁移历史保持，T03真人组织人工验收仍未完成、另列。

平台macOS/Docker Desktop、Linux容器、Ego Chromium；非所有浏览器/辅助技术/旧Popover不支持版本/软键盘/后台计时矩阵。IME核心组件未改，沿T11浏览器实际composition验收与本票HTTP/意图竞态回归，不把本票声称重新跑人工OS候选窗。浏览器前台定时器可能受调度延迟，1秒是应用触发目标，不保证网络完成。多筛选器采用者需聚合提交；选项集变更需明确重挂载或迁移选中值。业务后台授权/来源/字段/分页由新项目实现；本票不新增业务范围或生产测试服务。

仅本地提交，不push/关闭工单，TL安排独立审查。
