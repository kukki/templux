# T28候选F1：准确版本与重新绑定验收

## 基线与边界

修复基线 `5de91a3b8139e1b11bd9285fd4f5d02270780380`；原完整候选 `7f2318b68cf95eccefd17a60c2fe38795e2dd323` **未获批准**。保留 [初审原文](t28-candidate-review.md)，主T28仍in_progress。本轮仅修工具版本校验和候选证据绑定，不执行producer正例、不生成0.1.1、不推进B采用。

产品工具改动只在tools/release/verify.mjs：有界准确SemVer解析、数字预发布标识前导零检查、点分标识中的连字符支持；归档文件名允许同样的大小写字母。后者修复真实消费入口对RC.1的误拒绝，不放开目录/链接/包名约束。build本身未改，version/from继续共用校验；原组合、锁、manifest/包SHA、SHA512、声明和installed门禁不变。

支持≤80字符、core安全整数、点分ASCII字母数字/连字符预发布；不支持build metadata、v/=前缀、范围/latest、空白或省略段。语法不代表版本已发布或组合/路径受支持。固定t28目标、下游校验没有为测试改变，无新增依赖。

## 依据与RED→GREEN

receiving-code-review/systematic-debugging/TDD先核验后实现。Context7查询npm官方package.json合同：版本必须可由npm所带node-semver解析；工具镜像的真实npm依赖用于合法性对照，不引入项目依赖。数值/连字符边界实际对照见semver-repro-red.log/green.log。

| 版本 | 修前 | 修后 | npm |
| --- | --- | --- | --- |
| 0.1.1-01 | true | false | 非法 |
| 0.1.1-alpha.01 | true | false | 非法 |
| 0.1.1-alpha--x | false | true | 合法 |
| 0.1.1-RC.1 | 语法true但消费文件名拒绝 | 语法/消费入口均接受 | 合法 |

版本化tests/release-version.test.mjs共51项：稳定/core/数字预发布/混合/连续连字符/大写、数字前导零、80/81字符、core安全边界、明确不支持语法；真实完整哈希tar与消费verify函数/CLI；实际build脚本version/from前置门禁。

build合法对照在自有scratch缺package.json时**故意止于后续预检**，通过错误类别区别“版本门禁已过”；非法值在版本门禁即拒绝。两者均退出1且无output目录，未调用npm pack或生成真实模板版本。这不是构建成功证据。消费测试tar为自有最小合成包，不是0.1.1测试发布。

## 最终源码/命令与结果

- 新完整候选/测试源码点 `4d69b683f7f1edefef2d6261895de9f368869f5d`（实现b5bc3ab及后续证据脚本）；镜像 `sha256:35acb8ff42da6b94dc3cde984b05b68780b641909c84c99f38ee263cd07e347c`，便捷tag t28-semver-final。
- `test-results/t28-fix/version-red.log`：初版50项，34通过/16失败，包含原误放/误拒及真实consumer/build入口；随后补80字符合法回归，最终51项。
- `final-special.log`：原生最终镜像**121/121**，0失败/取消/跳过，退出0；范围为release/release-version/upgrade/upgrade-checks/upgrade-merge/updates-version。未机械重复UI/SQL或全套。
- 新候选candidate.json的imageFiles逐字节核对11项工具/产品/测试/fixture/producer/冻结脚本；没有覆旧源冒充原生镜像。Python脚本编译、git diff --check通过。
- 无TS/React改动；3产品文件及类型字节不变，原22专项、API/Web types和实际组件证据沿用独立初审，未声称本轮重跑浏览器或类型检查。

```sh
docker run --rm --entrypoint node t28-semver-final --test \
  tests/release.test.mjs tests/release-version.test.mjs \
  tests/upgrade.test.mjs tests/upgrade-checks.test.mjs \
  tests/upgrade-merge.test.mjs tests/updates-version.test.mjs
python3 tests/scenarios/t28-candidate.py --image \
  sha256:35acb8ff42da6b94dc3cde984b05b68780b641909c84c99f38ee263cd07e347c
python3 tests/scenarios/t28-rebind-proof.py --image \
  sha256:35acb8ff42da6b94dc3cde984b05b68780b641909c84c99f38ee263cd07e347c
```

冻结脚本要求新输出目录；当前candidate已存在，不应直接覆盖。先在自有可丢弃副本或保存旧包后复跑。图按search→trace→snippet核对isExactVersion的build/verify/propose入口，6路径最终coverage metadata_match无记录缺口；best effort，实际源与差异另核对。

## 完整候选与来源保持

新包 `test-results/t28/candidate/`；未批准旧包保留为`candidate-unapproved-7f2318b/`，更早三文件包另留历史。新候选不是批准记录。

| 标识 | 值 |
| --- | --- |
| candidateCommit | 4d69b683f7f1edefef2d6261895de9f368869f5d |
| 产品patch（不变） | 26522ef2f42e3c441dcaab5352096d42f92070ed925f5c84e20f431f1bbb2383 |
| 新compatibility-tools.patch | 1624c34f7799555a6304f38118f59c34212ee1ebdc5f260c62151c7237974870 |
| 新verify.mjs SHA | 9298ddcd0c61b62de5c0efe0fd5e9b5d79d3123d6ffbed121f1f420251a88d81 |
| build.mjs（不变） | ddbb56005d4753cb80acffbf363c0a11dc6713ecf8ad53b80915fe8147e513c3 |
| producer脚本（不变） | 8622e6d0ee5bcc688202352f7f361244c8ffb13443d2782bb0aa559f71eba2ee |

`rebind-proof.json`：3产品文件SHA/模式及产品patch完全一致；正式198文件/模式与原候选一致；A原84源文件逐项检查，业务/品牌/config/路由均原SHA/模式，只有先前Next构建生成的next-env声明与构建前快照不同，准确记录该非业务生成物，不宣称其从未变化。正式0.1 manifest/两tar原SHA不变。旧0.2/0.3无读写，当前正式仍0.1.0。

`five-diff-proof.json/.py`：自有临时正式198源上实际git apply --check/apply两patch，完整文件集合/字节/模式等于正式基线+三产品+两工具，恰五项差异；不运行producer或包构建，临时目录finally清理。producer以后仍按198完整白名单+五overlay执行，工具落点和兼容差异需复核。

## 无批准与限制/清理

版本化t28-rebind-proof.py实际执行三种**均无approval文件**的拒绝：旧包/旧sourceCommit、新包/新sourceCommit、旧包/新sourceCommit。全部退出1、stdout0字节、固定拒绝stderr、输出0文件；源与输出挂载范围明确，临时输出随后删除。没有制造任何approved记录，亦不以缺批准的失败声称已实测“有批准但绑定不符”的分支。旧审批不存在，未来真实独立结论必须绑定新候选及五文件/producer来源，不能借原候选继续。

最终候选尚未获独立批准；本轮不构成#29全票完成。没有producer正例、真实0.1.1产物、B升级、外部发布/push/关票/自动部署。自有工具容器--rm和临时源/输出已清理；保留非秘密候选/日志。A/生产编译组件服务及Ego78按任务继续保留，不涉及原部署/schema0004/.env/presentation/Ego31/真人/飞书；无新DB/token/凭据。T03真人组织仍单列pending。
