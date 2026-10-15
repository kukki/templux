# 数据库备份与恢复规范

## 已确认

- 首版提供容器内执行的数据库备份与恢复 CLI，支持人工菜单及 Agent 一行调用，不增加宿主数据库客户端或应用运行环境。
- 恢复操作遵从宿主管理授权及明确确认规则，非交互缺参数直接失败，不等待输入。
- 定时调度与异地存储由部署环境或新项目负责，模板不内置定时备份服务。
- PostgreSQL 可由 Compose 提供或外部配置；此范围不等于已承诺外部数据库所有管理权限均可用。
- 已有数据库存在待执行迁移时，升级命令默认先完成数据库备份，备份失败中止迁移；全新空库初始化及无待执行迁移时跳过此前置备份。允许操作者显式选择已外部备份并提供文件路径、快照 ID 或记录编号，写入升级操作记录后跳过重复备份。操作者负责确认恢复可用性，模板不将自报参考当作已验证备份，不新增云平台 API。本规则不表示失败后自动恢复。
- 内置命令只备份数据库；项目代码配置通过版本库恢复，.env由部署环境单独妥善备份。恢复文档明确必须准备兼容配置及必要密钥，数据库备份不等于完整环境备份。
- 模板管理的迁移前自动备份默认保留最近 5 份成功备份，数量可配置；新的备份成功后才清理超出部分，失败或未完成备份不替代已有成功备份。不清理操作者手动备份或外部快照。
- 恢复成功后、重新开放访问前，使恢复出来的全部旧会话失效，人员及 Agent 重新登录；不改变普通应用重启保留有效会话的规则，不代替新项目审查恢复的业务授权。

- 独立目标及原库恢复均支持，每次须明确选择模式和目标，不设默认；菜单展示选择及目标，一行调用缺模式或目标即失败。原库恢复须停写并明确确认；独立目标须已准备或具备创建权限，不假设外部数据库允许自动建库，不自动切换生产连接。

## 待确认或细化

- 备份路径、访问权限、完整性验证及恢复演练。
- 外部数据库已有备份设施的衔接、恢复停写与版本匹配。
- 数据库之外的文件备份属于新项目及部署环境；文档需说明范围。
- 恢复目标校验、停写及备份清理的具体执行机制。

以上为原始规范；T22交付记录见下方。T22当时的恢复命令仍属于后续票；T23更新见本文末。

## T22 已实现：容器备份与迁移前置

`./templux backup --confirm --json` 与菜单25为同一手动入口，缺确认立即非零；菜单会展示当前项目及容器目标并要求yes。不接受输出文件覆盖参数，目标来自专用 `TEMPLUX_BACKUP_DIR`（宿主默认 `./backups`，容器固定 `/opt/templux/backups`）。禁止共用凭据或配置目录。自定宿主路径还须排除版本管理和镜像上下文，默认backups已忽略。manual不会自动清理。只备份配置DATABASE_URL的一座数据库：不包含代码、.env、业务文件、Postgres全局角色或宿主证书。

management和migration镜像携带固定18.6的pg_dump/pg_restore与运行库，API/Web不带。Compose内库和独立外部可连接库均走同一libpq协议，不要求Web/API运行或宿主PG客户端。工具只接收格式/文件参数，连接密码通过临时0700目录中的0600 PGPASSFILE，连接字段通过最小子进程环境；不把DATABASE_URL/密码放argv。工具原始stderr可能含连接信息，拒直接透传，只报告阶段/退出或超时；工具诊断包括warning也按未验证处理。15分钟工具超时终止子进程，不自动重试。

支持postgres/postgresql URL，必填主机、用户和库名（未写库名按用户名），密码按URL解码；拒CR/LF/NUL/fragment/重复及未知查询项。允许显式sslmode、sslrootcert、sslcert、sslkey、sslcrl，路径须在工具容器可读，证书/私钥由部署方只读挂载；不静默删除未知TLS选项。生产外部连接应配置受信证书与verify-full，不以默认prefer声称验证了服务端身份。PG18 pg_dump官方支持源服务器9.2至18，较新主版本拒绝；本次真实验证18.6，未搭建全部历史/未来版本。建议使用兼容18或更新的目标/工具和必需扩展，不能保证向更老主版本恢复。

### 发布、权限和完整性

根和每件目录0700，dump/清单/归属密钥/临时文件0600；每件随机UUID目录exclusive创建，不覆盖。根各级拒符号链接，既有非空根必须已是指定属主0700；首次空专用目录才初始化权限。写入后显式fchmod/fchown到TEMPLUX_HOST_UID/GID，不让umask扩权限。结果只报告 `containerOwner`，它不是跨Docker共享文件系统验证宿主数值的承诺。

pg_dump custom归档必须非空且有PGDMP头，工具exit0，无诊断，pg_restore --list和全归档到/dev/null解码通过；流式SHA256与字节数写入签名清单。dump和临时清单fsync，最后exclusive硬链接发布manifest.json作为成功标记，再移临时名、fsync目录。没有成功清单的不当成功；进程/存储异常可能留下需核验的未完成件和任务锁，绝不自动抢锁/重试。标记发布后的sync/响应失败明确“结果未确认”，不可据失败退出码假定无产物。普通失败只清理本次目录和私有连接文件，不删除既有成功。

清单有项目名、随机根归属、配置端点/库名SHA256来源指纹、manual/automatic、ISO UTC时间、单调automatic序号、toolMajor18、custom、bytes/hash、restored:false及本地HMAC。序号在根锁内基于仍可信成功automatic递增，不依赖墙上时钟顺序；时钟回拨也不能把新成功产物淘汰。来源是配置目标指纹，不是远端服务身份认证证明；需结合受控部署配置核对。清单/密钥本身私有，不进入普通日志。

这些校验确认工具可读和字节一致，**不等于已完成数据库恢复或业务语义验证**。T22验收另有真实scratch恢复核对。恢复只需标准archive.dump，不依赖本地HMAC密钥；签名只限制自动删除归属，不防已获宿主权限者篡改。代码版本/迁移历史、兼容配置、.env必要密钥、扩展、角色/权限及文件资产须另行准备。T22当时尚未交付恢复CLI/恢复后会话撤销；T23在本文末更新这两项。自动切换数据库仍未交付，不能直接将scratch开放为生产。

### 自动保留、并发和失败结果

`TEMPLUX_BACKUP_RETAIN`未设置默认5，合法1–100，显式空/0/非法拒绝。仅在新的automatic成功发布后，复验**同根归属/项目/来源**成功automatic签名、完整字段/文件权限、SHA和字节，再保留最近N件；不同目标数据库历史保守保留，不跨源删除。manual、外部参考、无归属、坏签名/坏字节/改权限、额外文件或链接不参与删除。不能承诺损坏/未知件或manual的总磁盘容量。

根 `.owner.json` 的密钥缺失则建立新归属，旧件不会匹配而保留；损坏、不同项目或根设备/inode身份改变则拒绝继续，不覆盖。完整目录复制、文件系统重挂载等导致身份变化时同样保守阻断，先人工核实并将旧归属文件安全另存后才建立新归属；旧件不纳入新清理。不能仅凭文件名/分类自报认领旧件，设备/inode也不是防宿主篡改认证。

锁顺序为migrations（如适用）→数据库backups会话级try advisory锁→根exclusive `.lock`；冲突立即拒绝。两个数据库使用同根也由根锁排斥。正常成功/错误清理锁并释放SQL连接，数据库会话丢失不自动抢根锁。未获取T21维护锁，不自动halt/停写；标准一致快照包含快照时刻已提交数据，不含稍后业务写。升级前如需确定停写点，操作者先按T21显式维护合同操作，不能把逻辑备份当作持续复制或停写证明。

清理失败退出非零但结果保留 `backupSucceeded:true, retentionSucceeded:false`；临时文件/锁清理失败另有 `cleanupSucceeded:false`，不得伪称备份没发生。迁移前自动保留失败也阻止迁移，已发布新件保留供核验。未完成的未知结果不自动重试。清理只unlink经过核对目录里的两个已知文件，再删除空目录，不递归清理未知成功件内容。

### 迁移与启动

实际migrate在SQL迁移锁内先验证历史与pending，再识别已有关系/应用schema/公共函数：已有结构且pending必须beforeChange成功；**备份完成前不创建或更新迁移表**。空库初始化或无pending跳过；无pending仍按既有schemaVersion校验。内部migrate调用若已有pending却没有备份回调，直接拒绝。生产独立migration入口自动备份，统一start构建工具镜像、启动DB、运行该入口成功后才启动应用；Web不负责迁移。

父规格故事56允许显式外部备份参考：`migrate --external-backup-reference RECORD --confirm` 或 `./templux start --external-backup-reference RECORD --confirm --json`。仅在确有pending/已有结构时，以0600签名 `external-UUID.json` 持久记录原参考、当前目标指纹、verified:false，再跳过重复dump；写记录失败仍阻断迁移。普通输出仅记录ID/unverified状态，不回显参考。它不是自动备份失败后的隐式fallback，也不声明验证了外部产物。操作者对恢复可用性负责；不调用云API。

### T24：升级闭环与重试边界

`start`构建当前发布的标准api/web/entry/migration目标，启动Compose DB，再以同一Compose项目/环境运行一次性migrate；只有该进程退出0（包含最终schemaVersion验证）才执行应用up。配置外部DATABASE_URL时迁移和应用使用该目标，不自动切回Compose内库；本地database仍会启动，但不因此成为迁移目标。Web只消费就绪状态，永不自行迁移。

宿主`TEMPLUX_BACKUP_DIR`是Docker daemon使用的bind源，容器`TEMPLUX_BACKUP_DIR=/opt/templux/backups`是工具写入位置；二者不能混用。management通过内部`TEMPLUX_BACKUP_BIND_DIR`保留宿主原值，仅在调用子Compose时将其还原为插值变量；相对路径按相同project-directory解析，空格不拆词。直接自建management容器并编排Compose的项目亦须提供该宿主投影；不编排Compose的备份命令只使用容器写入路径。该投影不是秘密或权限凭据，宿主操作者须核对真实挂载及属主。

这是显式部署步骤，不是在线升级协调器。已有业务运行时，维护者先评估迁移兼容性、停写窗口与可恢复点；需要停写时按T21显式halt并检查结果，不能仅因dump快照一致就继续不受控业务写。`start`不会自动停止旧容器；失败阻断的是本次后续启动，不能据此声称之前运行的进程已停止。T21 offline/gate/释放回执和T23 restore-block不会被migrate/start清除；即使容器已健康且start退出0，入口也可能仍维护503，开放须遵循明确resume/恢复核验合同。

每项SQL及该项history记录同一事务，**不是整个待迁移批次一个事务**。例如0009已提交、0010失败，0009仍保留；失败项事务正常ROLLBACK时其SQL和history不提交。全部项已提交但后置结构校验失败时，history可能已到目标版本，仍不启动。history checksum/未知版本失败在备份及元数据变更之前阻断。标准失败JSON为`ok:false`，migration诊断stderr为`migration_failed`，start另报告非零容器结果；这些输出没有声明全批回滚，操作者须检查实际history/结构和对应备份，不能仅凭退出码推断已提交数量。原始SQL/连接诊断不透传。

安全重试顺序：确认原进程退出/连接断开、私有目录锁及产物结果→核对history前缀和checksum/实际schema→确认失败事务已回滚且待执行SQL仍来自原受审发布→明确再次start/migrate。正常失败释放迁移/备份锁，不抢遗留根锁。已确认已提交的迁移不会重复执行；无pending仍验证schema且不再次备份。SQL结果/COMMIT未知、checksum不符、后置验证失败或遗留锁无法解释时，不自动重试/删除history/修改已应用SQL/自动restore；保持维护闭合，按T23恢复报告及明确目标恢复流程人工处理。迁移只取migration→backup→根目录锁，不取维护操作锁、不发布入口回执；恢复按T23顺序协调，外部DDL及其它运维必须由部署方串行安排。

可复跑旧0008→0010、失败启动阻断、外部参考/目标、并发锁与会话持久性见[T24验收](../discovery/t24-acceptance.md)。本票不交付源码升级候选/共享包发布设施，也不更改自动保留5的现有合同。

### 宿主UID映射

包装器默认仍传实际 `id -u/-g`。显式覆盖必须成对且为规范0–4294967294整数；空、负、前导零、超界在调用Docker前拒绝。相同覆盖也影响既有凭据/init的目标属主，不能把为备份核实的映射当作其它部署已验收。

当前macOS绑定映射实际呈现容器0:0、宿主501:20，即使chown501:20返回成功，容器stat仍0:0。默认严格检查会拒绝而非自动降为root。仅在独立核实该映射后可用 `TEMPLUX_HOST_UID=0 TEMPLUX_HOST_GID=0 ./templux backup --confirm --json`，再在宿主 `stat -f '%u %g %Lp' backups backups/backup-*/archive.dump` 独立验证实际501:20及0700/0600；其它平台不能照抄。Linux volume已单列实际1001:1001/0600验证，不忽略真实属主或权限错误。

### T22 F1 修复：空库与已有对象定义

不能只按表/视图relkind或函数判断空库。迁移锁内、所有迁移元数据修改前，通过pg_depend的schema依赖识别public里的命名对象：独立enum/domain/composite/range以及关系、过程、运算符、排序规则、文本搜索等不再依赖手写关系类型枚举。自定义用户schema即使尚无对象也视为已有结构。单独的空工具历史表仍为初始化元数据；有已应用历史时一律走原pending保护。

不属于schema的对象另外检查数据库目录：用户扩展、语言、cast、transform、FDW/server/user mapping、event trigger、publication、本数据库subscription、large object及default ACL。initdb系统默认对象、默认public空schema和默认plpgsql不会令真正空库触发备份。扩展即使安装在pg_catalog仍识别；对包含内置记录的extension/language/cast目录，按Postgres的FirstNormalObjectId=16384区分正常运行创建对象与initdb记录（[PG18源码说明](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/include/access/transam.h)）。模板项目对象使用public或自定义schema，不向保留的系统schema写业务对象。集群共享角色、tablespace及部署配置仍不属于单库逻辑备份范围；目录读取权限不足或目标版本缺少目录会阻断，不退化为空库。本查询按PostgreSQL18验证；pg_dump工具可读源9.2–18不代表模板迁移支持这一整个版本区间。非空检测只决定备份前置，不等于每种对象均已包含在归档；标准pg_dump范围、角色/权限和扩展恢复前提仍需分别核对。

判定只在有pending时执行；真正新空库跳过备份，无pending仍跳过，即使当前备份路径不可用。已有类型库备份失败必须保持原对象、无新历史表或记录；合法路径须先发布可读automatic归档才迁移。该修复不改变迁移锁→备份锁→根锁顺序，不自动停写、不中途新增迁移，也不修改历史SQL。独立类型的真实标准镜像/坏路径/归档scratch及34项定向证据见[T22修复验收](../discovery/t22-fix-acceptance.md)。

### T22 F1 第二轮补齐：访问方法

自定义table/index access method也是单库非schema对象。补查pg_am的正常运行OID（>=16384），内置heap/btree等initdb记录不计入已有用户结构。这与PG18.6 pg_dump的selectDumpableAccessMethod使用同一OID边界，不按AM名字猜测；读取目录报错仍在原查询中向外失败，不退化为空库。非空检测不保证每个对象/插件能在任意目标恢复，角色/表空间和插件二进制等前提仍按单库备份范围另行准备。

本轮以PG18.6 pg_dump.h的DumpableObjectType及pg_dump.c的相关选择/输出函数作有界核对：独立非schema根对象为extension、procedural language、cast、access method、transform、FDW/server、default ACL、large object、event trigger、publication、subscription；本次明确遗漏为AM，其余已有对应目录检查。user mapping虽非独立DO根，已有检查且随server输出；关系/类型/函数等命名对象与索引/约束/策略、复制关系等子对象另由schema或父对象识别。数据、统计及归档边界不是新增独立根；数据库根元数据也不能以“数据库存在”作为非空判断。这是该版本源码类别的有界核对，不宣称穷尽所有DDL、所有属性变化、插件或未来版本。源码映射与实际36项、标准target/scratch证据见[T22 AM补齐验收](../discovery/t22-am-fix-acceptance.md)。

## T23：明确目标恢复

菜单26或一行命令：

```sh
./templux restore --mode original --target current \
  --archive /opt/templux/backups/backup-UUID/archive.dump \
  --sha256 INDEPENDENTLY_CHECKED_64_LOWERCASE_HEX --confirm --overwrite --json
# 目标URL从受限环境导出，不能把密码写进参数或终端历史。
./templux restore --mode independent --target env:TEMPLUX_RESTORE_TARGET_URL \
  --archive /opt/templux/backups/selected.dump \
  --sha256 INDEPENDENTLY_CHECKED_64_LOWERCASE_HEX --confirm --overwrite --json
```

每次模式和目标必须明确，无默认；脚本包装器在任何Docker探测/构建前拒缺项，管理入口重复校验。菜单在容器内填写四项并确认。`current`也是显式选择：original须证明等于当前库，independent须证明不同。比较`pg_control_system().system_identifier`与数据库OID，URL拼写、主机别名、用户名或TLS查询项差异不能绕过；无法证明身份就拒绝。物理克隆可能保留相同标识/OID，此时保守拒绝独立模式，不以更换URL绕过。结果显示实际身份和目标配置键，不回显URL。

确认摘要明确：覆盖归档中的对象，**不等于整库擦除**；不自动删除归档外对象，额外对象/依赖也可能令clean失败回滚。目标须已存在且由操作者准备，不创建/删除数据库、不改.env/连接、不自动部署或resume。已有用户对象时先发布manual安全备份，复用T22完整对象检测；类型、AM等不能被误当空库。备份失败在halt前拒绝；该manual不被自动保留清理。此快照不承诺包含后来提交的写入。

### 可信输入、版本及权限

宿主授权操作者须明确选择并信任归档。PostgreSQL恢复能执行源超级用户选择的任意代码；SHA256只验证选定字节，不验证SQL安全，模板不是SQL沙箱，不接受公众上传。输入为完整custom归档、无symlink路径、指定宿主UID/GID的0600普通文件；先复制到0700私有暂存，核对外部已确认SHA、列表和完整解码。外部归档须先安全放入专用备份挂载目录，或由授权宿主显式只读挂载；不自动挂载任意宿主目录。所有敏感暂存正常结束清理，工具/进程原始SQL与libpq诊断不进普通输出。

工具固定18.6，目标支持/实测PostgreSQL18。首版只接受与当前发布**精确相同**迁移版本/checksum的完整`templux_migrations` COPY数据；旧/新/部分/无历史或INSERT改写归档拒绝，不自动升级降级。解码SQL上限512MiB，工具15分钟超时，超限或诊断在停服前拒绝。大库须另评资源和超时。兼容代码、配置、必要认证/数据库/TLS密钥、插件及业务文件仍单独准备；数据库备份不包含这些。恢复输入不需要保留归属HMAC密钥；安全备份目录仍遵守T22权限/归属合同，可用新的专用目录。

操作者须有目标ALTER/CONNECT/CREATE、被替换对象的属主/扩展权限、身份函数EXECUTE及终止目标其它会话权限。预检数据库、schema/关系/类型/函数属主、服务器版本、预备事务和已有会话终止能力；特殊插件SQL仍可能在事务中失败。无CREATEDB也能恢复预先存在的目标，已实测NOCREATEDB/NOSUPERUSER属主；必要函数和终止权限由部署授予。使用no-owner/no-acl，数据库对象归恢复角色，不重建集群角色/ACL；应用人员/Agent、责任人、身份和业务角色数据保持，不擅自授予。

必须预先建立**同集群不同数据库**的救援连接，默认目标URL的postgres库；不可用时以受限环境`TEMPLUX_RESTORE_ADMIN_URL`指定其它已有管理库。管理连接须可ALTER目标且集群身份匹配；目标就是postgres时必须另选管理库。权限、版本、归档、身份和救援检查尽量在halt前完成，不假设外部有建库权限。

### 顺序、提交及会话

原库要求entry存活，复用T21 halt等待业务写屏障、可靠审计及停止web/api，保留entry/DB。目标迁移→备份→维护操作锁协调工具并发，halt后复验offline。原库持久写入共享卷`${TEMPLUX_MAINTENANCE_RELEASE_FILE}.restore-block`（runId/hash），独立于被恢复SQL。block存在或状态未知均禁止入口释放，包括旧online/gate0的初装回退；普通maintenance-resume明确拒block，不能覆盖旧回执绕过。independent不改当前项目状态/服务/block。

目标管理连接和psql恢复事务就绪后，通过救援连接设`ALLOW_CONNECTIONS=false`，终止其它目标连接，再查无残留或预备事务。新连接由数据库拒绝，被终止事务回滚；原库此前还经T21等待业务写结束。宿主超级用户/数据库属主能改变这些安全状态，不承诺抵抗同时执行越权DDL的宿主操作者。

psql `-X --single-transaction --set ON_ERROR_STOP=1 --file -`在一个事务执行clean恢复、历史和维护guard校验、删除所有人员/Agent旧auth_sessions、OAuth及登录方式关联请求、SQL offline与gate/version递增、`database_restored`强审计。仅该事务内短暂online供原guard完成清理，未禁用guard，外部连接仍关闭。旧online/旧回执/旧证明不会对外生效。审计details持久记录restoreRunId、restoreSha256、restoreMode；数据/证明清理/审计一起提交。没有新增迁移或每次重启换密钥。

psql确认COMMIT后，用保留连接再执行标准schemaVersion、证明清空、offline及runId审计复核。通过才重允数据库连接，再按归属移除原库block；**SQL仍offline，入口继续503**。另一次显式maintenance-resume执行健康检查、强审计和新gate回执才开放。independent未来明确接入其部署后也须该步骤；旧cookie401，新登录仍受人员/Agent环境开关、状态/角色及组织配置约束，不会因恢复启用PROD Agent。正常重启仍保留有效会话。

### 结果与故障救援

JSON stdout包含runId、mode、目标配置键/真实身份、stage、archiveSha256、dataCommitted、connectionsClosed、restored和accessReady；成功另有SQL state。人工输出展示同一结果；stderr为安全摘要，不含URL、密码、cookie或归档内容。参数解析前错误无runId。恢复成功为强审计；失败/输入拒绝只保证结构化运行诊断及宿主保存的报告，不伪称DB故障时失败审计已保存。

事务/验证/关键审计失败会回滚，但目标仍禁连接，原库block保留。COMMIT回执丢失即`dataCommitted:"unknown"`，不凭退出码推断未提交。重允连接回执或后续步骤失败会有界重新禁连接（仅安全闭合，不重试恢复）；无法确认则`connectionsClosed:"unknown"`，不假称已关。临时清理失败报cleanupSucceeded:false。进程/宿主被杀可能留下私有暂存、block和禁连接状态；不自动抢锁、重跑或开放。

救援须由宿主操作者核对runId、stage、备份、数据、历史和审计，再决定保留原数据或重新恢复。**不要直接resume、删block或自动重跑restore。** 先停止所有业务/外部消费者、隔离目标专用网络，保留原库entry block。通过已验证管理库查`pg_database.datallowconn`，不用连接已关闭目标；容器已有psql，无宿主PG客户端：

```sh
# PGHOST/PGPORT/PGUSER/TLS和只读挂载的0600 PGPASSFILE由受限环境准备；无密码argv。
# PGDATABASE先明确为管理库；按部署另加受限passfile/证书挂载。
docker compose run --rm --no-deps --entrypoint /opt/pg-tools/bin/psql \
  -e PGHOST -e PGPORT -e PGUSER -e PGPASSFILE -e PGDATABASE \
  -e LD_LIBRARY_PATH=/opt/pg-tools/lib management -X --no-password --set ON_ERROR_STOP=1
```

在**消费者隔离且block保留**下，正确引用SQL identifier并显式`ALTER DATABASE "目标" ALLOW_CONNECTIONS true`，仅供管理核验。核对精确历史、数据、runId审计及全部旧session/OAuth/link清空；未知COMMIT可能实际完成。若决定保留失败前数据，须在业务写屏障下同事务清理旧证明、设置offline/gate递增及强审计，确认提交后复核。任何核验/审计失败重新禁连接并保留block。只有核验完成才按runId归属清理block，最后另行显式maintenance-resume；允许连接本身不等于恢复完成。该手工流程需要独占宿主运维控制，不是自动灾备编排；NOCREATEDB管理库救援及原库审计失败的完整回路见T23验收记录。

T23复用的对象检测对user mapping改用公开`pg_user_mappings`视图，只检查存在性，不读umoptions；原始pg_user_mapping对普通角色受限，不能把权限错误当空库。[官方说明](https://www.postgresql.org/docs/18/view-pg-user-mappings.html)。恢复任意代码/clean/权限选项依据[pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html)，单事务错误停止依据[psql](https://www.postgresql.org/docs/18/app-psql.html)。当前库身份不可读取/不可连接时独立模式同样拒绝，不能猜测它与目标不同；不是无条件灾难切换功能。

### T23 F1：恢复参数缺值前检

四个取值选项必须使用分开的`--option value`；不支持`--option=value`。值为空、EOF或下一个`--flag`时均在Docker前失败，失败标记不会因后面参数完整而被覆盖。先独立识别合法`--json`，因此其位于缺值之前或之后都只输出一个错误JSON；人工模式错误写stderr。参数值以`--`开头时拒绝，不以`--`分隔符等临时形式绕过；若文件本名为`--selected.dump`，提供实际完整绝对路径，例如`/approved/--selected.dump`。包含空格的合法绝对路径保持单一参数，容器仍统一验证归档、SHA、权限和目标，不扩大宿主恢复逻辑。菜单和顶层`--help`仍按既有转交规则处理，不新增help功能。开发宿主回归：`python3 tests/restore-wrapper.test.py`（标准库/假Docker，不改变产品CLI的Shell+Docker依赖）。
