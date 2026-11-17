# 安装 Argo Studio 的 Codex 插件

本仓库同时提供 **Argo Studio Mac 应用**和 **Argo Studio Codex 插件**。本页安装的是聊天客户端里的插件，应用下载请前往 [Releases](https://github.com/Marting5627/Argo-Studio/releases)。

插件让聊天客户端连接同一台 Mac 上的 Argo，使用素材库、生成板和创作工具。连接要求 Apple Silicon Mac、macOS 26.0 及以上，以及 Argo 0.4.7.1 或更新的兼容版本。

## 复制给另一台电脑上的 AI

将下面整段发给目标电脑上的 Codex：

```text
请帮我在这台电脑安装 Argo Studio 正式 Codex 插件。
安装说明：https://github.com/Marting5627/Argo-Studio/blob/main/INSTALL-PLUGIN.md
Git 安装源：https://github.com/Marting5627/Argo-Studio.git，分支 main
插件安装入口：.agents/plugins/marketplace.json
插件目录：plugins/argo-studio
插件标识：argo-studio@argo-studio-local
请按当前 main 分支的安装说明安装完整插件，并核对实际安装版本；不是只安装里面的 Skill，也不是下载 Mac 应用。
```

## 在终端安装

在目标 Mac 上打开终端；已安装的 Codex CLI 需要支持 `codex plugin`：

```sh
codex plugin marketplace add https://github.com/Marting5627/Argo-Studio.git --ref main
codex plugin add argo-studio@argo-studio-local
```

第一条命令添加本仓库为插件来源，第二条安装 **Argo Studio**。`argo-studio-local` 是正式插件来源的固定名称；测试插件使用独立标识 `argo-studio-test`。

安装后在桌面客户端的插件管理中确认 **Argo Studio** 已启用。如果尚未出现，按客户端提示重新加载；仍未出现时正常退出并重开客户端一次。

## 连接 Argo

1. 在同一台 Mac 打开 Argo 和需要使用的工程。
2. 在 Argo「设置 → Bridges」启用本机连接，按需要选择「请求批准」。
3. 回到聊天客户端，选择 **Argo Studio**，发送「打开素材库」。看到当前工程名称及素材后，即可使用。

另一台电脑需要在那台电脑上安装应用、启用连接并授权自己的素材。安装源不会携带原电脑的工程、API Key 或本机连接授权。

## 已安装时更新

```sh
codex plugin marketplace upgrade argo-studio-local
codex plugin add argo-studio@argo-studio-local
```

GitHub 更新不会保证当前客户端立即刷新。更新后核对插件版本和实际连接；是否需要重新加载由客户端决定。

## 核对安装入口与版本

| 文件 | 用途 |
|---|---|
| [.agents/plugins/marketplace.json](.agents/plugins/marketplace.json) | 客户端识别插件来源与安装目录 |
| [plugins/argo-studio/.codex-plugin/plugin.json](plugins/argo-studio/.codex-plugin/plugin.json) | Codex 插件名称与实际版本，读取 `version` 字段 |
| [plugins/argo-studio/compatibility.json](plugins/argo-studio/compatibility.json) | 所需 Argo 版本和连接能力 |
| [插件使用与权限](plugins/argo-studio/README.md) | 素材、生成板、创作 Skill 与权限说明 |

GitHub 文件旁的「上次提交说明」是历史记录，不是当前插件版本。判断仓库是否提供插件时，请读取当前 `main` 分支的安装入口和版本文件，不仅依赖搜索摘要或旧网页缓存。

安装命令和插件目录机制参考 [Codex 官方插件文档](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli)。
