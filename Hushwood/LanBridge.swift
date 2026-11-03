import Foundation
import MultipeerConnectivity
import WebKit

/// Игра по локальной сети через MultipeerConnectivity:
/// iPhone находят друг друга по Wi-Fi (одна сеть) или напрямую по Wi-Fi/Bluetooth рядом,
/// без интернета и без серверов. Хозяин принимает до 3 гостей.
/// Связь с игрой: JS → window.webkit.messageHandlers.lan.postMessage({cmd: ...}),
/// натив → window.__lan({e: ...}).
final class LanBridge: NSObject {
    static let serviceType = "hushwood"   // должно совпадать с NSBonjourServices в Info.plist
    weak var webView: WKWebView?

    private var me: MCPeerID?
    private var session: MCSession?
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?
    private var found: [String: MCPeerID] = [:]
    private var isHost = false
    private var acceptJoins = true
    private let maxGuests = 3
    private var hostPeer: MCPeerID?
    let voice = VoiceChat()

    override init() {
        super.init()
        voice.onLevel = { [weak self] l in self?.emit(["e": "vlevel", "l": Double(l)]) }
        voice.onHeard = { [weak self] text, fin in self?.emit(["e": "heard", "text": text, "final": fin]) }
        voice.onState = { [weak self] st in self?.emit(["e": "vstate", "s": st]) }
    }

    func handle(_ body: Any) {
        guard let msg = body as? [String: Any], let cmd = msg["cmd"] as? String else { return }
        switch cmd {
        case "host": start(name: msg["name"] as? String ?? "Игрок", host: true)
        case "browse": start(name: msg["name"] as? String ?? "Игрок", host: false)
        case "join":
            if let id = msg["id"] as? String, let peer = found[id], let s = session {
                hostPeer = peer
                browser?.invitePeer(peer, to: s, withContext: nil, timeout: 20)
            }
        case "lock": acceptJoins = !((msg["on"] as? Bool) ?? false)
        case "send":
            let to = msg["to"] as? String ?? ""
            let data = msg["data"] as? String ?? ""
            let reliable = msg["reliable"] as? Bool ?? false
            send(to: to.isEmpty ? nil : to, text: data, reliable: reliable)
        case "leave": stop()
        case "listen": voice.listen((msg["on"] as? Bool) ?? false)
        default: break
        }
    }

    private func start(name: String, host: Bool) {
        stop()
        isHost = host
        acceptJoins = true
        let safe = String(name.prefix(20)).replacingOccurrences(of: "|", with: " ")
        let peer = MCPeerID(displayName: "\(safe)|\(Int.random(in: 1000...9999))")
        me = peer
        let s = MCSession(peer: peer, securityIdentity: nil, encryptionPreference: .required)
        s.delegate = self
        session = s
        emit(["e": "me", "id": peer.displayName])
        if host {
            let a = MCNearbyServiceAdvertiser(peer: peer, discoveryInfo: ["v": "2"], serviceType: Self.serviceType)
            a.delegate = self
            a.startAdvertisingPeer()
            advertiser = a
        } else {
            let b = MCNearbyServiceBrowser(peer: peer, serviceType: Self.serviceType)
            b.delegate = self
            b.startBrowsingForPeers()
            browser = b
        }
    }

    func stop() {
        advertiser?.stopAdvertisingPeer(); advertiser = nil
        browser?.stopBrowsingForPeers(); browser = nil
        session?.disconnect(); session = nil
        found.removeAll(); hostPeer = nil
    }

    private func send(to: String?, text: String, reliable: Bool) {
        guard let s = session, let data = text.data(using: .utf8) else { return }
        let peers = to == nil ? s.connectedPeers : s.connectedPeers.filter { $0.displayName == to }
        guard !peers.isEmpty else { return }
        do { try s.send(data, toPeers: peers, with: reliable ? .reliable : .unreliable) }
        catch { print("[Тихий дом] LAN send: \(error.localizedDescription)") }
    }

    private func emit(_ obj: [String: Any]) {
        guard let json = try? JSONSerialization.data(withJSONObject: obj),
              let text = String(data: json, encoding: .utf8) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript("window.__lan && window.__lan(\(text))", completionHandler: nil)
        }
    }
}

extension LanBridge: MCSessionDelegate {
    func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        switch state {
        case .connected:
            emit(["e": "connected", "id": peerID.displayName])
            if !isHost { DispatchQueue.main.async { self.browser?.stopBrowsingForPeers() } }
        case .notConnected:
            emit(["e": "disconnected", "id": peerID.displayName])
        default: break
        }
    }
    func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        guard let text = String(data: data, encoding: .utf8) else { return }
        emit(["e": "data", "from": peerID.displayName, "d": text])
    }
    func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}
    func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}
    func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
}

extension LanBridge: MCNearbyServiceAdvertiserDelegate {
    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID,
                    withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        let ok = acceptJoins && (session?.connectedPeers.count ?? 0) < maxGuests
        invitationHandler(ok, ok ? session : nil)
    }
    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
        emit(["e": "error", "msg": "Не удалось создать игру: \(error.localizedDescription)"])
    }
}

extension LanBridge: MCNearbyServiceBrowserDelegate {
    func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        DispatchQueue.main.async { self.found[peerID.displayName] = peerID }
        emit(["e": "found", "id": peerID.displayName])
    }
    func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        DispatchQueue.main.async { self.found.removeValue(forKey: peerID.displayName) }
        emit(["e": "lost", "id": peerID.displayName])
    }
    func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
        emit(["e": "error", "msg": "Не удалось искать игры: \(error.localizedDescription)"])
    }
}

/// Обёртка, чтобы WKUserContentController не держал мост сильной ссылкой
final class LanProxy: NSObject, WKScriptMessageHandler {
    weak var bridge: LanBridge?
    init(_ bridge: LanBridge) { self.bridge = bridge }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        bridge?.handle(message.body)
    }
}
