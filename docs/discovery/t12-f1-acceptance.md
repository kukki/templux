# T12 F1 双计时等待状态修复验收

2026-10-15，基线4fda286b674ec895ba5247a2d62d4466aff23ede。依据TL任务、[初审原记录](t12-review.md)及t12-independent-combined-state.json。保留初审历史，本记录为开发修复证据，独立定向复核另排。

## 定位与修正

按receiving-code-review/systematic-debugging先核验。SearchList搜索apply在400ms时无条件标记loading，effect却在filterPending仍true时不run。隔离真实组件/可控Promise源复现：451.5ms显示正在读取/busy=true，但本轮load增量为0；1100.2ms采样可见一次新load，最后结果正确空。证据test-results/t12-fix-red.json；确认是状态不准，没有权限或最终结果故障。

最小产品修改仅移除SearchList.apply提前setState(loading)。搜索/筛选新意图原有waiting、invalidate、独立pending与计时保持；真正run时由createLatestQuery发布loading，不再在另一个条件仍待应用时冒充读取。默认400/1000、关闭提交、源/匹配、取消/generation/closed保护、身份处理均未改变。

结构使用codebase-memory ready/search→trace→snippet，SearchList/ListMultiSelect/UnifiedSearch/latest-query逐文件coverage均metadata_match、无记录缺口，best-effort非完整性证明；直接核对源码。Context7 React官方核对effect启动/cleanup防迟到，Next官方核对隔离dev CLI webpack/hostname/port。没有数据库对象或迁移变更。

## 可重复真实组件回归

新增tests/fixtures/search-filter-page.tsx：只在自有checks开发容器挂载到app/t12-component/page.tsx，复用实际SearchList、UnifiedSearch、ListMultiSelect、ReadonlyTable及协调器。load入口记录公开DOM output中的id/term/选中值/performance时间；Promise由测试按钮成功/失败结束，故意不理AbortSignal。不读账号/数据库，不提供登录或业务能力。测试文件在tests之外没有入口/import，生产Web对/t12-component实际404。

新增tests/scenarios/search-filter-browser.mjs供Ego Node导入，combinedState(page)和directCases(page)执行实际组件DOM交互与断言，不看React私有状态。只需在自有空间传page，默认地址127.0.0.1:31043。red调用combinedState(page,{expectWaiting:false})；最终默认断言waiting。

容器启动（仓库根目录；先准备test-results/t12-fix-route/next.config.ts，仅poweredByHeader:false及allowedDevOrigins:['127.0.0.1']，不改实际next.config）：

```sh
docker run -d --name t12-fix-components -p 127.0.0.1:31043:3000 \
  -e TEMPLUX_CONFIG_PATH=/opt/templux/config/presentation.json \
  -v "$PWD/apps/web/app/components/elements/search-list.tsx:/opt/templux/apps/web/app/components/elements/search-list.tsx:ro" \
  -v "$PWD/tests/fixtures/search-filter-page.tsx:/opt/templux/apps/web/app/t12-component/page.tsx:ro" \
  -v "$PWD/test-results/t12-fix-route/next.config.ts:/opt/templux/apps/web/next.config.ts:ro" \
  templux-checks node_modules/.bin/next dev apps/web --webpack --hostname 0.0.0.0 --port 3000
```

修正后重建自有组件容器以清编译缓存，再同一Ego45页运行；未假定单文件bind mount能触发dev重编译。

| 实际组件场景 | 观测（时间自本轮筛选/测试起点） |
| --- | --- |
| 搜索400ms先到、筛选1000ms后到 | 452.2ms waiting/busy=false/load增量0；1101.5ms loading/busy=true/增量1，term alpha、selected test；手动完成后正确success-empty/busy=false。t12-fix-green.json |
| 仅搜索 | 452.1ms loading/true/增量1，alpha且全选；完成后Alpha，busy=false |
| 仅筛选 | 451.3ms waiting/false/0；1101.2ms loading/true/1，空搜索且排除展示；完成正确空 |
| 提前关闭 | 452.1ms waiting/false/0；500ms点击关闭，652.2ms已loading/true/1，alpha与排除展示；不等1000ms，完成正确空 |
| 旧成功迟到 | 新意图后500ms结束旧成功，700.7ms仍waiting/false/新增0，无旧Alpha；1102.2ms新load恰1，完成正确空 |
| 旧错误迟到 | 500ms让旧Promise reject，703ms仍waiting/false/新增0，无旧error；1101.9ms新load恰1，完成正确空 |

后五项在t12-fix-components.json，均通过版本化脚本断言。计数来自实际load入口的DOM记录，不从aria-busy倒推。开发StrictMode初始effect可重复，先记录初始基数，本表只报本轮增量；新合并条件仅一次。这里的load是受控合成Promise，不冒称真实业务HTTP请求数或SQL查询次数。旧结果测试保留真正活动旧源并忽略abort，再结束它，验证新意图取消后仍拒绝迟到成功/错误。

观测初期dev资源来源策略阻止hydration，增加仅测试容器allowedDevOrigins；刚启动一次ERR_EMPTY_RESPONSE后等ready重试；单文件挂载未触发热编译导致第一次green仍跑旧编译，直接核对容器源后重建自有组件容器，最终red/green如上。不把这些测试环境问题当产品修正或成功证据。

## 构建、专项与生产模式浏览器

| 命令 | 结果/日志（test-results/） |
| --- | --- |
| docker compose build web checks | 退出0；t12-fix-build.log |
| docker exec t12-fix-components npm run typecheck --workspace @templux/web | 含挂载测试页退出0；t12-fix-fixture-typecheck.log |
| docker compose up -d --wait auth-database password-api password-web | 仅隔离工具服务；t12-fix-services.log |
| checks node --test --test-concurrency=1 tests/multiselect.test.mjs tests/search.test.mjs tests/examples.test.mjs，TEST_API_URL=password-api:8080/TEST_WEB_URL=password-web:3000 | 14/14，fail/cancel/skipped0，3.0秒；t12-fix-targeted.log |
| docker compose run --rm --no-deps checks npm run typecheck | API/Web退出0；t12-fix-typecheck.log |

14项保留真实SQL0008/正常密码/CLI/正式HTTP与Web权限、人员/Agent可见但管理403、匿名/Pending/零角色/disabled/撤销拒绝、真实管理审计；选项/配置/实际CLI及HTTP旧慢新快/等待窗口回归。没有重跑全suite、无关配置/SQL矩阵或截图构建。

同一自有Ego45随后正常CLI创建隔离随机人员、明确授user、通过密码页面登录生产Web镜像，API公开Origin仅测试服务改127.0.0.1:31040。默认搜索alpha后迅速取消展示：453.1ms waiting/busy=false，MutationObserver记录1004.5ms loading/busy=true、1088.3ms正确空/busy=false；1151ms仍正确空。证据t12-fix-production-browser.json。同镜像/t12-component返回404，证明测试页未进入生产路由。该生产例未插入load计数，实际计数证据仅上方受控组件；不把UI时刻冒充实际业务调用计数。

## 清理与局限

Ego45已finish({keep:[]})；自有组件容器与password-api/password-web/auth-database删除，0600私密目录删除。17份本次日志/JSON/脚本扫描随机密码零泄露，t12-fix-secret-scan.json。t12-fix-component-cleanup.log/cleanup.log/final-services.json证明清理，仅原api/database/web运行；原API ready/schema0004、login200，t12-fix-original-status.json。.env/原presentation/真人/Ego31/通知不动，无迁移；T03真实飞书组织人工仍另列未完成。

平台macOS/Docker Desktop、Linux/React19.3/Next16.4、Ego Chromium。时间为前台采样/DOM观察，不保证后台精确计时或网络完成；直接组件源调用只定位本问题，不是全浏览器/输入法/辅助技术或真实业务数据验收。没有扩大多筛选器/业务模型或生产测试入口。仅本地提交，不push/关闭工单，TL另排定向复核。
