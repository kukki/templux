# T20 F1 修复验收

基线 `b264529fa87f7cb3484b18ee7d7d54adcf347c58`。保留 [初审](t20-review.md) 原文；本记录为开发修复验证，待独立复核，不替代初审结论。

## RED → GREEN

原生Chromium鼠标在390×844工具页打开真实ApplicationShell：遮罩385,300按下，移动至标题150,40抬起。`test-results/t20-fix-red-mouse.log`记录pointerdown目标navigation-drawer、pointerup目标drawer-heading、click共同祖先navigation-drawer，open=false、overflow空，确认初审。首次调用CDP误用send语法已修正，未当作产品失败。

共享手势控制器分别核验起点/终点/最终click的指针ID、类型、主键及遮罩几何；移动超过5 CSS px永久取消当次候选；多指、取消及活动期间lostcapture作废。正常触屏pointerup后的隐式释放仍允许合法click。捕获监听覆盖整个打开抽屉的指针流，关闭、断点、卸载、ending与blur释放记录；不延时补点击，不修改导航守卫或视觉布局。7项新增逻辑测试先因缺模块RED（`t20-fix-unit-red.log`），实现后7/7；实际旧症状RED单独由上述原生记录证明。

`tests/scenarios/navigation-backdrop-browser.mjs`为版本化实际组件回归，无DOM click或认证fixture：

- 鼠标遮罩→标题、标题→遮罩、遮罩拖动、拖动返回原点均保持打开与滚动锁；同一旧症状GREEN事件三元组仍相同，open=true。
- 正常鼠标tap关闭一次，焦点返回菜单。CDP触控内外两个方向、遮罩拖动、原生touchCancel、第二指落标题均不误关；全部结束后的新单指tap正常关闭。
- 原生setPointerCapture后活动期间releasePointerCapture，再产生原生抬起/click不关闭；Escape仍正常返回焦点。
- 桌面断点关闭后回窄屏新轻触可正常关闭；最终底层click计数0、表单值Initial、overflow空。

结果 `test-results/t20-fix-browser.log`，12个命名手势场景及额外Escape/断点断言通过。`t20-fix-guards.log`：真实EditSession的dirty导航与退出各弹确认并拒绝后保留草稿/抽屉；遮罩关闭不丢草稿；9次Tab仍在抽屉；按住指针时Escape关闭再重开不留旧手势。复用controlledNavigationLock：保存blocked导航不确认、不离开，logout请求0；session-ending立即清抽屉、释放overflow并结束保存等待。此处为组件公开ending事件，不声称重新执行真实401/SQL撤权。

## 最终命令及源码对应

```sh
docker run --rm -v "$PWD/shared:/opt/templux/shared:ro" -v "$PWD/tests:/opt/templux/tests:ro" templux-checks node --test --test-concurrency=1 tests/navigation.test.mjs tests/presentation.test.mjs tests/editor.test.mjs tests/editor-deadline.test.mjs tests/overlays.test.mjs tests/backdrop-gesture.test.mjs
docker run --rm -v "$PWD/shared:/opt/templux/shared:ro" -v "$PWD/apps/web/app:/opt/templux/apps/web/app:ro" templux-checks npm run typecheck
docker exec t20-fix-components npm run typecheck
```

最终67/67（原60+新增7），API/Web及包含实际工具fixture的类型检查均退出0；日志`t20-fix-targeted.log`、`t20-fix-typecheck.log`、`t20-fix-fixture-typecheck.log`。未重复255、数据库、截图矩阵或生产构建。

实际组件使用旧checks镜像`sha256:54624e8a05378346234f0c012df011128372f1a14260285cdf1b8508f17d7c2d`，只读挂最终shared/components及现有navigation-page.tsx到/t20-component，Next dev --webpack，端口31060，API内部端点为不可达127.0.0.1:1。启动挂载见`t20-fix-source-mounts.log`。最终ApplicationShell SHA256 `6d0054c40529fafec2f7f7b604b8d0351c08757938fe13a2024e11f781ef03d5`，手势模块`9ea790b90878e6277468012a752e198982619d60f9bde56d50edab6753c7b1e9`，主机/容器一致，见`t20-fix-{host,container}-hashes.log`；不把旧生产镜像当最终源码证据。

浏览器复跑：按上述只读挂载启动现有工具页，Ego新自有TaskSpace运行`drawerBackdropGestures(page,url)`、`drawerGuardRegression(page,url)`，再运行现有navigation-browser.mjs的`controlledNavigationLock(page,url)`；完成finish({keep:[]})。脚本使用真实鼠标及Input.dispatchTouchEvent，不接真实账号。截图/账号记忆/配置布局仍引用初始验收，不冒充本轮新验收。

## 边界与清理

Context7 `/mdn/content`核对click共同祖先、Pointer capture及隐式释放时序；结构图按search/trace/snippet并检查依赖路径覆盖，信号best effort，直接读取实际源码。仅现代Chromium真实鼠标和CDP模拟触控，不代表物理多指、全部浏览器或读屏。底层0click计数排除显式菜单按钮，只观察本次手势；无延时重放或底层按钮点击注入。

仅自有Ego74和t20-fix-components；收尾记录`t20-fix-cleanup.log`。无SQL、迁移、账号或新凭据，原0004部署/.env/实际presentation/Ego31/真人/飞书保持不动；不push、不关#21。独立审查另行安排。
