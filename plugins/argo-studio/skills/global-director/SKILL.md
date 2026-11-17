---
name: global-director
description: 在外部聊天生成完整六板块全局导演稿，通过 MCP 导入 Argo 原生全局预览；已有逐镜正文直接入工坊时使用 shot-director。
---

# 全局导演稿

默认由当前外部聊天完成创作，将结构完整的全局稿导入 Argo 原生预览，不调用 Argo 内部模型重复生成。预览不是正式稿；用户仍在 Argo 查看、编辑、采纳、保存和创建或映射镜头。

先用 `argo_tools` 查询所需区域，再按完整 `tool` 读取该项输入/输出合同；不遍历全部工具。导演工具通过 `argo_director`，工坊工具通过 `argo_workshop` 调用，参数统一为 `{tool:"原生工具ID",arguments:{…}}`。

工坊每个 Shot 只有一套当前提示词，分“自定义／导演稿”两来源；A–D仅选择生成候选，正文不带 `lane`。模型、候选或参数差异统一经 `generation.proposal` 提交：单项只传该字段，多项可一起传，省略保持、null拒绝；先用 `generation.inspect` 与当前选项核对。清型号用 `clearModel:true`，移除型号参数用 `clearModelParameters`，取消全部候选用 `candidateLanes:[]`。接受提案后在生成板核对；“覆盖参数”沿同一 `generation.apply` 一次确认后直接保存并回读新版本，不进入本地草稿恢复流程。生成仍分别确认报价与提交。外部不能修改设置或读取本地模型连接配置；业务渠道、模型、缓存余额和有效报价按工坊合同读取。

1. 整理简报、必须保留项、排除项、镜头顺序、每镜时长、总时长和比例。先检查 `argo_plugin_status`，宿主必须支持 `director.global-preview.external.v1`；不支持时明确要求兼容宿主，不回退到内部 API。
2. 对话沿用完整软件编号，如 `Shot01`、`Shot03-C2-A`、`图片001`。通过 `argo_resolve_object` 核对真实对象；需要理解素材时调用 `argo_read_asset_media`，保留完整编号、稳定句柄和 `sourceRevision`。不能按顺序、缩略图或旧描述猜内容。视频抽样不证明逐帧或音轨检查。
3. 经 `argo_director` 调用 `director.globalTemplate`，按本次真实 `referenceIDs` 读取原生 `schemaJSON`、模板、六板块说明、`contractVersion`、`contractHash`、`expectedRevision` 和 `referenceLimits`。三类引用按真实素材身份跨全稿去重计数，不能把素材库总量当引用数；超限交由用户调整，不丢引用或修改设置。它与后续提示词汇总不是同一格式。来源、工程、引用或上限变化后重新读取，不能照抄旧版本合同。
4. 在外部聊天生成完整稿件：全片约束、比例、总时长，以及每镜唯一临时 `id`、标题、时长、完整六板块、引用和问题项。按原生字段组织，毫秒合计必须一致；临时镜头 ID 不是现有 Shot 身份。引用使用真实稳定对象与版本，不把正文里的 `@` 字样当作已绑定引用。
5. 为明确的新导入计划创建 UUID `planID`，附上来源、当前合同身份、工作区版本和 `draft`，调用 `director.validateGlobalDraft`。根据返回的字段路径在外部修正错误；不调用内部模型补写、丢章节、改时长或收费回退。
6. 校验通过后调用 `director.importGlobalDraft`，使用真正客户端批准表单接受一次。确认摘要只展示操作、范围和必要引用，正文仍在聊天与预览中，完整输入由计划绑定。若返回 `operationRef`，仅查询同一操作；超时、UNKNOWN、断连或模型后续回复失败都不重做。
7. 只根据真实回执报告预览状态。`previewReady` 不等于已保存正式稿，导入不自动创建 Shot。引导用户在 Argo 原生全局预览审阅、接受并保存，再创建或映射镜头；没有原生回执不能宣布这些步骤完成。导入链路的 `modelRequestsStarted=0` 仅指未新增 Argo 内部模型请求，不代表外部聊天无 token 消耗。

仅当用户明确选择由 Argo 内部 API 生成时，才使用现有 `director.generateGlobal`。这是独立的模型请求与批准流程，不作为外部稿校验失败的补救；型号、镜头数、次数和预算按用户需求及实际能力确定。

遵循原生素材类型、模型能力、容量、冲突、批准和保存规则。被拒绝时说明原因并保留计划，不静默换路线、丢引用或绕过校验；已完成和失败步骤分别报告。
