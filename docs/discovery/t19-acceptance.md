# T19 验收记录

任务Gitea #20 / #1 story91；基线 `684504c3aa19350b2e921dad651420abcb4c2b9e`。本地实施，不推送/关闭工单。锚定浮层、单个非模态面板、编辑边界复用和合成示例见[合同](../specs/anchored-and-floating-panels.md)。无SQL对象/迁移、新业务API、生产认证fixture或通知外发。

## 最终验证点与命令

日志位于忽略目录 `test-results/`；可复跑场景已版本化。Docker新建checks/web镜像，原运行容器未部署新镜像。

| 验证 | 命令/入口 | 实际结果与源码边界 |
| --- | --- | --- |
| 真实SQL/HTTP/CLI完整回归 | `docker compose run --rm --no-deps checks npm test`，auth-database及既有工具API/Web就绪 | `t19-full-delivery.log`，240/240、0fail/skip/cancel，58.7s；已含最终配置兼容/resize-origin修正，早于其后的观察器active清理细化及标题touch-action CSS修正；不冒称这两项UI修正执行于旧全套 |
| 最终专项 | `docker compose run --rm --no-deps checks node --test --test-concurrency=1 tests/overlays.test.mjs tests/editor.test.mjs tests/editor-deadline.test.mjs tests/presentation.test.mjs tests/image-preview.test.mjs` | `t19-targeted-final.log`，58/58；其中overlays15项，包括真实CLI配置入口/固定基线旧文件、可控几何/单实例/边界订阅/epoch/终止 |
| 最终构建与类型 | `docker compose build checks web`；`docker compose run --rm --no-deps checks npm run typecheck` | `t19-build-touch-fixed.log`、`t19-typecheck-final.log`，checks/web构建成功，API/Web0 |
| 实际组件fixture类型 | `docker exec t19-components npm run typecheck --workspace apps/web` | `t19-fixture-final-typecheck.log`，0；工具容器只读挂载最终elements/shared/fixture，挂载记录t19-final-mounts.json，关键源码SHA256为t19-final-source.json |
| 生产无fixture | 正式Web镜像内fetch `/t19-component` | `t19-production-fixture.log`，404 |

组件测试容器t19-components在127.0.0.1:31059运行Next开发服务器，工具route只由readonly `tests/fixtures/overlays-page.tsx`挂载。无DB/登录绕过；不进入产品镜像。基础镜像较早构建，但所有依赖的elements/shared均挂载最终源码，标题CSS修正后重启并等待200。生产正常身份验收使用最终重建Web镜像。

可复跑：自有Ego任务空间page，导入 `tests/scenarios/overlays-browser.mjs`，分别调用 `popoverAndLayout(page,url)`、`panelEditing(page,url)`、`panelPointers(page,url)`。使用真实鼠标/键盘、原生确认receipt及accept/dismiss、CDP touch，每个事件后两帧观察；可控保存适配仅在工具fixture，非产品API。

## 实际组件结果（16组）

- `t19-layout-final-components.log` **8组**：原生invoker/Tab/Escape/焦点返回；外点轻关闭且页面计数生效；仍可见时滚动跟随20px；祖先完全裁切关闭；右下锚点向上翻转且夹紧；非模态Tab离开与页面操作；键盘move/resize/Home、鼠标drag/resize；嵌套浮层Escape仅关闭浮层；390px/视口高度缩小/桌面恢复。
- 初始面板510/320/420/360；键盘后520/360；鼠标后610/370，尺寸夹紧818×618且左上角不移。浮层下方gap8，上翻后right1428、bottom924小于anchorTop932。
- 390px窄屏面板12/472/366/360，无移动调整按钮、页面宽390；高度缩至420时12/156/366/252，正文client193/content905且实际滚动100。嵌套浮层right349，仍在视口内；恢复桌面保留首选几何。
- `t19-editing-final-components.log` **4组**：同ID草稿/epoch不变；真实dirty拒绝/接受替换，仅一个面板；保存锁同时拒绝UI/API关闭替换/Escape/重复提交，字段错误解锁聚焦、成功提交关闭返回；超时结果未确认、无自动重试、晚结果不假commit、明确核验推进基线保留新草稿；保存中ending强制清空且晚结果不复活。
- `t19-pointers-final.log` **4组**：标题首触点+正文第二触点、resize首触点+关闭工具栏第二触点均取消且剩余指不重启，全抬起新手势恢复；pointercancel、实际capture后的release/lostcapture、视口变化和目标epoch更换拒绝旧移动；受控Popover API缺失禁用入口/局部解释/结束清理。实际gotpointercapture的touch ID记录，未假定CDP touch ID等于PointerEvent ID。

## 正常身份与真实撤权

自有tmpfs Postgres schema0008，真实CLI create-person/authorize user，随机凭据仅0700目录/0600文件；未输出。`t19-setup.log`初始化成功且status schema0008。仅测试password-api的APP_PUBLIC_URL设为127.0.0.1:31040，正常密码页登录，不用fixture认证，避免与原localhost会话cookie混用。

`tests/scenarios/overlays-native-browser.mjs`提供normal entry/pending/revoked可复跑函数；`t19-native-final.log`最终退出0：

- 正常保护API200，辅助浮层关闭，说明面板aria-modal=false，页面计数实际+1。
- 桌面420×360；390px窄屏宽366，关闭按钮top481/bottom521，页面宽390、手柄0，关闭恢复原入口。
- 等待保存实际submit1、saving=true/closeDisabled=true；真实CLI将**本轮隔离账号**roles降为none，完成时仍busy。
- 随后保护API401，online立即检查，约114ms回登录reason=authorization_changed；面板/浮层/编辑字段均0。不拿跨文档performance计时作结论。

Page.captureScreenshot超时 `CdpRequestTimeoutError`，随后行为和撤权继续成功；**本票无成功截图，不声称像素验收通过**。窄屏以实际DOM几何、滚动、焦点和操作证据验证。

## 修前失败及诊断

保留RED和工具局限，不改期望掩盖问题：

1. `t19-unit-red.log`/`t19-boundaries-red.log`证明新行为缺失；配置初次编辑误在根添加分支导致旧文件失败，`t19-full.log`中断并停止自有残留容器。新增固定基线fixture，`t19-legacy-red.log`→green，独立库重建后完整240通过。
2. 祖先裁切时全局rect仍可见，旧浮层未关；`t19-clipped-anchor-red.json`保存滚动祖先/锚点位置。增加IntersectionObserver和失效active防护后最终layout8通过。
3. 大幅resize不应移动左上角，`t19-resize-origin-red.log`→最终pure15和实际鼠标夹紧通过。
4. 可滚动标题touch-action:auto让浏览器接管触摸并提前pointercancel，`t19-title-touch-red.json`/`t19-capture-pointer-diagnostic.log`；仅桌面标题禁原生手势，窄屏恢复auto；最终pointer4通过。
5. 工具首次dev未就绪、定位到已关闭的同类popover、按钮高层定位自动滚动、计数完整文本含“：0”等尝试不作为产品失败。最终使用open选择器、ready轮询和真实鼠标命中检查/正确按钮选择器，不用DOM.click写入。原生确认未stub。

## 资料、边界与清理

Context7 `/mdn/content`核对原生[Popover](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using) invoker/轻关闭和[VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport) offset/resize/scroll。结构探索按graph search→trace→snippet，检查11个依赖路径覆盖；最终native scenario变更metadata_changed已直接读取，图仅best effort不作完整性证明。

物理触屏、真实软键盘/输入法、读屏、多浏览器及后台调度未完整验证；CDP缩小可见视口不等同硬件键盘。默认Popover API不支持时明确不可用。真实项目仍需后端最终授权/版本/操作结果核验，模拟内存保存不能承诺远端取消。原T03真实飞书组织人工验收继续另列未完成。

最终公开证据秘密扫描、原服务status/fixture404、资源清理与工作区状态记录见 `t19-secret-scan.json`、`t19-original-status.json`、`t19-cleanup.log`。原schema0004和API/Web未重启迁移，未改.env/现用presentation/Ego31/真人权限或飞书；自有Ego68、工具容器/独立tmpfs库及私有凭据目录在交付前移除。保留新构建镜像供独立审查，不自动部署。
