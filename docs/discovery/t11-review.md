# T11 独立审查：统一搜索与响应式只读列表

2026-10-15。审查者：审查。固定范围 `cb81a37b0823540b121b06e0a5a3c6ad455303f7..f8abeffda05985081055a1ff76f19111207200ba`；开始时 HEAD 为范围上界，工作区干净。按 Team 权限由同一独立审查者依次执行 Standards/Spec，不新增成员。

依据：已读取 Gitea Swython/Templux #12/#1、ADR 0001/0012–0015、搜索合同、web-elements、实施计划与开发验收，检查全部23文件差异。采用 code-review、codebase-memory、Context7 与完成前验证流程。结构查询 SearchList → UnifiedSearch/ReadonlyTable/createLatestQuery 经 search/trace/snippet 核对；相关源码、类型、配置、测试和新增文档逐路径 coverage 为 best-effort metadata_match，无报告缺口，另直接读源码。最初误查不存在的 session.tsx，已纠正为 session.ts 并直接读取及检查覆盖；不把不存在路径当覆盖证据。

## Standards

**0项发现，无阻塞。**

- 通用组件位于 `components/elements`，匹配与协调器位于 shared；通用层不引用 examples。示例仅提供独立合成行及内存 Promise，没有业务 API、SQL、认证入口或来源数据；未改部署、迁移、现用呈现文件及 .env。
- `unified-search.tsx:7`、`search-list.tsx:3` 显式要求字段/read、匹配、读取及显示合同，运行时校验字段和搜索设置。`presentation.mjs:19` 的可省分支先补默认再走既有严格 shape 校验，没有吞掉显式非法配置。通用可见文案集中于 elements-copy.json，示例文案在 examples-copy.json，样式采用既有品牌变量。
- 原生 label、搜索输入、button、table/caption/scope表头和可聚焦滚动容器保留键盘语义。未发现本范围需要修复的职责混杂、重复业务逻辑或预留未来业务接口；不把工具已检查的类型/风格重复列为审查问题。

## Spec

**0项发现，无阻塞；T11 可按 #12 验收。**

- `search.mjs:1–3` 对整段输入 trim/lower，任一显式字段包含；不拆词、不搜索未列字段。新项目仍负责真实授权范围、HTTP解码和错误适配，本票未提供虚构业务源。
- `unified-search.tsx:9–19` 默认400ms、合法1–1000ms；清空与Enter立即应用，composition中取消计时，最终值重新计时，转换中Enter及结束后100ms保护。按钮默认隐藏、标签持续显示；长名称在受限宽度内换行。
- `search-list.tsx:6–8` 每个输入意图立即 invalidate 并显示 waiting；同规范化词若有待处理意图仍重新派发。协调器 `latest-query.mjs:1–4` 在成功、错误及异常发布前核对 generation/closed，不仅依赖 AbortSignal。卸载关闭旧实例，清空/重置取消旧结果；abort 不声称远端停止或回滚。
- `readonly-table.tsx:5–8` 区分 waiting/loading/error/forbidden/success-empty，空结果跨全部列并保留表头/搜索。默认没有编辑入口，错误提供显式重试。表最小宽度及局部 overflow 保留全部列，不引入页面横滚。
- `presentation.mjs:19/47/64` 对旧 schema1 缺 search 补400/false，显式 null、部分、错误类型或越界拒绝；API创建、Web布局/示例和管理 config-check/init/start 使用共享读取校验。进程缓存快照保持重启生效，类型由默认JSON推导。认证仍经真实 `/api/protected` 与 SessionGuard，示例不授管理/审计权限。

## 本次独立执行

复用已构建镜像；只创建 auth-database（tmpfs）与 password-api/password-web 工具服务。隔离库迁移结果0008，默认数据库不作迁移。测试显式覆盖 TEST_API_URL/TEST_WEB_URL，TEST_AUTH_DATABASE_URL 指向 templux_auth_test，不回退原运行服务。

| 命令/证据 | 实际结果 |
| --- | --- |
| checks `node apps/api/dist/migrate.js`，DATABASE_URL 显式指向隔离库 | 退出0、0008/applied8；t11-independent-migrate.log |
| checks `node --test --test-concurrency=1 tests/search.test.mjs tests/examples.test.mjs`，显式 password-api/password-web URL | **10/10，fail/cancel/skipped均0**；t11-independent-targeted.log |
| checks `npm run typecheck` | API/Web均退出0；t11-independent-typecheck.log |
| checks sha256sum 与宿主 shasum 对照七个搜索/配置/组件/CSS/测试文件 | 全部相同，diff退出0；t11-independent-image-hashes.log/source-hashes.log |
| 删除自有三个工具容器，compose ps及原 /api/status | 仅原三个服务healthy，原API ready/schema0004；t11-independent-cleanup.log |

专项包括：真实临时HTTP服务器旧慢新快且故意不使用abort；新输入已invalidate但尚未派发时旧HTTP完成也不发布；清空、销毁、错误/forbidden/成功空；整段匹配及显式字段；配置缺省/非法/合法覆盖。真实SQL/密码/CLI/Web部分独立验证普通人员与Agent示例200且管理审计403、匿名307、零角色/Pending拒绝、CLI禁用及logout使旧会话拒绝，真实管理与审计保持可用，无示例表。该10项包含父测试计数，与开发最终专项口径一致。

## 开发证据核对与局限

- 已核对 t11-targeted-final.log、typecheck-complete.log 与 suite-final.log。开发156/156完整回归发生于输入意图等待窗口和长标签CSS修正之前；最终修正源码仅10项专项/typecheck及浏览器证据，**没有声称最终源码完整156项已重跑**。本次亦未重复完整SQL矩阵、Web构建或全浏览器。
- 读取 browser-query/ime/layout/safety/variant/relogin JSON，查看 desktop 与 touch-right 截图：开发前台触发约404/803ms、等待窗口无旧行、五表头/colspan5、390页面宽390/表内容960、键盘和触屏滚到末列、长标签无页面溢出；403/离线留示例，CLI撤权后持续原因重登。浏览器计时、触屏、IME及运行配置变体为**开发执行证据**，本次未重新执行，不以静态截图声称独立验证这些交互。
- 本次独立HTTP专项保护协调器，实际浏览器交互证据由源码和开发材料补足；同规范化词取消后重查及旧异常不发布经路径审查，未另做本次浏览器矩阵。Chromium composition协议不是人工OS候选窗或其它浏览器/输入法验收。忙碌/后台定时器不保证精确1秒，不把触发期限当作网络完成期限。
- 取消不保证远端请求撤销；真实项目须提供字段/匹配/稳定ID、授权范围和状态映射。完整筛选、分页排序、行编辑属于后续票，不列作本票缺陷。T03真实飞书组织人工验收仍未完成，密码/合成源测试不替代该验收；未操作Ego31或真人。
- 本次只新增审查记录及忽略目录证据，本地提交，不推送或关闭工单；不宣称完整首版已经交付。
