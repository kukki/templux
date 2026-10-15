# 容器内三方升级提案（T26）

#27/#1故事11–13；ADR0002/0012/0029。维护者先获取受信发布文件，不查latest、不自动更新源码/基线/部署。T25现有0.1.0产物保持原字节；版本校验现在接受准确SemVer，但仍逐项限制协议1/config1/schema0010/Node24/Next16及两个同版本包、准确manifest SHA/包SHA和实际元数据。版本字符串本身不证明兼容；目标必须另有`upgrade.from`明确包含来源版本，跨schema或缺路径拒绝，本票不推断累计迁移路径。

## 入口与授权

```sh
docker build --target upgrade-tools -t templux-upgrade-tools .
# current/target 必须是已授权非秘密源，不能包含内嵌秘密。独立empty输出父目录由操作者创建。
docker run --rm --init --cap-drop=ALL --security-opt=no-new-privileges \
  --mount type=bind,src=/approved/project,dst=/input/current,readonly \
  --mount type=bind,src=/approved/release,dst=/input/target,readonly \
  --mount type=bind,src=/approved/proposals,dst=/output \
  templux-upgrade-tools --current /input/current --target-release /input/target \
  --target-version 0.2.0 --target-sha256 EXACT_MANIFEST_SHA256 \
  --output /output/review-unique --trust-project-code --behavior tools/upgrade-behavior.mjs
```

工具没有Docker socket或部署凭据。只对候选执行npm与项目代码；信任标志明确授权项目构建和行为脚本（Node .mjs），并非恶意代码沙箱。不得挂个人.env、PG凭据、宿主目录/socket或生产网络；可按项目需要限制容器网络/资源。普通npm公共依赖需要网络或缓存。子进程使用最小环境，原有DATABASE_URL/Feishu等变量不转交；不复制.env/.npmrc/凭据/备份/日志/.git/cache/node_modules，项目源不得把秘密硬编码到代码或lock URL。允许输入apps/config/tools的源扩展名和明确根构建文件，其它文件不复制；特别资产/额外工作区需要人工补齐并重新验收，不能假定任意项目都受支持。

输出目录必须不存在且不与任一输入重叠；除词法重叠外，按目录dev/inode拒bind别名落入输入；目录清点上限10000，超限明确拒绝。所有祖先/文件拒符号链接和特殊文件，归档沿用T25路径安全检查。操作者保证输入在检查期间稳定、输出父目录无不可信并发修改。输出0700，报告/patch0600，候选普通源保留原模式、目录可在构建镜像中读取；只有非秘密内容进入候选。报告只列文件hash/路径/变更类别和检查退出信息，不嵌业务/config值、冲突正文或子进程原始stdout/stderr。诊断按检查名定位，维护者可在同样隔离副本自行重跑具体命令；不要把带秘密的原始诊断上传。

stdout单JSON，stderr为固定诊断。退出0仅所有必需检查通过且无人工项；2表示已生成但不可直接应用的提案，1表示输入/准备失败。缺基线/损坏/来源不符产生manual报告而非假基线。磁盘/工具错误可能留下未完成输出，应检查report及结果，不复用已有目录、不自动删除未知文件。

## 基线与所有权

当前manifest/templux.lock准确匹配及归档通过后，校验baseline来源等于当前manifest、baseline文件集合与hash、每文件hash被manifest的source.files原模板路径锚定。初版config覆盖按T25默认config/roles/presentation来源核对；不能修改baseline.json的hash来绕过。manifest/锁的可信来源仍由维护者审查，哈希不是签名。

三方输入为原baseline/current/target原baseline。允许骨架为Dockerfile、compose.yaml、templux、ignore文件、tools根.mjs、API/Web tsconfig、Next配置/服务入口、既有通用页面转接/layout/API代理。业务API server、business页、其它业务文件、README、根package业务元数据/脚本以及config不自动迁移。目标新增业务/config也不复制。两个workspace package.json仅更新各自`@templux/core`/web file依赖，业务版本和其余字段保持；其它依赖变化需人工审查处理，不悄悄升级。npm锁在候选基于当前锁重新生成，不使用目标业务锁覆盖。目标vendor只包含准确两包+manifest；旧包替换名另列，不删除原项目任何文件。

- 同基线未定制采用目标；目标没改保留当前，独立文本改动git merge-file合并。
- 目标删除且当前未改可删；当前删除而目标未改保持删除；删改/add-add冲突列人工。
- 文本冲突不写冲突正文；候选保留当前、manual阻断。
- 二进制有变化需人工替换（tarball单独列表）；模式按三方兼容变更，分歧人工。
- 不推断rename：按删/增分别审查，定制旧文件遇删除会冲突。仅文本无冲突不代表行为正确。
- 目标baseline仅候选保存；原项目baseline不会提前推进，也不吸收项目配置值。

## 检查与产物

无人工项且显式信任/提供行为脚本时顺序执行：npm install --package-lock-only --ignore-scripts；npm ci --ignore-scripts；安装后准确组合校验；npm run typecheck；npm run build --workspace apps/api；同样apps/web；node指定行为脚本。每步默认180秒、可配100–600000ms；错误/不可执行/超时都不通过，超时杀子进程组；停止后续检查。未运行不能叫passed。检查改变项目拥有的既有文件会恢复原字节并列人工项。生成的node_modules/dist/.next/cache不保留。后续真正部署仍须实际数据库/HTTP业务验收及备份/维护/迁移前提，本工具检查不自动操作数据库。

产物：`report.json`三个来源identifier/hash、current输入hash/模式、变化/人工项/逐项检查；`candidate/`待审源/vendor/准确锁和新版原始baseline；`changes.patch`无冲突文本补丁；`vendor-replacements.json`二进制替换清单；`REVIEW.md`人工应用步骤。缺基线时只有阻断报告，无伪候选。任何未全通过不标directlyApplicable；标记也只是本次声明检查范围，不是任意业务正确性保证。

维护者先核对可信source/manifest/hash、全部改动/权限/检查范围，在一次性副本应用patch与明确vendor替换（无自动apply命令），保持自己业务/config与必要部署私密文件单独提供。通过真实独立构建/登录/权限验收后才按项目审批应用及安排部署。T26测试0.2.0-t26.1是标注演练发布，不是生产稳定版本。每日发现/远程提案/自动合并不属于本票。
