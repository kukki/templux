# T17 F3 弹窗范围触点修复

基线`48ff52c448c5cb6710790d6f8a6f5840a771a923`。[初审及复核](t17-review.md)原文保持；[上一轮修复验收](t17-fix-acceptance.md)保留原源码点。F1/F2不改，本轮只补齐F3的第二触点登记范围。

## 定位与实现

真实React/native dialog/CDP先复现：首指stage平移120，第二指落caption后首指再移80，实际200而非120，`test-results/t17-modal-red.log`退出1。新增版本化`modalSecondTouch`测试先失败再改产品。

原stage独占down登记，caption/工具/模态边缘的down无法取消drag。改由dialog的`onPointerDownCapture`统一登记集合并取消多指拖动；stage仅检查已登记的blocked状态后启动，不重复加集合。捕获阶段先于子元素处理，兼顾子元素阻止冒泡；依据Context7 React官方common事件及responding-to-events文档。全局up/cancel与既有lostcapture清理继续使用。多指时清除并禁止建立遮罩dismiss候选；不会把剩余指移动当新拖动。普通工具栏click不取消，单指遮罩原焦点/点穿保护保留。

## 复跑入口与环境

`tests/scenarios/image-preview-review-browser.mjs`新增`modalSecondTouch(page,url)`，默认caption、toolbar、edge三个独立页面交错，每次原生CDP输入后等待两帧再读pan。原`multiTouchCancellation`验证stage双指、pointercancel/lostcapture和重新单指；`closeInitialFallback`验证F2七组；`image-preview-browser.mjs`原七组验证焦点/触屏遮罩、终态及替换/卸载/ending。

自有Ego64/p1和`t17-modal-components`，127.0.0.1:31057/t17-component，API指向端口1，无DB或凭据。旧templux-checks加只读挂载最终shared/view及版本化fixture，不是重建生产镜像；`t17-modal-mounts.log`、`t17-modal-source-hashes.log`记录镜像与宿主/容器字节对应。fixture只在自有工具容器挂载，无生产新路由。

```sh
docker compose run --rm --no-deps \
  -v "$PWD/shared:/opt/templux/shared:ro" \
  -v "$PWD/tests/image-preview.test.mjs:/opt/templux/tests/image-preview.test.mjs:ro" \
  -v "$PWD/apps/web/app/components/elements/image-preview.tsx:/opt/templux/apps/web/app/components/elements/image-preview.tsx:ro" \
  checks node --test tests/image-preview.test.mjs tests/notifications.test.mjs \
  tests/presentation.test.mjs tests/editor.test.mjs tests/editor-deadline.test.mjs
# 同一源挂载的checks npm run typecheck，以及组件容器：
docker exec t17-modal-components npm run typecheck --workspace @templux/web
```

## 最终结果

- 真实浏览器组合命令退出0，`test-results/t17-modal-combined.log`：新增caption、toolbar（定位工具栏output）、edge三组均single120→第二指后120→剩余接触仍120→全部释放后新手势180，正常工具栏click恢复scale1；日志保留nonprimary down/原capture丢失/后续up轨迹。
- 原stage多指1组仍120→多指120→新手势180，cancel后新手势210、丢capture不推进、新手势230。F2关闭七组和原七组均通过，共**18组**，包含触屏遮罩关闭后焦点恢复、底层click0、替换/卸载/ending拒晚结果。
- `t17-modal-targeted.log`：59/59，失败/跳过/取消0；`t17-modal-typecheck.log`：API/Web退出0；`t17-modal-fixture-typecheck.log`：包含fixture的Web退出0。产品源在上述验证期间未再改动，源hash与只读挂载相同。
- graph按search→双向trace→snippet→coverage核对；6条依赖路径无报告缺口、metadata_match，信号仍为best-effort，已直接读取依赖源码。原服务只读status为ready/connected/schema0004（`t17-modal-original-status.json`）。

## 边界与清理

未改shared源策略/加载状态机，59专项保留F1序列化安全及F2同token持有/终态断言。未重跑209/SQL/生产构建/截图。Chromium/CDP多点不是物理手机；受控loader不是自然远程解码失败。原0004、.env/实际presentation/Ego31/真人/飞书均不动，组件容器无生产认证fixture。只清理Ego64和本轮自有容器。
