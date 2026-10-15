# T14 F1/F2 修复验收补充

基线 `46c9142b0d320b89ec7a977c38b657adc185945f`。按 receiving-code-review / 调试与TDD流程核验，两项反馈均成立。保留 [初审报告](t14-review.md) 原文及初轮验收历史，本文件是补充，尚待独立复核。

## 最小修复

- F1：捕获层与EditLink共用 `leavesEditDocument`，比较浏览器解析后的origin/pathname/search，不将hash变化视为离开。EditLink在onClick读取真实锚点href，支持字符串、相对hash、对象href，同时转发消费者onClick/其它props；onNavigate仍用Next支持的取消机制。保留sessionIsEnding显式优先取消、download/target/修饰键/外部合同，不引入历史拦截。
- F2：保存成功只复查当前已经显示的错误，保留仍有效的当前反馈，不新暴露其它字段；fields响应将适用快照的服务端字段错误与复查后的当前错误合并，本地当前错误优先。保存确认基线、新输入、revision、cancel/generation/abort语义不变。
- 无SQL/业务API/迁移/生产fixture，无新呈现键。合同更新见 [表单合同](../specs/forms-and-unsaved-edits.md)。

## RED → GREEN

| 证据（test-results/） | 结果 |
| --- | --- |
| t14-fix-hash-red.json | 旧镜像、真实React EditLink消费者：相对hash、完整同页hash、对象hash均确认1次并将Hash draft重置Alpha/dirty=false；原生a对照0次且保留dirty。不是只改DOM href。 |
| t14-fix-editor-red.log | 新增4条回归在旧容器实现全部失败；原6条通过。直接确认旧saved清Required和旧fields覆盖当前Required。 |
| t14-fix-editor-green.log | 挂载修复实现后10/10通过。 |
| t14-fix-build.log | 最终 `docker compose build checks` 退出0。无无关Web生产镜像/数据库重建。 |
| t14-fix-targeted.log | 最终checks：editor/search/multiselect/list-state/presentation **36/36，fail/cancel/skipped0**。 |
| t14-fix-typecheck.log | 最终checks `npm run typecheck` API/Web退出0。 |
| t14-fix-fixture-typecheck.log | 真实Web组件容器 `npm run typecheck --workspace @templux/web` 退出0，包含新fixture真实React链接props。 |
| t14-fix-source-hashes.log / image-hashes.log | editor.mjs及edit-navigation.tsx镜像/工作区SHA256相同，diff退出0，最终生产源码点一致。 |

最终专项命令：

```sh
docker compose build checks
docker compose run --rm --no-deps checks node --test tests/editor.test.mjs tests/search.test.mjs tests/multiselect.test.mjs tests/list-state.test.mjs tests/presentation.test.mjs
docker compose run --rm --no-deps checks npm run typecheck
```

4条新增纯测试覆盖：旧success后当前空名Required保持及后续改正；多字段下未blur的新非法note不提前报错；未改变值的note因当前其它字段产生已暴露交叉校验错误仍保持；旧fields响应只并入未变字段服务端错误并保留当前Required，之后改正各字段独立清错。原6条继续覆盖重复提交、新输入保存基线、失败、reset/cancel及忽略abort晚响应。

## 最终实际组件

独立Ego空间50、自有 `t14-fix-components`，只挂载版本化 `tests/fixtures/editor-page.tsx` 到该容器的 `/t14-component`。API_INTERNAL_URL明确指向不可用本机端口，不接原API/SQL，未创建/读取凭据。Next开发允许来源配置仅自有容器，生产应用路由不增加测试页。

最终证据 `t14-fix-final-components.json`：

- 复跑原 `controlledEditor` 的11个状态点全部通过，包括首次blur/submit/错误复查、规范化还原、等待时新值、fields/form错误、reset晚返回及卸载重挂。
- 原生a、相对hash、完整同页hash、对象hash共4项，确认均0，值Hash draft、dirty=true，真实地址hash更新。
- Beta提交挂起→改空→blur时Required/aria-invalid=true；旧Beta saved返回后当前空值/dirty=true，Required/aria-invalid=true及就近错误节点都保留，saving=false；改Gamma后错误消失/aria-invalid=false。
- 7个导航边界：路由/search/外部离开取消各1次确认且Gamma/dirty保持；download、_blank、Meta修饰点击均0次且dirty保持；search离开接受仅1次确认，地址?leave=1，当前值回已存Beta/dirty=false。下载和新窗消费者主动preventDefault避免实际副作用，Meta实际按键输入；不是据此声称真实下载或外部站点验收。

可复跑场景（新建自己的Ego空间，不复用已finish的50）：

1. 构建checks；自有容器用该镜像运行 `npx next dev apps/web --webpack --hostname 0.0.0.0 --port 3000`，绑定127.0.0.1:31043，设置上述API_INTERNAL_URL、DEPLOYMENT_ENV=DEV；将fixture只读挂到 `/opt/templux/apps/web/app/t14-component/page.tsx`。自有next.config.ts设置 `allowedDevOrigins:['127.0.0.1']`，不修改仓库Next配置。
2. HTTP200就绪后在新任务空间打开该URL；依次导入/执行 `tests/scenarios/editor-browser.mjs` 的 `controlledEditor(page)`，再执行 `tests/scenarios/editor-review-browser.mjs` 的 `hashLinks(page)`、`newerValidation(page)`、`leavingBoundaries(page)`；各函数直接断言DOM/地址/公开输出状态。
3. `docker exec 自有容器 npm run typecheck --workspace @templux/web`；完成后finish空间并删除自有容器。

初次goto未等dev服务就绪出现ERR_EMPTY_RESPONSE，等待HTTP200后恢复同一个50空间，未绕过错误另开空间；不作为产品失败/通过证据。最终组件回归使用受控window.confirm返回与计数，不冒充原生beforeunload提示、真实组织认证或再次CLI撤权；原T14相关独立验证及其平台限制保留。本轮按具体风险未重复172全套、SQL/真实身份矩阵或无关截图。

## 文档与环境

Context7核对Next onNavigate事件只有preventDefault，以及onClick/target/download/修饰键/外部区别；结构按status→search→trace→snippet、逐路径coverage核对，相关文件无报告缺口/元数据匹配，仍为best-effort。结束前Ego50 finish、自有容器清理，只保留原api/database/web；原ready/schema0004/login200，记录t14-fix-original-status.json与t14-fix-final-services.json。.env/原presentation/Ego31/真人权限/通知未动，不push/关闭#15。T03真实组织人工仍另列未完成。
