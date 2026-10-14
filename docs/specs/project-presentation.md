# 项目品牌与呈现配置合同（T02）

T02 基于父规格 #1、任务 #3 和 ADR0013 实现项目级配置，不提供终端用户主题、语言、时区切换。配置属于新项目，应随新项目源码版本管理。

## 存放与载入

- `config/presentation.json` 是部署实际配置；`shared/default-presentation.json` 是初始化新文件的模板默认值。修改前者即可定制项目，不必修改默认值源。
- `schemaVersion: 1`；全部字段必填且拒绝未知字段。`./templux config-check --non-interactive --json` 校验实际文件。
- Compose 将整个 `config/` 目录只读挂入前后端，管理容器可写；目录挂载允许原子替换文件。前后端使用同一共享校验器，在各进程第一次载入后保留配置快照。
- 修改已有字段后执行 `docker compose restart api web`，无需重新构建。前端页面及 metadata 在请求时载入，不在 Next.js 构建时固化；启动命令先校验配置，API 无效配置拒绝启动，Web 无效配置返回错误而非静默回退。
- `.env` 仅承载环境、端口、数据库连接及密钥。呈现配置只含公开值，不得放秘密；未知字段拒绝并且错误不回显配置值。`TEMPLUX_PROJECT_NAME` 是 Compose 隔离名称，独立于网页的 `project.name`，初始化不会修改 `.env`、Compose 名称、源码、数据库或历史。

## 字段

| 字段 | 合同及默认值 |
| --- | --- |
| `project` | 非空 `name`、`version`；默认 Templux、0.1.0。版本是项目应用版本，不代表模板包版本。 |
| `brand` | 非空 `wordmark`、可为空的 `mark`、可为空的 `logo`。Logo 仅允许本项目 `/…` 路径，不接受外部 URL、协议相对 URL 或 `..`。Logo 存在时替换文字标记，品牌文字继续显示。 |
| `theme` | `colorScheme` 为 light/dark；background、surface、text、muted、border、accent、accentText、success、danger 均是六位十六进制颜色，并映射同名 CSS 变量。默认浅色蓝色强调。 |
| `header` | `visible`、`showBrand` 布尔值；`note` 为项目可替换文字。可隐藏整体、隐藏品牌或通过空文字隐藏说明。 |
| `footer` | `visible`、`showVersion` 布尔值；`text`、`copyright` 可替换或留空。默认显示应用版本。 |
| `language` | 合法且非空的 BCP47 语言标记；默认 zh-CN，写入 html lang 并用于通用管理时间。不会自动翻译配置里的文字。 |
| `time` | `timeZone` 是 Intl 支持的时区，默认 Asia/Hong_Kong；`showSeconds` 默认 true。仅控制管理时间展示，不改变底层 ISO 时间及毫秒，不约束业务日期类型。 |
| `copy` | 全部通用状态页文案集中在此，默认简体中文；替换语言时应同时替换这些文案。所有内容按纯文本渲染，不接受任意 HTML/CSS。heading、intro、scopeNote 等支持项目替换；空 scopeNote 隐藏区域。 |
| `navigation` | orientation 为 vertical/horizontal，默认 vertical；initialExpanded、allowCollapse 为布尔值。为后续导航任务保留合同，当前公开状态页没有导航控件。 |
| `elements.pagination` | pageSize 为整数且属于 pageSizes；集合非空、不重复、最多20项，每项1–1000。默认10及5、10、15、20、25、50。为后续按需网页元素保留合同。 |
| `elements.notifications` | durationMs、desktopVisible、narrowVisible 为1–3600000的整数；默认15000、3、1。后续通知任务消费这些项目默认值，当前状态页不增加通知控件。 |

字符串上限2000字符，拒绝不可显示的控制字符；禁止未知字段以避免拼写错误被静默忽略。自定义配色应自行检查对比度；四套内置配色使用同一变量机制。当前页头页脚均为普通文档流，随内容滚动；固定、吸附布局及实际导航/元素交互由对应后续票实现，不在 T02 提前加入控件。

## 初始化与覆盖

复制源码目录或源码包后，在副本中执行（宿主只需 Docker/Compose/Shell）：

```sh
./templux init --name '我的项目' --brand '我的品牌' --theme dark-brown \
  --version 1.0.0 --copyright '© 我的组织' \
  --overwrite --confirm --non-interactive --json
./templux config-check --non-interactive --json
./templux start --non-interactive --json
```

无参数菜单选择7，或 `./templux init --interactive`，提供名称、品牌与可选配色，再查看目标与摘要并输入 yes 确认。没有配置文件时使用模板默认值，品牌缺省为新项目名称；复制出的默认文件已经存在，须确认覆盖。脚本模式必须提供 `--name` 和 `--confirm`，已有文件还必须 `--overwrite`。缺参数立即退出1，不等待输入；成功退出0。JSON stdout 仅一个结果对象，诊断写 stderr。

`--theme` 可选 light-blue、dark-black、dark-brown、dark-yellow。`--brand`、`--version`、`--copyright` 可选；不指定时保留现有值，包括现有品牌。要随名称改品牌需同时传 `--brand`。`--config /完整路径/variant.json` 可导入一份完整合法配置，以导入文件为基底，再应用显式参数；不同于逐字段合并。容器可访问副本目录的宿主绝对路径（宿主包装只读挂载），或 `/opt/templux/config/variant.json`。配置字段更复杂时通过完整导入或直接修改 JSON。

写入前完整校验，在同目录创建暂存文件并原子替换；新文件使用排他创建，避免并发创建静默覆盖。失败保留原文件，临时文件清理；替换保留原文件属主/权限，新文件由包装传入宿主 UID/GID并使用0644。已确认覆盖的并发更新没有三方合并，运维需串行执行初始化。配置中的公开文本会输出名称与操作摘要；密钥不应进入该文件。

已有呈现值修改用重启即可。新 Logo 放入 `apps/web/public/`，`brand.logo` 填 `/文件名`；新资产和代码需重新构建 Web 镜像。初始化不生成新目录，也不引入来源项目数据。

## 验收入口

```sh
./templux test --non-interactive --json
./templux typecheck --non-interactive --json
./tests/presentation-installation.sh
```

第三个入口复制独立源码到忽略的 `test-results/`、隔离 Compose 项目与数据库，使用31010/31810端口，验证初始化、真实状态、Logo资产构建、仅重启生效且镜像ID保持、区域隐藏与替换、语言时区精度、无效配置拒绝启动；最后清理自己的容器和数据卷。环境中这些端口须空闲；可沿用现有环境入口覆盖，例如 `TEMPLUX_HTTP_PORT=31020 TEMPLUX_API_PORT=31820 ./tests/presentation-installation.sh`。截图供人工审查，不使用像素差作为门禁。
