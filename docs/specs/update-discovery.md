# 项目受控更新发现与累计路径（T27）

#28/#1故事9/10/14，ADR0002/0012/0029。更新检查由各项目自身授权的独立工具容器执行，不在API/Web设timer，无模板跨项目写权限，无自动apply/部署/全局cron或外部CI注册。本票只支持T25/T26已经受检的协议1/config1/schema0010/Node24/Next16组合，不猜测schema跨度或旧主版本回补。

## 来源与选择

维护者在容器内生成受控来源目录的catalog（不改原发布字节）：

```sh
docker build --target updates-tools -t templux-updates-tools .
docker image inspect templux-updates-tools --format '{{.Id}}'
docker run --rm --entrypoint node -v /approved/releases:/source \
  templux-updates-tools tools/updates/cli.mjs catalog --root /source \
  --release 0.1.0 --release 0.2.0 --release 0.3.0 --output /source/catalog.json
```

catalog exclusive写入，stdout只给结果/SHA；每记录准确版本、manifest SHA、公开文件SHA/size/mode和from边，先验证已有包/锁/complete。支持1–128版本、每发布≤512文件/256MiB、单文件≤16MiB；拒秘密名称、链接、穿越、特殊条目和未知模式。发布目录必须是获授权非秘密产物，不能夹带运行配置/凭据。root更新工具的源码/镜像另经项目审批，准确image ID/digest锁定，不跟随latest。

项目复制`config/updates.example.json`为自己的`config/updates.json`，配置是项目所有，不随升级自动覆盖。目录来源`{kind:"directory",root:"/source"}`由本地授权；远端`{kind:"https",url:"https://approved.example/templux/catalog.json"}`固定URL/TLS来源为信任根，报告transport-trusted。可选catalogSha256严格pin，变化报catalog_changed；无pin不宣称能防发布方改变清单。报告记录本次catalog SHA。每步manifest/文件/包仍按精确SHA验证，项目状态还保存已发现version→manifest映射，后续同版本换身份拒绝release_identity_changed，需维护者核验并人工处理状态，不静默接纳。

发现与选择分开：没有targetVersion也返回catalog声明支持的较新候选及显式路径，未下载验证时标catalog-declared；没有候选才no_update。生成提案必须targetVersion准确三段版本，可带规范prerelease，拒latest/范围/build metadata；默认仅稳定同主版本单调路径，预发布须allowPrerelease:true。选择当前版本可返回target_current和仍存在的其它候选，不谎称无更新。项目公开业务version独立。

凭据只能固定环境TEMPLUX_UPDATE_TOKEN或tokenFile绝对受限普通文件（0400/0600、无symlink、≤8192B），两者互斥且空引用拒绝。Token值不在argv、日志、候选、报告或state；工具只发Bearer头到固定origin路径，拒redirect（包括同源）、URL用户信息/query/hash、任意协议。仅显式allowHttpLoopback允许literal127.0.0.1/[::1] HTTP本地服务，不给应用增加认证fixture。每请求超时默认10000ms、100–60000可配，流式限制大小；401/403/redirect/timeout/network/坏JSON/坏产物分类且不记录原始响应。一次attempt不内部重试，下周期或人工check再尝试。

## 项目菜单、一行与调度

`check-updates`是项目拥有、模板建议管理的纯Shell启动器，宿主只需Docker/基础Shell，不用npm/PG。需要项目非秘密source checkout和**已经存在且位于checkout外部**的state/output目录；readonly挂当前源，token只按env名字传递，不读取项目.env。真实.env/凭据/备份等不应在工具source挂载中，使用单独源码checkout。项目源码不能内嵌秘密，执行项目检查仍是显式信任代码，不是恶意脚本沙箱。tokenFile可通过明确Docker readonly挂载到配置路径使用；启动器快捷方式使用env引用，不复制文件秘密。

```sh
# 操作者只给此项目授权；这些目录不能相互包含或别名回当前源。
export TEMPLUX_UPDATE_IMAGE=sha256:APPROVED_FULL_IMAGE_ID
export TEMPLUX_UPDATE_STATE_DIR=/approved/project-updates/state
export TEMPLUX_UPDATE_OUTPUT_DIR=/approved/project-updates/proposals
export TEMPLUX_UPDATE_SOURCE_DIR=/approved/releases
./check-updates check --json
./check-updates                   # TTY菜单：检查 / 调度 / 退出
./check-updates schedule          # 自身独立容器，不启动业务服务
```

选择目标并授权构建前，项目显式设置trustProjectCode:true及自己的behavior相对.mjs路径；行为脚本须核验真实消费合同。缺授权不会执行脚本或标可直接应用。T26最小子进程环境不转发token/数据库/Feishu变量。保留现有T26拷贝白名单，特殊资产/额外工作区需要人工处理，不能把任意部署目录当支持输入。

可用`tools/updates.compose.yaml`作为项目自管可启用样板；独立Compose文件，无business depends_on/socket/env_file/restart loop。目录来源样板需/source只读；HTTPS项目可按自己所有权去掉该volume。由项目选择明确启动/停止，例如带`--env-file /dev/null`调用此独立文件，避免载入部署.env；本票不代注册任何全局任务。不同项目用不同state/output/Compose project名称。

调度默认**86400秒**（首次立即），intervalSeconds为1–2678400整数、空/非法拒绝。每次取得锁后先原子持久lastAttempt，含失败也限频；重启按该记录等待，manual明确check可立即执行。任务串行，无重叠；时钟回拨最多延迟一个周期并标clockRollback，不补跑大量历史任务。中途停机/强杀的check.lock不自动抢，需核对无运行者、检查owner.json和partial提案后人工移除自有残留锁；PID是容器内诊断而非宿主杀进程依据。SIGTERM结束等待或等待当前有限操作，外部强杀仍可能留锁，不当成功。

单次stdout单JSON，诊断stderr；schedule stdout NDJSON，每条含结果/开始时间/下次不早于时间，失败每条可见，不后台吞错。--max-runs供受控有限批次/演练，正常服务不需该参数。锁冲突立即status locked，不等待、不无限重试。state包含attempt/result/known-releases/receipt、无token；损坏state明确失败，需要维护者核验修复，不假设已完成。

## 累计提案与重复检查

以准确元数据图BFS找同主版本递增路径，最多8步；报告可行候选/分步路径或准确unsupported_path。每步下载验证全产物，manifest.upgrade.from必须和catalog.from一致且支持前一步；不能只相信catalog虚构直达边。每步T26三方比较/项目所有权/原始baseline、7项语义/API/Web/行为检查和最终快照/patch等价门禁全部执行。任一步缺元数据/冲突/失败即停止，不跳到终点。不要求逐版部署，也不把项目定制吸入baseline。

最后只交一份原current→最终candidate的补丁/变化报告/vendor替换清单；保留steps/报告追溯每个manifest/源码标识和检查。再次执行完整临时git apply/vendor/文件集合字节模式门禁，所有步及最终门禁通过才directlyApplicable。不写原源码/lock/vendor/baseline/.env；新版baseline仅最终候选供审查。维护者在一次性副本采用最终整件，再实际构建/业务验证并安排原有备份/维护/迁移部署流程，不自动应用。

每项目atomic mkdir lock，状态/输出不与任何输入重叠（含bind别名）。成功receipt key包含当前允许源/基线/vendor全SHA/模式、catalog SHA、准确目标/公开配置及工具源码hash；重复需复核**整个提案**（含中间报告/候选、最终patch/vendor/REVIEW）库存SHA和准确最终包，损坏报previous_artifact_invalid，不凭目录存在复用。缓存只为本attempt下载的公开文件，finally删除；提案独占UUID目录，失败目录留供核验，不自动清理未知或人工数据。写receipt或result失败不能假称持久成功；可能已有可审查提案，但仍需人工确认状态。

## T27 审查修正：长周期与锁内自动到期判断

自动schedule与人工check共用state的操作锁。自动调用**取得锁后**读取并验证最新attempt，再决定是否写本次attempt及请求来源；未到期返回内部`deferred`（delayMs、attemptKey、clockRollback），释放锁并单调等待后重试。延期不会写attempt或请求catalog，不计入max-runs，不伪报一次检查成功；等待状态可由state/result.json核验。schedule stdout仍只报告实际尝试/失败，`startedAt`取真实持久attempt的`attemptedAt`（取得锁前失败则为调用时间）。人工check显式立即执行，不受自动周期阻挡；失败attempt亦使之后自动等待重算。两个调度器即使同时醒来，也不能绕过锁内期限；人工在睡眠中或醒后取得锁前更新，旧等待回执失效。

周期仍支持1–2678400秒。所有等待含锁竞争退避，都以单调时间计算剩余，分成≤2147483647ms的Node可取消片段，不把31天直接交给会溢出为1ms的setTimeout。取消拒绝原生等待并解除timer，不以吞掉其它等待异常当正常结束；强杀残锁仍人工核验。回拨时最多等待一个完整单调周期；仅匹配同一持久attempt内容指纹的已完成回拨等待回执可结束此等待，防锁内每次重算未来时间而永远延期。其它人工/调度写入（含同毫秒不同attempt ID）改变指纹，必须重新判断期限。该回执只是工具内部状态，不是凭据、配置或CLI跳过开关，不授予项目权限。

attempt必须为合法正整数时间与非空ID对象；坏JSON/null/无效字段不视为空状态。自动读取/发布失败不能请求来源或报成功；result持久化失败向上报错，锁仍释放。锁竞争或attempt发布前失败的持续调度也按配置周期退避，避免异常状态形成紧循环。未来周期无需改变上限或默认每日值。修正证据见[T27修复验收](../discovery/t27-fix-acceptance.md)，初审历史保持。
