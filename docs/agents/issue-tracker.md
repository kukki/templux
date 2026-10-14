# Issue tracker

本项目使用仓库远程 origin 对应的 Gitea Issues：

- 服务：https://gitea.whynots.top
- 仓库：Swython/Templux
- 接口：已连接的 Gitea issue_read、issue_write、search_issues、label_read、label_write 工具。

发布规格前核对现有 issue 和标签；创建 issue 时使用结构化 body 参数，保留真实换行。发布后读取确认正文与标签，不创建重复 issue。不把此项目当作 GitHub 或另建本地 issue tracker。

to-spec 按用户显式调用发布规格并应用 ready-for-agent；此授权不包括源码推送、合并、部署或联系其它人员。

## 已发布规格

- [Issue #1：Templux 首版规格：可复用模板、统一网页元素及受控升级](https://gitea.whynots.top/Swython/Templux/issues/1)
- 本地正文：docs/specs/templux-v1-prd.md
- 标签：ready-for-agent（ID 25）
- 发布后已读取核验：远程正文与本地规格完全一致，标签已生效。
