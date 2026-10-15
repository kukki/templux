# T14 F3：消费者取消导航修复补充

基线 `93cc7a755f2361934ebbea2de92db46b764dc581`。读取并保留 [初审及F1/F2复核历史](t14-review.md)，按receiving-code-review、定位/复现与TDD流程确认F3。未修改editor控制器或原F2修复，待TL安排独立复核。

## 复现与实现

`test-results/t14-f3-red.json`：真实React `<EditLink href="/account" onClick={event=>event.preventDefault()}>`，Prevented draft/dirty=true，确认策略接受。消费者确实执行一次、URL不变，却确认1次并回Alpha/clean。document捕获先于React消费者，提前reset，是本次根因。

最小生产改动仅 `edit-navigation.tsx`：

- 普通a兜底从document捕获改到冒泡，读取消费者处理后的defaultPrevented；消费者取消优先，取消不确认/不丢弃。
- EditLink保留官方onNavigate入口；消费者onClick由Next先执行一次，onNavigate消费者也先获得取消机会。Next已preventDefault的SPA点击在document兜底跳过，从而去重。
- 共享同窗/修饰键/download筛选。外部replace由Next在冒泡前直接跳转且不调用onNavigate，因此只在该特例中于消费者onClick后、Next跳转前检查；保留外部链接保护。
- 无定时补跳转、历史回滚/哨兵、业务API/SQL/凭据/生产测试入口。sessionIsEnding优先门及hash共用判断保留。

合同现明确：Next客户端消费者采用EditLink，普通Next Link已经发起的SPA导航不能靠document监听兜底；普通a须保留事件冒泡。命令式router仍显式requestLeave。该责任见 [表单导航合同](../specs/forms-and-unsaved-edits.md)，不承诺任意第三方事件拦截或未接入历史遍历。

## 最终命令

```sh
docker compose build checks
docker compose run --rm --no-deps checks node --test tests/editor.test.mjs tests/search.test.mjs tests/multiselect.test.mjs tests/list-state.test.mjs tests/presentation.test.mjs
docker compose run --rm --no-deps checks npm run typecheck
docker exec t14-f3-components npm run typecheck --workspace @templux/web
```

`test-results/t14-f3-build.log`退出0；`t14-f3-targeted.log` **36/36，失败/取消/跳过0**；`t14-f3-typecheck.log` API/Web退出0；`t14-f3-final-fixture-typecheck.log`退出0（含最终真实React消费者及强制结束测试按钮）。image/source-hashes.log中navigation/editor的SHA256一致，diff退出0。最终生产源码点为该镜像，未把历史172全套计作本轮验证；未重建生产Web、数据库或无关截图。

## 实际组件回归

仅自有 `t14-f3-components` 容器/127.0.0.1:31043，将版本化 `tests/fixtures/editor-page.tsx`只读挂到测试路由；API_INTERNAL_URL指向不可用本机端口1，不接原API/SQL。Ego空间52，无新建/读取凭据。

`t14-f3-green.json`：

| 真实React/DOM场景 | 结果 |
| --- | --- |
| EditLink消费者onClick.preventDefault | 0确认，URL/Prevented draft/dirty保持，消费者次数1 |
| 普通a消费者preventDefault | 0确认，草稿/dirty保持，消费者次数1 |
| EditLink消费者onNavigate.preventDefault | 0确认，草稿/dirty保持，回调次数1 |
| 原生a普通离开拒绝 | 1确认，草稿/dirty保持 |
| 外部replace拒绝 | 1确认，草稿/dirty保持、未访问外站 |
| 正常转发search，先拒绝再接受 | 每次仅1确认；onClick累计1→2，拒绝保持，接受真实?forward=1且还原Alpha/clean |
| 原controlledEditor | 11状态点全部通过，保存/取消/晚返回与卸载不退化 |
| 原F1/边界 | 原生a、相对/完整/对象hash四种均0确认/保留dirty；route/search/外部拒绝各1；download/_blank/Meta各0，接受search仅1并回已存Beta |
| 原F2 | 当前空值Required/aria-invalid=true不被旧Beta saved清掉，修正Gamma后正常清除；36专项继续包含多字段/旧fields合并等 |

`t14-f3-ending.json`：最终fixture调用真实现有endSession，dirty且确认策略恒拒绝，仍立即到login?reason=authorization_changed；使用本测试自有sessionStorage计数跨文档记录确认0次，随后删除该键。**这是现有结束机制的组件整合，不是重跑真实SQL撤权或模拟服务器登录。** 原真实CLI撤权/401证据仍属先前验收。

可复跑：依t14-fix-acceptance.md的隔离dev容器方式启动最终fixture，等待HTTP200，在自己新Ego空间打开无query的 `/t14-component`；调用 `tests/scenarios/editor-cancelled-navigation-browser.mjs` 的 `consumerOrdering(page)`，然后重新goto无query路由，依次运行既有controlledEditor、hashLinks、newerValidation、leavingBoundaries。最后可再次goto无query路由运行forcedEnding。场景均有实际DOM/地址/次数断言，不能复用已finish的52。fixture不进入生产路由。

后来加入的强制结束测试按钮在旧dev输出中不可见，两次定位失败；只重建自有容器后最终按钮/整合通过。没有为工具缓存现象改产品行为。核心导航/原F1/F2整组通过对应的生产源码与最终相同，随后仅增加测试按钮并检查最终fixture类型/结束路径。

## 边界与清理

采用Context7核对Next onClick/onNavigate/defaultPrevented、外部replace、target/download/修饰键官方语义；结构status/search/trace/snippet与逐路径coverage无报告缺口/元数据匹配，仍为best-effort。使用受控confirm验证事件顺序，不冒充原生提示/全浏览器矩阵；beforeunload及未接入历史支持边界延续原合同。

结束前Ego52 finish、自有组件容器删除；只余原api/database/web，ready/schema0004/login200，见t14-f3-final-services.json及t14-f3-original-status.json。原0004未迁移/重启，.env/原presentation/Ego31/真人/通知未动，无SQL或凭据。仅本地提交，不push/关闭#15；T03真实组织人工继续另列未完成。
