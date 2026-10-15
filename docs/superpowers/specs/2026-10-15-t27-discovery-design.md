# T27 受控发现与累计提案设计

#28/#1故事9/10/14，延续ADR0002/0012/0029。各项目授权独立updates-tools容器；无API/Web timer、socket、部署权限或全局cron。项目check-updates启动器+TTY菜单/一行check/schedule，独立Compose样板仅由项目显式启用。

项目public config固定目录或HTTPS catalog URL；可选catalogSHA pin，否则固定TLS来源为信任根（报告transport-trusted，不承诺防来源方改清单）。目录来源依赖本地授权；HTTP仅显式literal loopback供本地服务。无redirect/URL凭据/query；授权只用TEMPLUX_UPDATE_TOKEN或受限0600文件，不进argv/日志/报告。每记录准确version/manifestSHA/文件SHA/from图；来源不是npm latest。默认仅稳定同主版本单调边，预发布显式允许；无目标时列catalog-declared较新可行候选，生成提案须项目选择准确目标。范围/未知路径/跨主版本/缺边拒绝，不承诺旧主版本回补。

逐边下载到隔离公共产物cache、核全部文件/manifest/包及upgrade.from；每边复用T26三方propose、真实7检查、最终快照/patch应用等价。前步成功候选是下步current，baseline仍该发布原模板，不吸收业务定制。任何失败/冲突停在该步，不跳过；报告给已声明路径或准确无路径。最后copy最后候选，重新生成原current→最终的完整patch/vendor替换和临时应用等价；只有所有步骤通过才标可应用，不逐版部署，不改原源码/lock/baseline/env。

状态/输出必须在当前项目和来源之外。atomic mkdir lock，残留锁须确认无运行者再人工处理、不自动抢。receipt key含当前完整允许源/基线/vendor哈希、catalogSHA、准确目标/行为配置；重复须复核已有完整提案hash及最终库存，不能凭存在复用。网络/401/403/超时/损坏/锁冲突脱敏分类，一次attempt不内部重试，下一调度周期再查。原始响应与脚本输出不持久化。

默认86400秒；首次启动立即，之后以持久lastAttempt限频（包含失败），manual可显式立即检查。串行调度无重叠，回拨最多延迟一个周期并明确记录；中断锁有人工恢复步骤。可配置1秒周期做真实隔离双tick验收，不以测试时间绕过认证。SIGTERM等待当前有限步骤结束，强杀残留锁不能假装完成。调度stdout NDJSON，单次stdout单JSON，诊断stderr。

测试0.1→既有0.2-t26→新0.3-t27具有真实中间骨架/接口变化，清楚为测试发布。复用正常身份包无认证变更，不重复无关SQL/浏览器矩阵；累计提案在一次性副本应用完整patch/vendor并实际最终构建。原0004/.env/presentation/Ego31/真人/飞书不操作。临时HTTP授权仅自有合成token，测试后清理容器/凭据；安全候选留供审查。
