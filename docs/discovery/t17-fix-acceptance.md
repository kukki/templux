# T17 初审 F1/F2/F3 修复验收

基线 `b6074876c76744cf14c0c8f662cdab899de9e4ee`。保留 [初审](t17-review.md) 和 [原实现验收](t17-acceptance.md) 的历史结论；本记录只覆盖三项修正，未重跑209全套、SQL或生产构建。

## 核验与修复

- F1：原实现对根路径先规范化再去掉origin，literal/编码dot段可令结果变成`//host/x`。现对最终序列化路径拒双斜杠前缀，并再次按本origin解析验证；合法路径内部重复斜杠、编码斜杠、query/hash及无凭据HTTPS仍接受。不涉及服务端请求或SSRF声明。
- F2：原初始图实际显示error后进入backup，关闭将其cancel为idle，入口永远disabled。现明确初始请求属于仍在显示的缩略图，关闭/切走保持同一次token和候选；完成只恢复入口，不自动打开。非初始图库项仍取消本地等待、显式重访才恢复；全部失败终态、源替换/卸载/ending的取消及晚结果拒绝保持。
- F3：原第二触点被忽略，第一触点继续pan。现记录接触指针、第二指或非primary加入取消drag/释放capture，直到所有接触结束才可新拖；全局up/cancel清理支持在stage外结束，lostcapture取消直到释放。切图/关闭/缩放变化释放原捕获，不将手势当遮罩点击。

修前：`test-results/t17-fix-unit-all-red.log`为14项中11通过/3失败（F1、初始backup关闭、初始backup切走）；`t17-fix-component-red.log`真实React复现backup被abort和两指pan由120变200。

## 可复跑验证

```sh
docker compose run --rm --no-deps \
  -v "$PWD/shared:/opt/templux/shared:ro" \
  -v "$PWD/tests/image-preview.test.mjs:/opt/templux/tests/image-preview.test.mjs:ro" \
  checks node --test tests/image-preview.test.mjs tests/notifications.test.mjs \
  tests/presentation.test.mjs tests/editor.test.mjs tests/editor-deadline.test.mjs
docker compose run --rm --no-deps \
  -v "$PWD/shared:/opt/templux/shared:ro" \
  -v "$PWD/apps/web/app/components/elements/image-preview.tsx:/opt/templux/apps/web/app/components/elements/image-preview.tsx:ro" \
  checks npm run typecheck
docker exec t17-fix-components npm run typecheck --workspace @templux/web
```

最终59/59通过（原55+4），API/Web与包含fixture路由的Web类型检查均退出0。证据：`t17-fix-unit-final.log`、`t17-fix-typecheck.log`、`t17-fix-fixture-typecheck.log`。

浏览器使用Ego自有TaskSpace62/p1，隔离`t17-fix-components`的Next dev `/t17-component`（127.0.0.1:31057），挂载最终shared/React源和版本化fixture。镜像为旧`templux-checks`加最终源只读挂载，并非新生产镜像；`t17-fix-mounts.log`及`t17-fix-source-hashes.log`记录对应点。fixture只在此工具容器路由挂载，未增生产入口。

版本化复跑入口：`tests/scenarios/image-preview-review-browser.mjs`的`closeInitialFallback(page,url)`与`multiTouchCancellation(page,url)`；原7场景为`image-preview-browser.mjs`的`controlledImages(page)`（先goto上述url）。受控loader经公开适配器控制，实际React img error、原生dialog和Pointer Events贯通；不声称模拟loader等于真实远程解码故障。浏览器URL解析只调用URL API，不对候选发网络请求。

## 组件与浏览器结果

- 新关闭场景7组：按钮/Escape/遮罩关闭时原backup仍未abort、请求数不变、完成后明确重开；源替换拒旧完成；卸载/ending中止并拒晚结果；全部失败保持disabled且无额外请求。`t17-fix-fallback-final.log`。
- 新多指场景1组：单指pan120，第二指及后续移动保持120；全部释放后新手势至180；取消后新手势至210，手工丢失原生capture后不推进，新手势至230。`t17-fix-touch-original-green.log`保留真实pointer ID/primary/cancel/lostcapture轨迹。该组合命令的后半原场景曾因观察revision已更新但loader effect尚未发布新请求而失败；版本化原场景已改为等待对应rev请求再断言，未放宽结果。
- 原组件7组最终全部通过：`t17-fix-original-final.log`，含触屏遮罩关闭后eligible opener聚焦且底层click=0、备用次序/迟到事件、边界/切图reset、终态、替换/卸载/ending。
- 初次组合命令清理阶段在已无触点时CDP报Must send a TouchStart first；测试仅对这个无接触清理条件作幂等处理，其它清理错误仍抛。触控断言已完整重新执行，未用该错误当产品失败或成功证据。
- 浏览器最终URL解析矩阵16项（8拒绝/8接受），literal/大小写编码dot及混合dot、多斜杠、query/hash、合法根路径/HTTPS；`t17-fix-browser-source-policy.log`。无候选网络请求。

最终控制器/React源码SHA256与容器挂载一致；浏览器测试后仅调整原场景的effect观察等待，产品源保持同一字节。修复专项14项+相关45项=59，实际组件为新增7+1及原7共15组，不将其计作59中的额外Node测试。

## 平台与隔离边界

Chromium桌面视口及CDP多触点模拟不等于真实iOS/Android硬件；未重验此前正常授权页面矩阵。后台计时、跨平台焦点/原生手势仍受浏览器限制。没有数据库/凭据必要，未启动测试SQL、未操作真人；原0004服务、`.env`、实际presentation及Ego31保持不动。只清理自有TaskSpace62与组件容器。

## F3 后续范围补充

独立复核确认F1/F2关闭、F3在stage外第二触点仍需修正。后续最小修复及新源码验证见[弹窗范围触点验收](t17-modal-pointer-acceptance.md)，上述15组保持其原源码点。
