// Plugin presentation only. All native business, approvals and media are
// relayed without interpretation. This executable never starts Argo.
import Foundation
import CoreFoundation
import Darwin

private let panelURI = "ui://argo-studio/plugin-panel-v1"
private let limit = 12 * 1024 * 1024
private var stopSignal: Int32 = 0
private enum Failure: Error { case invalid, closed, limit }
private struct Queue {
    var bytes = Data(), offset = 0
    var count: Int { bytes.count - offset }
    mutating func append(_ data: Data) throws {
        guard data.count <= limit - count else { throw Failure.limit }
        if offset > 0 && (offset >= 262144 || offset == bytes.count) { bytes.removeFirst(offset); offset = 0 }
        bytes.append(data)
    }
    mutating func write(_ fd: Int32) throws {
        guard count > 0 else { return }
        let size = bytes.withUnsafeBytes { Darwin.write(fd, $0.baseAddress!.advanced(by: offset), count) }
        if size > 0 { offset += size }
        else if size < 0 && ![EINTR, EAGAIN, EWOULDBLOCK].contains(errno) { throw Failure.closed }
    }
}
private struct Pending { let method: String; let firstPage: Bool }

private final class PanelBridge {
    let child = Process(), input = Pipe(), output = Pipe()
    var upstream = Queue(), downstream = Queue()
    var clientBuffer = Data(), hostBuffer = Data()
    var hostLine = false, capture = false, initialized = false, ready = false
    var deferred: [Data] = [], pending: [String: Pending] = [:]
    var lastProjectState: String?
    let html: String

    init(helper: String, args: [String], panel: URL) throws {
        let data = try Data(contentsOf: panel)
        guard data.count <= 2097152, let value = String(data: data, encoding: .utf8),
              !value.contains("/* ARGO_GENERATION_BOARD_MODULE */") else { throw Failure.invalid }
        html = value
        child.executableURL = URL(fileURLWithPath: helper); child.arguments = args
        child.standardInput = input; child.standardOutput = output; child.standardError = FileHandle.standardError
    }
    func key(_ id: Any?) -> String? {
        guard let id, id is String || (id is NSNumber && CFGetTypeID(id as CFTypeRef) != CFBooleanGetTypeID()),
              let data = try? JSONSerialization.data(withJSONObject: id, options: [.fragmentsAllowed, .sortedKeys]), data.count <= 256 else { return nil }
        return String(data: data, encoding: .utf8)
    }
    func encode(_ object: [String: Any]) throws -> Data {
        var value = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys, .fragmentsAllowed])
        value.append(10); return value
    }
    func reply(_ id: Any, result: [String: Any]) throws {
        try local(encode(["jsonrpc": "2.0", "id": id, "result": result]))
    }
    func invalid(_ id: Any) throws {
        try local(encode(["jsonrpc": "2.0", "id": id, "error": ["code": -32602, "message": "打开面板不接受工程、路径或权限参数。"]]))
    }
    func local(_ data: Data) throws {
        if hostLine {
            guard deferred.count < 32, deferred.reduce(0, { $0 + $1.count }) + data.count <= limit else { throw Failure.limit }
            deferred.append(data)
        } else { try downstream.append(data) }
    }
    func descriptor() -> [String: Any] {
        ["name": "argo_asset_library", "title": "Argo Studio",
         "description": "打开 Argo Studio 面板。Argo 未运行或没有工程时也可打开空面板，不自动启动 Argo；素材和工程操作仍须原生授权。",
         "inputSchema": ["type": "object", "properties": [:], "additionalProperties": false],
         "outputSchema": ["type": "object", "properties": ["status": ["const": "panelReady"]], "required": ["status"], "additionalProperties": false],
         "annotations": ["readOnlyHint": true, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false],
         "_meta": ["ui": ["resourceUri": panelURI, "visibility": ["model", "app"]], "openai/ui": ["entrypoints": [["type": "thread"], ["type": "global"]]]]]
    }
    // These existing helper lifecycle methods do not require a project binding.
    // Their native execution and failures are never replaced by local results.
    func lifecycleTools() -> [[String: Any]] {
        var fields = Dictionary(uniqueKeysWithValues: ["bundleID", "applicationPath", "applicationVersion", "build", "helperPath", "mcpProtocol", "resourceURI", "panelSHA256", "recommendedPluginVersion", "pluginVersion"].map { ($0, ["type": "string"] as [String: Any]) })
        for name in ["schemaVersion", "businessVersion", "panelVersion"] { fields[name] = ["type": "integer"] }
        fields["capabilities"] = ["type": "array", "items": ["type": "string"]]
        let output: [String: Any] = ["type": "object", "properties": fields, "required": fields.keys.sorted(), "additionalProperties": false]
        func tool(_ name: String, _ description: String, _ props: [String: Any], _ required: [String], _ readOnly: Bool, _ schema: [String: Any]) -> [String: Any] {
            ["name": name, "description": description, "inputSchema": ["type": "object", "properties": props, "required": required, "additionalProperties": false], "outputSchema": schema,
             "annotations": ["readOnlyHint": readOnly, "destructiveHint": false, "idempotentHint": readOnly, "openWorldHint": false], "_meta": ["ui": ["visibility": ["app"]]]]
        }
        let connection: [String: Any] = ["type": "object", "properties": ["status": ["type": "string", "enum": ["ready", "projectChanged", "noProject", "authorized", "cancelled", "expired"]], "projectName": ["type": "string"], "projectRef": ["type": ["string", "null"]], "confirmationRequired": ["type": "boolean"]], "required": ["status", "projectName", "projectRef", "confirmationRequired"], "additionalProperties": false]
        return [tool("argo_plugin_status", "读取实际宿主、插件版本及兼容合同，不修改权限。", [:], [], true, output),
                tool("argo_project_connection", "检查项目连接，不读取未确认工程的素材。", [:], [], true, connection),
                tool("argo_switch_project", "客户端确认后更换到检测到的工程，不转移旧批准。", ["projectRef": ["type": "string", "minLength": 64, "maxLength": 64]], ["projectRef"], false, connection)]
    }
    func receiveClient(_ line: Data) throws {
        guard line.count <= 1048576 else { throw Failure.limit }
        guard let object = try? JSONSerialization.jsonObject(with: line) as? [String: Any], object["jsonrpc"] as? String == "2.0",
              let method = object["method"] as? String else { try upstream.append(line); return }
        let id = object["id"], params = object["params"] as? [String: Any] ?? [:]
        let validMeta = params["_meta"] == nil || params["_meta"] is [String: Any]
        if method == "notifications/initialized", id == nil, initialized { ready = true }
        if ready, let id, key(id) != nil, Set(object.keys).isSubset(of: ["jsonrpc", "id", "method", "params"]) {
            if method == "tools/call", params["name"] as? String == "argo_asset_library" {
                guard Set(params.keys).isSubset(of: ["name", "arguments", "_meta"]), validMeta,
                      let args = params["arguments"] as? [String: Any], args.isEmpty else { try invalid(id); return }
                try reply(id, result: ["content": [["type": "text", "text": "Argo Studio 面板已就绪。"]], "structuredContent": ["status": "panelReady"], "isError": false]); return
            }
            if method == "resources/list", params["cursor"] == nil || params["cursor"] is NSNull {
                guard Set(params.keys).isSubset(of: ["cursor", "_meta"]), validMeta else { try invalid(id); return }
                try reply(id, result: ["resources": [["uri": panelURI, "name": "Argo Studio", "mimeType": "text/html;profile=mcp-app"]]]); return
            }
            if method == "resources/read", params["uri"] as? String == panelURI {
                guard Set(params.keys).isSubset(of: ["uri", "_meta"]), validMeta else { try invalid(id); return }
                try reply(id, result: ["contents": [["uri": panelURI, "mimeType": "text/html;profile=mcp-app", "text": html,
                    "_meta": ["openai/ui": ["availableDisplayModes": ["fullscreen"], "preferredDisplayMode": "fullscreen"],
                              "ui": ["prefersBorder": false, "csp": ["connectDomains": [], "resourceDomains": ["blob:", "data:"], "frameDomains": []]]]]]]); return
            }
        }
        let validCatalog = (object["params"] == nil || object["params"] is [String: Any])
            && Set(params.keys).isSubset(of: ["cursor", "_meta"]) && validMeta
            && (params["cursor"] == nil || params["cursor"] is NSNull || params["cursor"] is String)
        if let idKey = key(id), method == "initialize" || (method == "tools/list" && validCatalog) {
            guard pending.count < 128, pending[idKey] == nil else { throw Failure.limit }
            pending[idKey] = Pending(method: method, firstPage: params["cursor"] == nil || params["cursor"] is NSNull)
        }
        if let idKey = key(id), method == "tools/call", params["name"] as? String == "argo_project_connection" {
            guard pending.count < 128, pending[idKey] == nil else { throw Failure.limit }
            pending[idKey] = Pending(method: "projectStatus", firstPage: false)
        }
        try upstream.append(line)
    }
    func hostResponse(_ data: Data) throws -> Data {
        guard var object = try? JSONSerialization.jsonObject(with: data) as? [String: Any], object["method"] == nil,
              let id = key(object["id"]), let request = pending.removeValue(forKey: id) else { return data }
        if request.method == "initialize", var result = object["result"] as? [String: Any] {
            initialized = true
            var capabilities = result["capabilities"] as? [String: Any] ?? [:]
            capabilities["resources"] = ["listChanged": true]; result["capabilities"] = capabilities
            result["instructions"] = (result["instructions"] as? String ?? "") + " 打开面板直接调用 argo_asset_library，不先要求 Argo 运行或工程就绪；它只打开面板，不表示已经读到素材。不得自动启动 Argo。业务数据和批准仍以原生回执为准。"
            object["result"] = result
        } else if request.method == "tools/list", ready, request.firstPage {
            var result = object["result"] as? [String: Any] ?? [:]
            var tools = result["tools"] as? [[String: Any]] ?? []
            tools.removeAll { $0["name"] as? String == "argo_asset_library" }
            for index in tools.indices where tools[index]["name"] as? String == "argo_import_attachment" {
                var meta = tools[index]["_meta"] as? [String: Any] ?? [:], ui = (tools[index]["_meta"] as? [String: Any])?["ui"] as? [String: Any] ?? [:]
                ui["resourceUri"] = panelURI; meta["ui"] = ui; tools[index]["_meta"] = meta
            }
            tools.insert(descriptor(), at: 0)
            for lifecycle in lifecycleTools() where !tools.contains(where: { $0["name"] as? String == lifecycle["name"] as? String }) { tools.append(lifecycle) }
            if result["tools"] == nil { result = [:] }
            result["tools"] = tools; object.removeValue(forKey: "error"); object["result"] = result
        } else if request.method == "projectStatus" {
            let result = object["result"] as? [String: Any] ?? [:], structured = result["structuredContent"] as? [String: Any] ?? [:]
            let state = structured["result"] as? [String: Any] ?? structured
            let status = (state["status"] as? String ?? "unavailable") + ":" + (state["projectRef"] as? String ?? "")
            let changed = lastProjectState != status; lastProjectState = status
            if changed {
                var notification = try encode(["jsonrpc": "2.0", "method": "notifications/tools/list_changed"])
                notification.append(data); return notification
            }
            return data
        } else { return data }
        return try encode(object)
    }
    func receiveHost(_ data: Data) throws {
        var offset = data.startIndex
        while offset < data.endIndex {
            if !hostLine { hostLine = true; capture = !pending.isEmpty }
            let newline = data[offset...].firstIndex(of: 10), end = newline.map { $0 + 1 } ?? data.endIndex
            let part = Data(data[offset..<end])
            if capture {
                hostBuffer.append(part)
                if hostBuffer.count > 524288 { try downstream.append(hostBuffer); hostBuffer.removeAll(keepingCapacity: false); capture = false }
            } else { try downstream.append(part) }
            if newline != nil {
                if capture { try downstream.append(hostResponse(hostBuffer)); hostBuffer.removeAll(keepingCapacity: true) }
                hostLine = false
                for response in deferred { try downstream.append(response) }
                deferred.removeAll(keepingCapacity: true)
            }
            offset = end
        }
    }
    func run() throws -> Int32 {
        signal(SIGPIPE, SIG_IGN)
        signal(SIGTERM) { stopSignal = $0 }; signal(SIGINT) { stopSignal = $0 }
        try child.run()
        let hostIn = input.fileHandleForWriting.fileDescriptor, hostOut = output.fileHandleForReading.fileDescriptor
        for fd in [STDIN_FILENO, STDOUT_FILENO, hostIn, hostOut] {
            guard fcntl(fd, F_SETFL, fcntl(fd, F_GETFL) | O_NONBLOCK) >= 0 else { throw Failure.closed }
        }
        var clientEOF = false, hostEOF = false, inputClosed = false, scratch = [UInt8](repeating: 0, count: 65536)
        defer {
            try? input.fileHandleForWriting.close(); try? output.fileHandleForReading.close()
            if child.isRunning { child.terminate() }
        }
        while !hostEOF || downstream.count > 0 {
            if stopSignal != 0 { return 128 + stopSignal }
            while let end = clientBuffer.firstIndex(of: 10), upstream.count < 2097152 {
                let line = Data(clientBuffer[...end]); clientBuffer.removeSubrange(...end); try receiveClient(line)
            }
            if clientEOF && upstream.count == 0 && !inputClosed { try input.fileHandleForWriting.close(); inputClosed = true }
            var fds = [pollfd(fd: !clientEOF && upstream.count < 2097152 ? STDIN_FILENO : -1, events: Int16(POLLIN), revents: 0),
                       pollfd(fd: !hostEOF && downstream.count < 4194304 ? hostOut : -1, events: Int16(POLLIN), revents: 0),
                       pollfd(fd: inputClosed ? -1 : hostIn, events: upstream.count > 0 ? Int16(POLLOUT) : 0, revents: 0),
                       pollfd(fd: STDOUT_FILENO, events: downstream.count > 0 ? Int16(POLLOUT) : 0, revents: 0)]
            let found = poll(&fds, nfds_t(fds.count), 250)
            if found < 0 { if errno == EINTR { continue }; throw Failure.closed }
            if fds.contains(where: { $0.revents & Int16(POLLERR | POLLNVAL) != 0 }) { throw Failure.closed }
            if fds[3].revents & Int16(POLLOUT) != 0 { try downstream.write(STDOUT_FILENO) }
            if fds[2].revents & Int16(POLLOUT) != 0 { try upstream.write(hostIn) }
            for index in 0...1 where fds[index].fd >= 0 && fds[index].revents & Int16(POLLIN | POLLHUP) != 0 {
                let count = Darwin.read(fds[index].fd, &scratch, scratch.count)
                if count > 0 {
                    let bytes = Data(scratch[..<count])
                    if index == 0 {
                        clientBuffer.append(bytes)
                        if !clientBuffer.contains(10) && clientBuffer.count > 1048576 { throw Failure.limit }
                    } else { try receiveHost(bytes) }
                } else if count == 0 {
                    if index == 0 { clientEOF = true; guard clientBuffer.isEmpty else { throw Failure.invalid } }
                    else { hostEOF = true; guard !hostLine else { throw Failure.closed } }
                } else if ![EINTR, EAGAIN, EWOULDBLOCK].contains(errno) { throw Failure.closed }
            }
        }
        child.waitUntilExit(); return child.terminationStatus
    }
}
do {
    let args = CommandLine.arguments
    guard args.count >= 4, args[1] == "--" else { throw Failure.invalid }
    let root = URL(fileURLWithPath: args[0]).resolvingSymlinksInPath().deletingLastPathComponent().deletingLastPathComponent()
    exit(try PanelBridge(helper: args[2], args: Array(args.dropFirst(3)), panel: root.appendingPathComponent("panel.html")).run())
} catch {
    FileHandle.standardError.write(Data("Argo 插件连接已停止；请重新加载插件并检查本机连接。\n".utf8)); exit(1)
}
