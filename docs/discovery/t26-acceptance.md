# T26 隔离升级提案验收

Gitea #27 / 父#1故事11–13。审查基线 `2637317c3206c8e0dca6751240a52c6a54998a1f`。实现913c12c，Next检查环境修复8970c37，既有T24脚本还原/新脚本另名d47ff19，bind别名保护最终源码 **e9312aa8f88f322f7c08315b979d970caffc70b3**。本记录随后提交，不改上述运行源码。未push/关闭工单。

## 设计与实现

事前向TL发送具体有界设计并获继续指示。见[设计](../superpowers/specs/2026-10-15-t26-upgrade-design.md)、[计划](../superpowers/plans/2026-10-15-t26-upgrade.md)、[操作合同](../specs/upgrade-proposals.md)。工具只生成隔离候选/文本patch/vendor清单/检查报告，不提供自动apply或部署。原项目业务/config默认保留；骨架按原baseline/current/target三方比较。缺失/篡改基线、冲突、缺支持路径、未执行或失败检查均不可直接应用。

Graph search→trace→snippet核对verifyProject及调用，依赖7个源文件覆盖无记录缺口（Tier2 best effort，不宣称穷尽）；源码另直接读取。Context7核对Git merge-file/diff、npm file锁/lock-only、Node子进程组/环境及Next NODE_ENV默认行为。Postgres技能在自有SQL初始化/查询前读取；无新SQL迁移或历史改写。

## 可审查产物及来源

- 真实当前来源：`test-results/t25/committed-releases/0.1.0`及原定制消费者`/Users/jkoo/git/templux-t25-consumer-hjjpjxc4`，manifest SHA `bbf6ad9941a784e1301129a067698a79ff23cf2b8b81801582add184ec60c5dc`。该发布两tarball和原消费者79文件保持原字节，见`t25-unchanged.json`、`original-before.json`及`input-preservation.json`。
- T26只读输入副本：`/Users/jkoo/git/templux-t26-current-e0o8hffl`，保留Quay品牌、horizontal导航、reviewer角色、自己业务API/页；另有独立Dockerfile注释定制和明确行为脚本。全体文件/模式before-after一致；不读或复制真实.env。
- **测试专用目标**：`test-results/t26/releases/0.2.0-t26.1`，manifest SHA **`6554dce775dd8f3ff3dddc93742465fdb6fa63b746d2908393c79809cd938f8c`**，输入tree SHA `7ce76f7a52b1ae19927e38f3d21bdd4767c1f7c9d1e2d9ec3e97159061ba8a66`。来源为913c12c源码加版本化`tests/scenarios/upgrade-target.mjs`明确测试overlay，source.files记录实际变更输入哈希，**不是声称该commit未经修改的Git树**，不是生产稳定发布。升级路径仅明确0.1.0→该目标。新增core `sharedReleaseLabel()`、骨架shared-version-check工具及API构建强制消费新接口/Web构建组合复核，还有合成SVG包资产，非空版本递增；未覆盖0.1.0。
- core SHA `d9631c76b39b2692db44b8fb8e9ebfd28cab33c47b5ff09296ed59b3e393e4d3`；web SHA `293de820f34c9b9ee19376da4186b1602a2318142bdaf7872a525a1a7d0f9e03`。全部原始tar与manifest保留，complete最后成功写入，见`test-target-build.log`、`target-identity.json`。
- **最终提案**：`test-results/t26/proposals/final-guard/`：report.json、changes.patch、vendor-replacements.json、REVIEW.md、candidate/。最终源镜像`sha256:e304e56d3f8baf3001a0647cc7c6eaf7c6623da3c35dcd101219e5cdcfad96eb`，工具/发布源逐文件SHA与e9312aa匹配，见`final-guard-source-image.json`。目录0700/报告patch0600；候选只有可构建非秘密源、受检vendor/锁和目标原始baseline，无.env、凭据、数据库或cache。

## 命令与观察

下列证据均位于`test-results/t26/`；运行工具只在容器，宿主Python仅编排Docker和验收文件，不安装宿主npm/PG。

| 命令/场景 | 实际结果 | 证据 |
| --- | --- | --- |
| `docker build --target upgrade-tools -t t26-upgrade-tools .` | 最终工具镜像成功，Git2.39.5、Node24.21/npm11.19 | separation-image-build.log / final-guard-source-image.json |
| 容器`node --test tests/upgrade-merge.test.mjs tests/upgrade.test.mjs tests/upgrade-checks.test.mjs tests/release.test.mjs tests/project-interface.test.mjs tests/project-web-server.test.mjs` | 最终镜像 **49/49**，含真实merge/npm/file锁、基线锚定、路径、CLI单JSON、失败/不可执行/超时、项目内容保护 | final-guard-special.log |
| 容器`npm run typecheck` | API/Web均exit0 | final-guard-typecheck.log |
| `node tests/scenarios/upgrade-target.mjs`（发布容器，显式TEMPLUX_SOURCE_COMMIT） | 真正两个版本包、原始目标骨架、npm锁和complete产生；先类型/接口检查 | test-target-build.log |
| 操作合同propose CLI，必填current/target-release/version/SHA/exclusive output，readonly输入、无socket/真实env | 最终e9312aa镜像7项全通过，exit0/directlyApplicable true；lock4075ms/install6219/组合36/语义437/API144/Web10433/行为85，不承诺其它网络耗时 | final-guard.stdout / final-guard.stderr / proposals/final-guard/report.json |
| `python3 tests/scenarios/upgrade-proposal-proof.py` | 实际0.1.0定制源三个负例：缺baseline→manual；Dockerfile文本冲突→manual且不跑检查；真实npm语义exit23→失败并停止；全部exit2/不可直接应用/输入不变 | negative-proof.json/.log及proposals对应目录 |
| `python3 tests/scenarios/upgrade-bind-alias.py` | 同host目录分别挂current readonly和alias writable；最终exit1单JSON、无输出目录，不以字符串路径不同当隔离 | bind-alias.json / bind-alias-green.log |
| 一次性副本审查`git apply --check`、应用文本patch并仅替换列明tarball | 无自动产品apply命令；仅`/Users/jkoo/git/templux-t26-reviewed-7386d9py`审查后副本采用；新依赖/骨架与保留业务/config同时存在 | reviewed-apply.json；版本化upgrade-apply-proof.py |
| `python3 tests/scenarios/upgrade-consumer-proof.py` | 正常宿主CLI start→标准migration0010→独立API/Web构建启动，真实DB/API/SSR 6组场景通过 | consumer-proof.json/.log、reviewed-start.stdout/.stderr |
| 最终candidate与实际应用运行过的副本逐字节比对 | **82文件全部相同**；后加bind保护未改变候选内容 | final-candidate-equivalence.json |

最终7项检查用镜像内已有公共npm cache预热临时cache，仍真实执行lock-only/ci/校验/类型/双构建/行为，未跳步或信任旧node_modules；先前无缓存同样7通过，install一次85秒，只记录实际时长。输入参数可从proposal-command.json复跑；独占输出须换新名称，final-guard命令相同并预热镜像内cache。负例驱动也需新输出目录再跑；不复用已有成功目录。

真实运行组细节：人员随机密码正常认证，零角色protected403；CLI授user+reviewer后旧会话401，新会话业务200/错误scope403/adminAPI403。Agent关联该责任人，零角色403、CLI授reviewer后旧会话401、新会话业务200。account/examples/business三页200含Quay Lab，fixture认证入口404。正常restart API/Web保留人员与Agent会话200；再撤reviewer旧人员会话401、新人员登录受限业务403。核心包migrate --check返回0010，业务版本仍1.0.0。API运行依赖不含Next、Web不含pg，独立镜像ID见independent-images.json。未重做已验收全部备份恢复故障/控件UI矩阵，未用旧截图冒充本轮浏览器验收；本票没有视觉控件变化，真实SSR与权限通过HTTP检查。

## RED、失败与修正

- 最初缺升级模块的merge/proposal测试RED保留`merge-red.log`/`proposal-red.log`，随后20/36/46/49项逐步GREEN。首次/work挂整个checkout造成两个旧接口测试找不到dist/Next依赖，`special.log`诚实保留；改为镜像原路径运行最终源码后通过。
- 首个真实候选Web检查失败，报告正确不可直接应用。最小环境复现证明强制NODE_ENV=development导致Next prerender useContext错误；`candidate-web-minimal-env.log`与不覆盖环境的成功`candidate-web-diagnosis.log`对照，build-env-red→green专项。移除覆盖后最终真实生产Web构建通过，未吞错误假成功。
- 整理T26负例脚本时误用已有T24 `upgrade-proof.py`文件名，发现后从审查基线恢复**原字节**并另存T26为upgrade-proposal-proof.py，最终diff无该旧文件变化，t25-unchanged.json核验。不掩盖历史提交；最终成果保留原脚本。
- bind alias RED只在T26自有当前副本产生unsafe-output，未触及原T25消费者；删除该明确自有输出并补目录身份检查后GREEN，当前before/after全文件/模式恢复一致。原始失败见bind-alias-red.log，最终结果bind-alias.json。

## 清理与边界

`cleanup-compose.log`/`cleanup.json`：只移除t26-reviewed容器/网络/DB与maintenance卷；自有.env、人员/Agent凭据与backup目录已删，诊断用node_modules/.next等cache清理。保留非秘密当前输入/审查后副本、测试发布/提案/安全日志供独立审查。原T25消费者/0.1.0包、T24测试脚本未变。原templux三容器仍原运行状态；其它团队容器不操作。原0004部署未查询/迁移/重启，原.env/presentation/Ego31/真人权限/飞书通知未操作。数据库SQL历史diff为空。

macOS Docker Desktop/Linux容器实证，不推广为Windows/WSL宿主或全Git/npm/Node/PG版本保证。检查脚本为显式信任项目代码，不是安全沙箱或通用秘密扫描器，禁止输入源硬编码秘密/带凭据lock URL；不挂真实环境/socket。其它源目录/资产/工作区、schema跨度/未声明路径、rename/二进制冲突需人工，不能凭文本无冲突或7检查覆盖任意业务。哈希锁不替代可信来源审查，目标manifest须维护者核对。无每日更新任务、远程PR、云发布、自动合并部署或任意累计路径推断。T03真实飞书组织人工验收仍单独pending，本票人员/Agent密码SQL闭环不替代它。
