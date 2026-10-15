# T13 独立审查：分页、三态排序与URL恢复

2026-10-15，审查者：审查。固定范围 `d5774ea25a145bc7589d215923522f5ccddd42d9..b91310b61ab5ff902e74e48659931951bf686b8a`；开始时HEAD为上界、工作区干净。同一独立审查者按Team权限依次执行Standards/Spec，不新增成员。

依据Gitea #14及已读取父规格#1、ADR0012/0013、pagination-sort-url、web-elements、T13计划/验收，审查全部21文件差异。使用code-review、codebase-memory、Context7及完成前验证流程。结构search→trace→snippet核对PagedList/Pagination与纯helper；改动21文件coverage均metadata_match/无报告缺口，best-effort不是完整性证明，另直接读源码、配置、测试与文档。Context7 Next官方确认原生pushState/replaceState与useSearchParams/usePathname同步；实现没有伪造框架私有history字段。

## Standards

**0项发现，无阻塞。**

- Pagination为受控呈现，PagedList负责URL派生/排序切片，纯语义集中shared/list-state；SearchList仅可选接入view，通用层没有反向导入examples。新示例53条为独立合成记录，没有业务API/SQL/认证fixture、迁移或来源数据。
- 显式排序字段/比较器、稳定基础次序、可见列校验，复制数组后排序；运行时校验没有仅依赖类型。分页与可选入口仍走共享严格配置校验，既有项目缺controls补默认、显式错误拒绝，不改原文件。
- 通用文案集中elements-copy，采用既有品牌变量；原生button/select/details、label、aria-current/aria-sort、可见焦点及表内滚动保持。未发现需修复的职责混杂、重复业务逻辑或未来业务接口；不重复报告工具已检查的类型/风格项。

## Spec

**0项发现，无阻塞；T13可按#14验收。**

- `pagination.tsx:3–11` 默认配置10及5/10/15/20/25/50，完整总数/范围/页位置/首页上页页码组下页末页/合法页码下拉，边界禁用；成功0条为0–0、1/1，未知总数显示待读取/—而非假0。数量入口在未知总数仍可用，导航禁用。可选controls只隐藏入口，不改变解析/权限。
- `paged-list.tsx:5–12` 总数只从成功完整结果派生，未完成保留合法URL页；成功后clamp处理53→12→0。显示行与规范化current由同一解析结果计算，空保留表头/跨列说明和上层搜索筛选。
- `list-state.mjs:4–20` 显式单字段/有限比较器、三态循环及相等值baseCompare，基础模式也按稳定基础次序，原数组不变。排序/大小变化回1；表头和下拉共用current.sort，仅明确字段有按钮，普通列不可排。
- `list-state.mjs:5–13` 严格正整数/safe integer、合法大小/字段方向；重复按合同取首值再写单值，非法各自回默认。write只改page/pageSize/sort，保留foreign参数/hash，不保存搜索/分类。`paged-list.tsx:8–9` 使用replaceState不push，useSearchParams对地址变化重新派生。默认单列表合同明确，多个列表/后台分页需项目适配，不作为授权。
- SearchList原取数、独立pending及立即invalidate保持，PagedList只显示当前state；没有第二条取数通道，没有恢复T12提前loading问题。错误/无资格与空分开，401仍沿既有SessionGuard；URL不能使人员或Agent绕过真实后端检查。
- 窄屏≤700直接上/位置/下，其余details展开；全列仅容器横滚。controls缺省与显式invalid、项目默认属于合法集合、进程快照/重启合同保持。没有把后续编辑/表单算作本票缺失。

## 本次独立实际验证

复用已构建镜像，仅创建auth-database tmpfs与password-api/password-web工具服务。迁移DATABASE_URL明确指向templux_auth_test得到0008；TEST_API_URL/TEST_WEB_URL明确覆盖隔离服务，不回退原部署。

| 命令/证据（test-results/） | 实际结果 |
| --- | --- |
| checks `node apps/api/dist/migrate.js`，隔离DATABASE_URL | 退出0、0008/applied8；t13-independent-migrate.log |
| checks挂载当前tests，`node --test --test-concurrency=1 tests/list-state.test.mjs tests/multiselect.test.mjs tests/search.test.mjs tests/examples.test.mjs` | **19/19，fail/cancel/skipped0**；t13-independent-targeted.log |
| checks `npm run typecheck` | API/Web退出0；t13-independent-typecheck.log |
| list-state/presentation/PagedList/Pagination/CSS五文件镜像与宿主SHA256对照 | 全相同、diff退出0；t13-independent-image-hashes.log/source-hashes.log |
| 删除自有三个工具服务、compose ps、原/api/status | 仅原三服务healthy，ready/schema0004；t13-independent-cleanup.log |

19项包括严格URL/重复/收缩/空、foreign/hash保留、三态/并列基础次序/不变原数组、有界页码组、配置缺省/非法/覆盖、真实CLI config-check退出码与不改写；多选/搜索及真实临时HTTP旧慢新快/意图等待窗口。真实SQL/CLI/密码/HTTP/Web部分验证匿名/Pending/零角色/禁用/撤销拒绝、普通人员/Agent示例许可且管理审计403、真实管理/审计可用，无示例表。专项中的helper不冒充独立浏览器分页点击或刷新验证。

## 开发证据核对与局限

- 开发t13-suite.log的**165/165在最终CSS/标签修正和新增CLI测试之前**；最终19项、typecheck及Web/checks构建证据另列，没有将旧165冒充最终166全套。本次未重跑完整suite/构建/全浏览器矩阵。
- 已读取navigation/data/responsive/variant/visual-final/relogin JSON，查看最终desktop与narrow-expanded截图：分页全入口与首尾、排序表头/下拉三态、page4/size5/desc刷新首138且history长度保持、重复非法URL及foreign/hash、53→12→0、T12等待/迟到保护、未知总数错误/403、390页面不溢出/表内656横滚、键盘与原生触屏、5/15配置隐藏和重启快照、撤权104ms持续原因重登。上述交互与变体为**已核对开发执行证据**；本次独立执行限上表，不声称复跑这些浏览器行为。
- popstate/路由生命周期依赖官方Next原生history集成和重新读取search params，已源码/文档核对；没有另执行独立Back/Forward/复杂路由矩阵。多列表争键、超大完整数据容量与全部合法页码下拉的规模由项目明确控制；这里不是服务器分页或虚构业务数据验收。
- T03真实飞书组织人工仍未完成，密码/隔离协议不替代；未操作Ego31或真人。前台计时不保证后台精确或网络完成，未声称所有OS输入法/旧浏览器/辅助技术/TLS/软键盘/宿主矩阵。真实授权读取、比较器/稳定ID、分页数据量及业务范围由项目提供。
- 原0004服务未迁移/重启，.env/现用presentation/实现及真人权限不动；本次只新增审查文档和忽略目录证据，本地提交，不push/关闭工单，不宣称完整首版已交付。
