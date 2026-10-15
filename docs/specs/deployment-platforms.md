# 部署与开发平台范围

## 2026-10-16 用户决策

用户明确：“项目只部署在ubuntu主机作为uat和pord，以及可能在macos开发主机”。本次按 Ubuntu UAT/生产（PROD）及 macOS 可选开发解释，替代此前 Linux/macOS/WSL2 并列支持与验收要求。关联任务：`01a141ea-8c7b-7351-95d8-eecc4d10e422`；原 CLI 决策的变更记录见 [ADR 0025](../adr/0025-container-cli-with-interactive-and-scripted-entry.md)。

| 环境 | 当前范围 | 验收状态 |
| --- | --- | --- |
| Ubuntu 主机 | UAT、生产部署；Docker、Compose、基础 Shell 入口 | 真实主机尚未执行；版本、架构及 Docker/Compose 版本待环境提供后核验，不承诺全部 Ubuntu 版本/架构 |
| macOS 主机 | 可选本地开发；Docker Desktop、Compose、基础 Shell 入口 | 既有 macOS arm64 开发实测及默认网络冷依赖补验保持原范围，不能替代 Ubuntu UAT/生产验证 |
| Windows / WSL2 | 不在当前支持和交付验收范围 | 移出范围，不是测试通过；不再作为 #30 / 父 #1 的待补平台项 |

其它 Linux 发行版和原生 Windows/PowerShell 不作当前支持承诺。文档中的通用 Linux、容器或内核背景说明不表示额外宿主平台已经支持或通过。Docker Desktop Linux VM/容器不等同 Ubuntu 宿主。

## 真实剩余验收

- 获得明确 Ubuntu 版本/架构的授权隔离主机后，按 [T29 矩阵](../discovery/t29-matrix.md) 复跑安装、配置、CLI、恢复及升级等入口，记录实际结果。
- 真实 Feishu 组织验收仍需本人授权，保持 T03 / #4 pending；密码登录或测试协议模拟不能替代。
- 当前 macOS 默认网络冷依赖补验见 [独立复核](../discovery/t29-cold-install-review.md)。它不说明 Ubuntu 或真实飞书已经通过。

本次只是文档范围决策，不授权访问、停启、迁移或部署任何现用 UAT/生产服务器。Ubuntu 验证仅在另行明确授权的独立环境开展；既有隔离步骤无需新建框架。#30 / 父 #1 不因移除 WSL2 自动完成。

## 历史与产物

历史 review、候选计划、测试日志、交付包及其冻结文档快照保持原样；其中 Linux/WSL2 文字反映当时范围，现行范围以本文件为准。WSL2 不再要求补验，不改写成已验收。本次不重新打包、修改产物 SHA、伪造平台结果或重复运行构建/数据库/浏览器矩阵。
