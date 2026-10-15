# T27 受控每日发现与累计升级验收

## 基线、设计与实际边界

工单#28/#1故事9/10/14；工程基线 `6182006d63f3ec1d5d3d8bbff1a6626faa9d311e`。实现 `3a1eb4e699152039c42efd56a73f79a5b49fa179`；计时测试修正 `a1738ad`。设计及所有权见[设计](../superpowers/specs/2026-10-15-t27-discovery-design.md)、[合同](../specs/update-discovery.md)、[计划](../superpowers/plans/2026-10-15-t27-updates.md)。TL已确认可选pin、发现与目标选择分离、每日持久限频、完整receipt重验。

项目自管独立工具容器，提供菜单、一行check和可启用Compose scheduler；默认86400秒，首次立即，失败也限频，不注册宿主cron/云CI、不在API/Web放timer、不自动apply。目录/固定HTTPS源受控，精确版本/manifest与每文件SHA；同主版本单调最多8步，预发布显式允许。每边复用T26七项检查、所有权、最终快照及patch等价；最终再做一次原current到终点完整patch/vendor等价门禁。

结构按codebase-memory graph→trace→snippet探索既有propose/release，最终12个工具路径coverage无记录缺口（best effort非完整性证明），源码直读核验。已加载brainstorming/计划/执行/TDD/codebase-design/Context7/完成前验证技能；Node24 fetch/AbortSignal/stream与timers、Compose独立容器语义查官方文档。不涉及SQL写改/恢复/新依赖。

## 精确发布及来源

所有路径以下相对于仓库。`test-results/t27/releases/` 是自有公开演练来源，不是外部发布或生产升级建议。原0.1及前轮0.2逐字节复制，原发布未覆盖。

| 版本 | manifest SHA256 | 性质 |
| --- | --- | --- |
| 0.1.0 | bbf6ad9941a784e1301129a067698a79ff23cf2b8b81801582add184ec60c5dc | 既有正式只读产物 |
| 0.2.0-t26.1 | 6554dce775dd8f3ff3dddc93742465fdb6fa63b746d2908393c79809cd938f8c | 前轮演练，中间骨架/API标识检查 |
| 0.3.0-t27.1 | 462ec2f1200a5b58bdf62b454446f5dd7d1bd1c6fc23be071b385cf652c92a98 | 本轮演练，仅支持从0.2升级 |

catalog SHA `a139b569d927178e43e7f32c9e111b827dc1044e21b313849472398fbb66b091`。0.3 core `79ae076cc90da4d18cffa56aa951b850f69a001eefc54c481c6c104f17ca15c6`，web `06b93ecfd3f60cfc80f8de7d7a7bafdc0f30b02fa624b00220c0237e506acae1`。

0.3由版本化 `tests/scenarios/t27-target.mjs` 在一次性工具容器生成：来源commit为实现3a1eb4e加**明确测试overlay**，不是声称纯commit树。真实增加最终capabilities接口、最终骨架检查、合成SVG及项目更新入口；保留中间版本检查。`target-build.log` 含实际release builder/npm pack/lock/complete结果。产物manifest记录选定源文件inventory，非整Git树承诺。

## 最终验证矩阵

证据目录 `test-results/t27/`，未入Git的大产物保留本机供独立审查。

| 验证 | 结果/证据 |
| --- | --- |
| RED→GREEN | versions/source/cumulative/check/cli/wrapper各*-red.log、*-green.log；坏边metadata/身份变更测试亦先失败再修复 |
| 最终专项 | `final-101.log`：101/101（原65+新36）；最终image内运行，不挂旧测试源 |
| 类型 | `final-typecheck.log`：API与Web tsc退出0 |
| 源/镜像 | `final-source-image.json`：20文件逐字节匹配；包括17个工具源及3个项目适配文件 |
| HTTP/错误 | source测试实际本地HTTP，逐文件Bearer、401/403/拒redirect/超时/坏JSON/坏SHA/pin、受限token文件；不含产品认证fixture |
| 路径/失败 | 显式预发布、无更新/候选/不支持路径、可行中间路径、虚构直达边拒绝、缺中间metadata/中间语义失败不执行终点 |
| 重复/并发 | 独占lock、重复完整提案重验、修改任一交付树后拒receipt、已见同版本换manifest拒绝、只读输入/路径别名防护 |
| 真实累计 | `real-check.stdout` proposal_ready，两个真实发布每步七项全通过；`real-command.json`完整安全命令 |
| 菜单/手动 | `tty-menu.log`：PTY真实菜单输入1退出0；`wrapper-manual.json`：一行check退出0，均duplicate且重验全树 |
| 调度 | `schedule-cli.ndjson` 两次真实容器检查间隔1052ms；HTTP调度专项两次+重启第三次、默认每日与回拨受控时间测试 |
| Compose | `compose-safe-config.json`只保存非秘密选定字段；实际样板服务覆盖演练配置 `compose-frequency.stdout` 两次相隔1052ms；完成后down |
| 应用等价 | `apply-equivalence.json`：真实git apply --check/apply和vendor替换，90文件完整SHA/模式相等 |
| 副本最终构建 | `applied-build-correct.log`：实际安装组合、API tsc、两项中间/终点骨架检查、Next16 Web生产编译、项目behavior均退出0 |
| 身份实现影响 | `final-audit.json`包内文件比较：core仅project-interface JS/声明及package.json变化；web仅合成SVG/package.json；认证/会话/SQL/运维实现字节不变 |
| 原输入/秘密/锁 | `final-audit.json`：原消费者79、T26输入80、本轮输入83文件完整SHA/模式保持；保留proposal/state无合成token值、无残留check.lock |

最终工具镜像 `sha256:eb60f9289b0a848091d487bca7e8c8e0789443cfa54421f1da74b36e8862537c`（a1738ad源码）。真实累计生成/0.3 producer使用3a1eb4e镜像 `sha256:7fbe794b8934c808c496f1dda822a037f8dd60c267f9f657756bcc3c2197dc60`；二者产品工具/适配源20文件hash相同，差异为测试断言。最终101项/类型使用最终镜像。

初次提交镜像100/101：计时断言错误地比较HTTP到达时间，前置验证耗时不同可使HTTP间隔短于检查间隔。合同限制持久检查开始时间；a1738ad改测startedAt间隔，仍实测HTTP次数和重启等待，生产调度未为测试修改。保留 `committed-special.log` 失败原文。中途验收脚本误写不存在的tools/verify-shared.mjs，`applied-build.log`退出1；按真实 `.templux/verify.mjs . --installed` 重跑后的correct日志才作为构建通过依据。首轮Compose默认每日等待被SIGTERM正常结束，随后使用独立1秒配置完成真实有限调度；未修改项目配置来跳过每日默认。

## 可审查累计产物与复跑

最终提案：`test-results/t27/proposals/66207120-3275-45ae-947e-ae225b35708a/`，含steps/1与steps/2完整report/candidate、最终candidate/report/changes.patch/vendor-replacements/REVIEW。不是只看终点diff：中间实际API标识检查进入过真实构建，终点要求中间工具仍存在；两次behavior都检查Quay业务/品牌/reviewer角色。最终baseline是发布方原始值，不吸收Quay定制；业务version保持原值。

输入在 `current-path.txt`，一次性应用副本在 `applied-path.txt`。真实命令参数见 `real-command.json`、`applied-build-correct-command.json`。专项可复跑：

```sh
docker run --rm --entrypoint node t27-updates-final --test \
  tests/updates-*.test.mjs tests/release.test.mjs \
  tests/project-interface.test.mjs tests/project-web-server.test.mjs \
  tests/upgrade.test.mjs tests/upgrade-checks.test.mjs tests/upgrade-merge.test.mjs
docker run --rm --entrypoint sh t27-updates-final -c 'npm run typecheck'
python3 tests/scenarios/t27-final-proof.py --image \
  sha256:eb60f9289b0a848091d487bca7e8c8e0789443cfa54421f1da74b36e8862537c
```

具体菜单/调度启用命令及受限文件、故障恢复、支持组合见合同。重跑真实生成须用新外部state/output目录或现有receipt只复验为duplicate；不要清除未知状态掩盖失败，不直接在原消费者改配置。

## 局限与清理

HTTP鉴权/错误使用自有loopback服务；未调用真实外部HTTPS/私有registry/用户CI，TLS信任来自Node平台。无pin属于transport-trusted，无法防受信来源方改清单；已观察同版本换manifest仍拒绝。interval=1用于可控演练，不等候24小时；休眠/后台/进程停机不是精确定时承诺。强杀残留锁需人工核验，不自动抢锁。项目检查是显式信任代码，不是恶意代码沙箱；未承诺所有历史/跨主版/schema跨度兼容。

本票无产品UI/认证/SQL行为变化；未重新开展SQL人员Agent登录/权限全矩阵或浏览器截图，复用T25/T26既有验收且用包内字节比较界定影响，不冒充本轮实测。T03真人飞书验收仍单列pending。没有自动合并/部署、全局任务、生产通知、外部发布或push。

独立调度容器/网络已停止清理，所有工具容器--rm，无新DB/卷/凭据。公开演练发布、只读源码、完整非秘密提案、state与日志留供本机审查；一次性构建副本的node_modules/.next/dist/cache已清除。原schema0004部署、.env、现用presentation、Ego31及真人/飞书未操作。
