# T13 分页、三态排序与刷新恢复验收

2026-10-15。Gitea Swython/Templux #14/#1，基线d5774ea25a145bc7589d215923522f5ccddd42d9，保留37个原本地提交。开发交付，TL另排独立审查。计划[t13-plan](t13-plan.md)，采用合同[分页排序与URL](../specs/pagination-sort-url.md)。

## 实现

- 新增受控Pagination与可选PagedList呈现适配。SearchList原取数/显式搜索/筛选/失效逻辑保持，view仅对完整获授权成功结果排序切片；无view消费者仍只读表。没有业务API、SQL、迁移或认证fixture，公共模块不反向依赖examples。
- 完整总数/记录范围、页位置、首页/上页/有界页码组/下页/末页、每页数量和全部合法页码下拉；默认10与5/10/15/20/25/50。边界禁用，空逻辑1/1、范围0–0，保留5表头/跨列空提示/搜索筛选/数量入口。等待或错误时总数未知而不是假0；禁导航，保留数量入口。
- 项目显式可排字段/比较器和稳定baseCompare，单字段升/降/基础；相等值用基础次序打破并列，不改原数组。示例仅名称/编号有表头按钮，下拉同步aria-sort；排序或大小改变回1。
- page/pageSize/sort由useSearchParams读取，原生replaceState更新；严格正safe integer、合法大小/字段/方向校验，重复取首值再单值规范化，保留其它参数值/hash。总数未知保留合法页，成功后收缩至合法范围；不保存搜索/筛选，不把URL当授权。
- pagination.controls新增可省嵌套分支，旧文件缺省全部true，显式空/部分/错误/未知拒绝。项目可隐藏total/size/edges/pages/jump；已有默认大小仍须属于集合。原presentation文件未改，运行快照/重启语义保持。
- 窄屏≤700上/位置/下直接，其余details可展开；原生键盘/选择、aria-current/aria-sort、44px入口及可见焦点。当前页按钮透明度修正、表头垂直对齐；内嵌搜索短名称不被挤成两行，长名仍换行。最终样式截图已复查。
- 示例53条独立合成记录，保留先前三条，提供53/12/0数据量。搜索/分类先处理完整结果，排序/分页只呈现；重置或刷新恢复数据/输入，地址三项仍按持久合同恢复。不提前做编辑表单。

结构按codebase-memory ready/search/trace/snippet及逐依赖coverage；相关TS/MJS均metadata_match/无报告缺口，best-effort非完整性证明。配置/规范直接读。Context7 Next官方核对native replaceState/useSearchParams集成及导航，React官方核对派生数据直接计算；沿ADR0012/0013及现有品牌变量。

## 容器命令与精确源码回归点

所有命令在仓库根目录，日志保留test-results/t13-*。

| 命令/回归点 | 实际结果 |
| --- | --- |
| 旧checks挂载新tests/list-state.test.mjs | 缺shared/list-state模块红灯；t13-red.log |
| checks挂载shared/tests，node --test tests/list-state.test.mjs | 初始4/4，URL/稳定三态/有界页码/配置；t13-core.log |
| docker compose build api management checks web | 退出0；t13-build.log |
| docker compose up -d --wait auth-database password-api password-web ssr-body-api ssr-body-web | 独立工具服务启动；t13-services.log |
| checks npm test，TEST_API_URL=password-api:8080、TEST_WEB_URL=password-web:3000 | 此回归点165/165，fail/cancel/skipped0，57.6秒；t13-suite.log |
| 后续仅视觉CSS修正并加入真实CLI配置回归，docker compose build web checks | 首次Docker Hub匿名令牌网络超时，原失败保留t13-visual-build.log；正常重试退出0，t13-visual-build-retry.log |
| 仅重建自有password-web，实际浏览器复验新样式 | 退出0；t13-final-web-retry.log、t13-browser-visual-final.json |
| 恢复password-api默认测试Origin后，checks node --test --test-concurrency=1 tests/list-state.test.mjs tests/multiselect.test.mjs tests/search.test.mjs tests/examples.test.mjs | 最终19/19，fail/cancel/skipped0，3.39秒；t13-final-targeted.log |
| docker compose run --rm --no-deps checks npm run typecheck | 最终API/Web退出0；t13-final-typecheck.log |

165发生在后续仅CSS（当前页透明度/表头/搜索标签）及新增CLI配置测试之前。最终19项、typecheck和最终生产浏览器分别覆盖，不将165说成最终扩大测试集166全套重跑。完整点涵盖真实密码/Agent、Feishu隔离协议、授权/审计事务、管理员并发保护、失败限制、持久会话及SSR故障；最终权限专项保持匿名/Pending/零角色/disabled/撤销拒绝、普通人员/Agent示例可用但管理403、真实管理和审计仍通，无示例表。

纯逻辑验证首值/重复/超大/空/负/小数/科学计数参数、未知字段/方向/不在集合大小、总数未知/空/收缩、其它参数/hash保留、三态/稳定并列/不改原数组、有界页码；配置缺controls兼容及显式invalid/default不在集合拒绝。新增真实CLI config-check旧文件/完整5与5/15覆盖退出0，null/空/部分/未知字段退出1，JSON ok与退出码一致且不改文件。新代码无仅字符串断言取代配置入口。

## 实际浏览器（Ego TaskSpace47，已finish）

正常CLI auth-config-probe可信非秘密投影、0600随机人员凭据、明确授user、正常密码表单登录；仅独立0008库和正式password-api/password-web。浏览器公开来源127.0.0.1:31040匹配测试API，所有SQL变更仅隔离身份。没有复用员工/真人凭据。

| 场景 | 可观察证据 |
| --- | --- |
| 默认完整分页及边界 | 53条、默认10、第一页10行；末页6仅151/152/153三条，下一页禁用；上页5首141、再下6、首页1，上页禁用。页码3首121、下拉跳4首131。t13-browser-navigation.json/final.log |
| 大小与全部入口 | 5条选择回1/11页、5行；默认5/10/15/20/25/50由配置产生原生选项；实际普通选择10→5，自有变体另选15。边界/页码组/下拉入口实际操作；没有将仅数字地址变更当作表格已刷新 |
| 排序同步三态/基础 | 在11页点编号新字段升序回1/首101，第二点降序首153，第三点base首101；下拉value和活动th aria-sort同步。下拉名称desc后编号新字段仍先asc；排序改变回1；仅2列按钮，类别等不可排。navigation证据 |
| 地址刷新与历史 | page4/pageSize5/code:desc，刷新首138、5行、相同地址与历史长度；整个分页/排序/大小调整及刷新history.length始终5。地址规范化独立goto新增历史不混入replace计数。navigation证据 |
| 非法/重复/边界 | page999重复page4、size7、evil:desc规范为page6/size10/base且3行，page仅单值，foreign=keep/#part保留；负页/未知方向回1/base、合法size5保留。真实管理API仍403。navigation证据 |
| 数据减少/空 | 53条page6缩至12，地址page2且仅111/112；改0规范page1/1，总数0范围0–0、5表头/colspan5与空说明，数量入口保留。t13-browser-data.json/log |
| 搜索筛选双计时 | alpha后取消展示，451ms waiting/busy=false，1152.5ms正确空；地址仍只三项，不写query/filter。T12 F1修正未被新呈现适配破坏。data证据 |
| 慢旧结果/错误/资格 | 较早alpha源1600ms，新DEMO-102较快；新意图150ms仍waiting/false，约1981ms后仍仅102，不被旧Alpha覆盖，code:desc保持。error/forbidden标题各自正确，总数待读取/页数—，不冒充空。真实审计403保留页面。data证据 |
| 刷新不顺带保存输入 | 仅三项地址仍page1/size5/code:desc；刷新搜索空、分类全部已选、总数53，首153。data证据 |
| 窄屏收纳与键盘 | 390×844，collapsed仅上/位置/下，desktop隐藏；Enter展开、页码Enter到2；原生select End+Tab跳末页，Home+Tab改5并回1，所有11合法跳页可用；编号表头Enter同步升序。t13-browser-responsive.json/final.log |
| 原生触屏 | 下一页一次touchStart/End从2到3，history不变；表内原生手势滚至656，宽304/内容960、5列齐，最后列right346.8≤容器right348.2。页面scrollWidth390，不是把事件发出即当通过。responsive证据 |
| 项目覆盖/隐藏 | 自有t13-variant API/Web、同0008库正常密码登录，默认5、仅5/15；total/edges/pages/jump隐藏，DOM对应节点0，前后页/位置/数量仍可用；改15回1，窄屏展开仍只有5/15。t13-browser-variant.json/log |
| 配置重启快照 | 变体文件改默认15并显示total，不重启重新进无参数页面仍5/无total；只重启自有变体Web后15行、显示total，隐藏jump仍保持。variant证据。变体API独立匹配31042来源/代理主机，不削弱主服务来源校验 |
| 最终视觉与长名 | 当前页opacity1、白字rgb255/底rgb35,100,202；五表头middle，短搜索label高19px单行；1680×1200完整分页bottom1028在视口内。390下超长无空格名称仍页宽390，窄屏展开当前页opacity1。t13-browser-visual-final.json/retry.log |
| 离线与撤销 | 实际离线protected读取失败仍/examples，恢复session200；真实CLI仅撤销本票用户后online检查104ms到login?reason=authorization_changed，不被查询等待或地址同步阻挡。visual-final/relogin JSON及t13-browser-revoke.log |

最终截图t13-pagination-desktop-final.png、t13-pagination-narrow-collapsed-final.png、t13-pagination-narrow-expanded-final.png；桌面和展开窄屏已实际查看，桌面完整控件均可见、当前页对比清楚。初轮截图发现禁用选择器压低当前页透明度，修正选择器；同时对齐排序/普通表头并避免短搜索名被挤折行。未新增风格体系。

本次浏览器脚本test-results/t13-browser-{navigation,data,responsive,variant,visual-final,relogin}.mjs及space.json保留供复核，ego-browser nodejs < 对应脚本运行。重新验收需自有新空间/隔离凭据，不能用已finish的47或真人Ego31。首轮自动化未滚到分页按钮而点击超时，补正常滚动后通过；触屏首轮三次实际只滚631未到656，增加实际手势后到末列；重建Web一次未等ready出现ERR_EMPTY_RESPONSE，等启动后重跑通过。失败日志保留，不作为产品缺陷或通过证据。

## 清理与局限

Ego47已finish({keep:[]})。52份本票日志/JSON/脚本/截图扫描随机密码零命中，t13-secret-scan.json，0600私密目录已删除。自有变体API/Web及password-api/password-web/SSR工具/工具库均删除；t13-variant-cleanup.log、t13-cleanup.log、t13-final-services.json。仅原api/database/web运行，/api/status ready/schema0004、/login200，t13-original-status.json。原0004未迁移/重启，.env/原presentation/真人/Ego31/通知不动；T03真实飞书组织人工仍另列未完成。

平台macOS/Docker Desktop、Linux容器、React19.3/Next16.4、Ego Chromium。前台时间不保证后台调度或网络完成；未声称所有浏览器/输入法/辅助技术/TLS/软键盘矩阵。本票未改IME核心，沿T11已有证据和本票新意图/实际异步回归；没有将其说成人工OS候选窗全测。排序比较器/稳定ID、完整授权读取容量、后台分页与业务权限由项目提供；URL只支持本默认单列表三键，更多列表需明确命名/适配。不引入编辑/表单或业务范围。

仅本地提交、不push/关闭工单，TL安排独立审查。
