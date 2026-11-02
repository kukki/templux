# Skoope 分页按钮组采用验收

日期：2026-10-28。用户在 grill-with-docs 澄清中确认通用默认、示例、账号管理、审计和后续新项目采用；保留默认10条、原数量选项、下拉跳页及窄屏收纳。设计合同见[分页规格](../specs/pagination-sort-url.md#skoope-按钮组采用2026-10-28)。

## 实现

- 参考 Skoope `src/components/overview-pagination.tsx` 与 `src/app/globals.css`：首页、上一页、最多五个连续页码、下一页、末页；无间隙连体，仅两端圆角，当前页使用项目品牌色。
- `Pagination` 统一渲染按钮、页位置、数量及跳页；账号管理与审计复用该组件，保留各自服务端请求与权限边界。可选 `disabled` 支持管理操作繁忙及读取状态。
- `pageNumbers` 使用固定最多五页的连续窗口，在两端平移补齐；声明文件同步返回 `number[]`。移除管理页旧分页样式，隔离账号表单全宽下拉对分页的影响。
- 沿用项目44px控件高度、主题和焦点变量。窄屏直接显示上一页、位置、下一页；展开显示完整连体按钮组，宽度不足时按钮组内部横滚。
- 不新增领域术语；既有术语仍以根 `CONTEXT.md` 为准。此呈现调整可逆，无新增 ADR。

## 验证

1. `npm run build` 完成API编译；最终 `npm run build --workspace @templux/web` 和 `npm run typecheck` 通过。旧 `.next` 中已删除 repro 页面的缓存移至忽略的测试产物目录，再重新生成。
2. 项目Docker checks环境（Node24/Linux）运行 `list-state`、`ui-consistency`、`presentation`、`release`、`project-interface`、`project-web-server` 六个测试文件，36/36通过。最初直接在macOS/Node25运行时，五项涉及Linux `script`、权限或tar的既有测试失败；相同测试在项目容器通过，未改测试绕过平台差异。
3. 同一checks环境针对独立PostgreSQL18.6临时数据库运行 `account-management.test.mjs`、`audit.test.mjs`，26/26通过。测试未指向现有应用数据库。
4. Ego浏览器正常密码登录隔离验收账号，检查 `/examples`、`/admin`、`/audit`。验证首末页禁用、下拉跳页、数量变化回首页、连续窗口、示例刷新恢复和键盘焦点；实测相邻按钮边框重叠1px、内部圆角0、两端6px、高44px。
5. 三个页面均在1440/768/700/390/320px复核，页面宽度不超过视口。窄屏展开后能跳末页；示例空结果为0条、范围0–0、1/1页，全部翻页按钮禁用且保留五列表头。
6. 机械设计扫描仅报告 `style.css` 中原有状态卡片/管理编辑区的3px顶部强调边框，未扩大此次调整范围；分页样式未报告确定性问题。完成两轮桌面/窄屏视觉检查。
7. 用发布脚本生成本地测试模板包并完成 `verifyProject` 校验；最终web包中的分页组件、样式、管理与审计组件及分页状态实现/声明与当前源码逐字节一致。`project-template`通过共享包继承，无需复制组件实现。

本地截图、浏览器脚本、JSON证据和测试模板产物位于忽略目录 `test-results/pagination-20261028/`。`browser-evidence.json` 是首轮行为检查，`browser-confirmation.json` 为最终宽度与空结果确认；`*-final.png`为最终截图；`release-final/0.1.0/`仅为本地测试包，未发布或升级既有锁定消费者。

## 限制

Next.js16.4.0构建发出既有版本的安全漏洞提醒，并首次拒绝退出；按工具允许的原命令重试后构建通过。此次未升级依赖，应另行安排安全升级。构建同时提示工作区外的pnpm配置被忽略。以上提醒不作为分页实现已完成依赖安全治理的证明。

本轮未进行生产部署，也未将新包应用到已有项目。

## 合并前复核（2026-11-02）

- 从当前源码重新构建 Docker `checks` 镜像，使用 Node 24.21.0；`npm run typecheck` 与 `NODE_ENV=production npm run build` 均通过，Web 生成9个动态路由。
- 串行运行 `list-state`、`navigation`、`overlays`、`ui-consistency`、`presentation`、`release`、`project-interface`、`project-web-server`：67/67通过。
- 在独立 Docker 网络与临时 PostgreSQL 18.6 数据库运行 `account-management`、`audit`：26/26通过。
- 本轮未重复浏览器验收；桌面、窄屏与交互证据见上方2026-10-28记录。
