# T27 F1/F2 修复验收

## 范围与定位

基线 `76a123c4a267be0ae5d22d18a1d2c16ec6547aba`，初审 [t27-review.md](t27-review.md) 保留原文。修复实现 `9cbc7a097a7579139b91484346d553b2326e9d2f`，补充验证 `dbaa961`。仅更新工具schedule/check/state及相关测试合同；累计提案/T26最终快照与patch等价、认证包/SQL/项目原产物不改。

按receiving-code-review/systematic-debugging/TDD核验：原独立脚本在旧镜像真实复现31天周期12ms即执行，并在人工attempt后592ms执行2秒周期自动检查。`test-results/t27-fix/independent-red.log`。版本化 `tests/scenarios/t27-scheduler-repro.mjs` 对同两交错加有界abort，旧镜像RED、新镜像GREEN；用实际HTTP记录区分request到达与持久attempt开始，不放宽期限断言。

Node24官方Timers（Context7 `/websites/nodejs_latest-v24_x_api`）确认大于2147483647的setTimeout变1ms，promise版本支持AbortSignal清理。graph search→trace→snippet核对schedule/check调用与持久写入位置；6路径coverage metadata_match、无记录缺口（best effort，仍直读源码；图将某个wait误连其它模块，未凭此推断调用）。

## 修复合同

1. 全部等待统一单调剩余时间分段，每段≤Node上限，可取消；31天合法范围及每日默认不变。取消处理只接受实际signal导致的AbortError，其它错误向上传递。
2. 自动模式取得与manual同一state锁后重读最新attempt，未到期返回内部deferred并释放锁；不写新attempt、不请求来源。醒后再次取锁判断，新manual/其它scheduler令旧回执失效。延期不占有限实际运行次数。
3. 回拨完整周期使用同attempt指纹的内部等待回执，防反复锁内重算造成永久等待；ID或内容变化重新限频。人工check立即仍允许，失败attempt同样限制后续自动检查。
4. attempt读取/写入/结果持久化失败不假成功、锁正确释放。坏attempt不被当成空记录或被manual静默覆盖。lock冲突/发布前失败也使用有界等待，不能异常紧循环。

## 验证与证据

所有新演练在自有容器HTTP/fixture状态，无DB/业务进程/生产环境。证据根 `test-results/t27-fix/`。

| 项目 | 最终结果 |
| --- | --- |
| RED | 原独立repro、版本化repro、gate-red/expanded-red均捕获问题；红色日志保留 |
| 22项新增 | 精确MAX-1/MAX/MAX+1/2678400000分段；真实首/第二片段取消、最大周期abort、锁竞争大周期abort、人工等待中/醒后锁前插入、同到期竞争、未来时间回拨、实际scheduler回拨完整等待、无效状态/attempt与result发布失败 |
| 最终范围 | 原101相关+新增22=123项；同镜像API/Web typecheck |
| 实际repro | overflow：150ms左右abort，0运行/0HTTP、原attempt不变，无TimeoutOverflowWarning；manual-during-wait：attempt间隔≥2000ms，实际HTTP仅人工+自动两次 |
| CLI/Compose | 两次实际tick、立即manual、独立进程重启等待、独立Compose样板两次tick；`container-proof.json`记精确间隔，不以HTTP到达替代attempt |
| 源/输入 | `source-audit.json`20产品工具/适配文件逐字节对应最终镜像；原79/80/83文件SHA/mode保持，原0.1/.2完整发布及0.3manifest不变 |

受控长时间测试只替换计时器边界和单调时钟，检查生产waitFor实际分段调用且在最后1ms前不完成；取消另用真实Node timer/AbortSignal，进程正常退出验证无残timer。未真实等待31天或24小时。早期测试工具的Node MockTimers在最大边界未能完成，已停止自有测试容器，最终改用显式受控计时器边界，并保留真实Node取消及150ms无请求对照，不将未完成运行当通过；一次中间变量重名编译错误日志也不是通过证据。

复跑（最终镜像tag仅本机便捷名，实际ID见source-audit.json）：

```sh
docker run --rm --entrypoint sh t27-fix-final -c 'node --test tests/updates-*.test.mjs tests/release.test.mjs tests/project-interface.test.mjs tests/project-web-server.test.mjs tests/upgrade.test.mjs tests/upgrade-checks.test.mjs tests/upgrade-merge.test.mjs && npm run typecheck'
docker run --rm -v "$PWD/tests/scenarios/t27-scheduler-repro.mjs:/repro.mjs:ro" --entrypoint node t27-fix-final /repro.mjs
python3 tests/scenarios/t27-fix-proof.py --image t27-fix-final
```

前轮120项日志对应9cbc镜像；最终123项和源码审计对应dbaa最终镜像，不能用前轮数量冒充最终。精确最终ID及实际间隔见下方完成记录。

## 未改范围与清理

保留T27初审实际两边累计构建、90文件patch/vendor全等与最终消费证据；本轮未重跑累计包构建/SQL/浏览器，无相关产品变更。没有全局任务/外发/DB凭据；原schema0004、.env、presentation、Ego31、真人/飞书未操作，T03真人组织仍单列pending。自有HTTP服务/fixture在finally清理，CLI/Compose状态输出在验证后移除、容器--rm/Compose down；只保留非秘密日志/命令/审核报告。原正式及演练发布、readonly消费者与提案保持。

## 最终完成记录

- 最终源码测试点 `dbaa961fdb019d88d1583d60d783d4430e45d41f`，镜像 `sha256:24d620ab0bd6eb5ac07e745c1695f0e7665edc41636e1c97dc010d570f373251`；20源文件与宿主逐字节匹配，见source-audit.json。验收文档提交不改变此产品/测试点。
- `final-123-types.log`：123/123，0失败/取消/跳过，API/Web tsc均退出0；原生镜像无覆产品/测试源。`sh -n`、Python fixture编译与git diff --check通过。
- `final-repro-green.log`：31天周期160ms后主动取消，runs0/HTTP0/attempt原值；人工检查后自动attempt间隔2005ms，HTTP到达分别记录，不借其延迟抵消提前开始。
- `final-container-proof.log`/container-proof.json：CLI双tick 1082ms、人工立即582ms（小于自动1000ms周期）、独立进程重启1046ms、Compose双tick1064ms；全部实际attempt边界。commands.json可核验容器命令。
- 原79/80/83输入完整字节/模式未变；原0.1/.2发布库存一致，0.3 manifest保持指定SHA。自有CLI/Compose state/output均已移除，无check.lock/缓存/调度容器/网络；本轮无token文件或DB。保留证据日志/脚本，不重写初审及先前累计产物。
