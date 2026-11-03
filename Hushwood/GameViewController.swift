import UIKit
import WebKit

/// Вся игра — это один файл Game/index.html (3D на WebGL).
/// Контроллер показывает его на весь экран и сообщает о любых проблемах
/// прямо на экране и в консоли Xcode (строки начинаются с [Тихий дом]).
final class GameViewController: UIViewController, WKUIDelegate, WKNavigationDelegate {
    private var webView: WKWebView!
    private let statusLabel = UILabel()
    private var crashCount = 0
    private let lan = LanBridge()

    override func loadView() {
        let root = UIView()
        root.backgroundColor = .black

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default() // рекорды и настройки хранятся между запусками
        config.userContentController.add(LogProxy(self), name: "log")
        config.userContentController.add(LanProxy(lan), name: "lan")   // игра по локальной сети
        // без выделения текста, лупы и меню «Скопировать» при долгом нажатии на джойстик и кнопки
        config.preferences.isTextInteractionEnabled = false

        let web = WKWebView(frame: .zero, configuration: config)
        web.translatesAutoresizingMaskIntoConstraints = false
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.backgroundColor = .black
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.pinchGestureRecognizer?.isEnabled = false
        web.allowsBackForwardNavigationGestures = false
        GameViewController.killLongPress(web)
        web.uiDelegate = self
        web.navigationDelegate = self
        if #available(iOS 16.4, *) { web.isInspectable = true }
        root.addSubview(web)

        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.textColor = UIColor(red: 0.93, green: 0.88, blue: 0.8, alpha: 1)
        statusLabel.font = .systemFont(ofSize: 15, weight: .medium)
        statusLabel.numberOfLines = 0
        statusLabel.textAlignment = .center
        statusLabel.text = "Загрузка…"
        root.addSubview(statusLabel)

        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            web.topAnchor.constraint(equalTo: root.topAnchor),
            web.bottomAnchor.constraint(equalTo: root.bottomAnchor),
            statusLabel.centerXAnchor.constraint(equalTo: root.centerXAnchor),
            statusLabel.centerYAnchor.constraint(equalTo: root.centerYAnchor),
            statusLabel.widthAnchor.constraint(lessThanOrEqualTo: root.widthAnchor, multiplier: 0.8),
        ])
        webView = web
        lan.webView = web
        view = root
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        loadGame()
        // свернули/открыли пункт управления или уведомления — отпускаем джойстик и обзор, чтобы ничего не «залипло»
        for n in [UIApplication.willResignActiveNotification, UIApplication.didBecomeActiveNotification, UIApplication.willEnterForegroundNotification] {
            NotificationCenter.default.addObserver(forName: n, object: nil, queue: .main) { [weak self] _ in
                guard let self = self else { return }
                self.webView.evaluateJavaScript("window.__inputReset && window.__inputReset()", completionHandler: nil)
                // после пункта управления/уведомлений WebKit иногда «теряет» пальцы и экран перестаёт реагировать —
                // перезапускаем распознаватели касаний у веб-вью, это сбрасывает зависшие касания
                if n == UIApplication.didBecomeActiveNotification { self.resetTouches(self.webView) }
            }
        }
    }

    private func resetTouches(_ v: UIView) {
        v.gestureRecognizers?.forEach { g in
            if g.isEnabled { g.isEnabled = false; g.isEnabled = true }
        }
        v.subviews.forEach { resetTouches($0) }
    }

    private func loadGame() {
        guard let url = Bundle.main.url(forResource: "index", withExtension: "html") else {
            showStatus("Файл Game/index.html не попал в сборку.\nВ Xcode выбери index.html → справа галочка Target Membership: Hushwood.")
            return
        }
        log("загружаю \(url.lastPathComponent)")
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    // отключаем системные долгие нажатия (выделение, лупа) — в игре они только мешают
    static func killLongPress(_ v: UIView) {
        v.gestureRecognizers?.forEach { if $0 is UILongPressGestureRecognizer { $0.isEnabled = false } }
        v.subviews.forEach { killLongPress($0) }
    }

    fileprivate func log(_ msg: String) { print("[Тихий дом] \(msg)") }

    private func showStatus(_ text: String?) {
        statusLabel.text = text
        statusLabel.isHidden = (text == nil)
        if let text { log(text) }
    }

    // MARK: - WKNavigationDelegate
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        GameViewController.killLongPress(webView)
        showStatus(nil)
        log("страница загружена")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showStatus("Не удалось загрузить игру:\n\(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showStatus("Не удалось открыть файл игры:\n\(error.localizedDescription)")
    }

    // Если система выгрузила процесс игры (обычно из-за памяти) — включаем низкую графику и перезапускаем
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        crashCount += 1
        log("процесс игры завершён системой (раз: \(crashCount))")
        lan.stop()
        if crashCount >= 3 {
            showStatus("Игре не хватает ресурсов на этом устройстве.\nЗакрой другие приложения и перезапусти игру.")
            return
        }
        let lowGraphics = """
        try { var s = JSON.parse(localStorage.getItem('hushwood.settings') || '{}'); s.quality = 'low'; localStorage.setItem('hushwood.settings', JSON.stringify(s)); } catch (e) {}
        """
        webView.configuration.userContentController.addUserScript(
            WKUserScript(source: lowGraphics, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        showStatus("Перезапуск с низкой графикой…")
        loadGame()
    }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
}

/// Передаёт сообщения из игры (ошибки, загрузка) в консоль Xcode без утечки памяти
private final class LogProxy: NSObject, WKScriptMessageHandler {
    weak var owner: GameViewController?
    init(_ owner: GameViewController) { self.owner = owner }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        owner?.log("JS: \(message.body)")
    }
}
