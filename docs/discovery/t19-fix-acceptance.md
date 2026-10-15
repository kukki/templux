# T19 F1 修复验收：关闭边界注册归属

基线 `a8f4bcf76ab0d6246fd0c0f5398792956658c902`。保留[t19-review.md](t19-review.md)初审原结论；本记录补充修复，不将原16组件正例当作反证。原T19实现/完整回归点仍见[t19-acceptance.md](t19-acceptance.md)。

## 核验与最小修复

读取原独立JSON/可复跑脚本，真实checks容器只读挂当前shared执行：

```sh
docker run --rm -i -v "$PWD/shared:/opt/templux/shared:ro" templux-checks node --input-type=module < test-results/t19-reused-boundary-repro.mjs
```

修前`t19-fix-original-red.log`退出1：A注册的cleanup在B复用同一source后使blocked true→false，正确断言失败。根因是比较source引用，而不是本次注册。

只修改 `shared/overlays.mjs` 注册生命周期：每次注册唯一token，与expectedEpoch及ended共同判定订阅/cleanup是否仍属当前注册。释放先撤销registration/boundary再调用unsubscribe，防退订同步回调发布；建立订阅中同步通知若已销毁owner，返回的退订函数立即执行。保留一活动边界约束、公共接口、dirty/request/blocked和所有几何/指针/UI行为，不要求消费者创建新source对象规避缺陷。

## RED→GREEN与最终专项

版本化 `tests/overlays.test.mjs` 新增5项：

1. 稳定source跨epoch复用，旧cleanup重复/旧callback无效，B锁仍拒关闭；解除B锁后正常调用B.request，释放当前订阅一次。
2. 同source同epoch先cleanup再注册，旧cleanup/旧callback不能清新锁；当前cleanup幂等且正常关闭恢复。
3. 不同source对照，旧cleanup/callback不改变snapshot，当前blocked/dirty request拒绝及接受都生效。
4. invalidate/end先撤销归属，退订同步通知和后续callback/cleanup不再发布；invalidate可新开B而旧A不得污染。
5. subscribe同步通知引发owner失效时，返回的unsubscribe仍被释放一次，无订阅泄漏。

用固定基线controller文件覆盖只读挂载执行新增测试，`t19-fix-all-red.log` **20项中16通过/4失败**；不同source对照本来通过，其余四个缺陷组合按正确断言失败。修后原独立复现`t19-fix-original-green.log`退出0。

最终源码执行：

```sh
docker run --rm -v "$PWD/shared:/opt/templux/shared:ro" -v "$PWD/tests:/opt/templux/tests:ro" templux-checks node --test --test-concurrency=1 tests/overlays.test.mjs tests/editor.test.mjs tests/editor-deadline.test.mjs tests/presentation.test.mjs tests/image-preview.test.mjs
docker run --rm -v "$PWD/shared:/opt/templux/shared:ro" templux-checks npm run typecheck
docker exec t19-fix-components npm run typecheck
```

`t19-fix-final-targeted.log` **63/63（overlays20，原58加5），0失败/取消/跳过**；`t19-fix-typecheck.log` API/Web0；`t19-fix-fixture-final-typecheck.log`实际挂载fixture Web0。无生产构建/SQL库/凭据/240全套/截图。

## 真实React组件与源码边界

复用既有checks镜像，`t19-fix-components`只读挂最终shared/elements、版本化overlays-page和工具Next配置，TEMPLUX_CONFIG_PATH指向共享默认文件，API端口1；host127.0.0.1:31059。未读改现用presentation。HTTP200后执行版本化 `panelEditing(page,url)` + `panelPointers(page,url)`：重点验证EditSession边界订阅/卸载、替换、保存锁、timeout/verify、强制ending和跨epoch指针。布局/锚定算法未改，本轮不重复原8组layout。

最终日志`t19-fix-editing-final.log`与`t19-fix-pointers-final.log`记录**4编辑+4指针=8组**，使用真实原生confirm接受/拒绝、鼠标/键盘/CDP多触点及每事件后两帧；工具save仍为受控内存，不冒充真实远端授权。本次仅控制器变更，既有UI及fixture未修改。当前controller宿主/容器SHA256记录`t19-fix-{source,container}-hash.log`相同，镜像及readonly挂载记录`t19-fix-mounts.log`，不是旧镜像内controller代替最终源码。

首个工具启动误用不存在的npm dev脚本，随后未传配置路径导致fixture500；均仅自有工具容器，分别保留start/ready尝试日志。修正为直接Next dev并指向共享默认配置后200/typecheck/最终组件测试；不把这些环境准备失败当修复后的行为结果。合并执行及代理诊断的长调用在无完整结果时主动中止，留存components-final/editing-trace日志；分步真实打开/填写正常，最终按editing/pointers分组重跑，不把未完成调用当作通过或产品失败。测试期间仅自有page临时开启focus emulation，清理时关闭；未创建新恢复空间。指针分组在活动触点视口切换处执行较久，最终正常退出0、四个checkpoint齐全；没有把运行中状态误报最终失败。

## 资料与边界

按receiving-code-review、systematic-debugging、TDD核验。graph search→trace→snippet确认控制器消费者，六个依赖路径coverage均metadata_match（best effort，不证明完整性），相关源码直接核对。Context7 `/reactjs/react.dev`核对[useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)和[Effect订阅清理](https://react.dev/learn/synchronizing-with-effects)：cleanup移除对应订阅，开发setup/cleanup/setup不得积累活动订阅。

本轮不新建身份/数据库，不操作原0004/.env/现用presentation/Ego31/真人/飞书；无通知、push或关闭#20。自有Ego70和工具容器交付前清理，记录`t19-fix-cleanup.log`；原服务保持healthy/schema0004。未重复真实密码/CLI撤权链路，沿用原已验证证据；不声称本轮再次验证SQL/硬件触屏/软键盘/读屏/全浏览器或像素截图。
