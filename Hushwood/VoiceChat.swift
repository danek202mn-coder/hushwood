import Foundation
import AVFoundation
import Speech

/// Голосовой замок: распознавание слова-пароля, которое игрок говорит в микрофон.
/// Микрофон включается только пока открыт «диктофон» у замка, потом аудиосессия
/// возвращается в обычный режим игры (без режима звонка — звук игры не искажается).
final class VoiceChat {
    var onLevel: ((Float) -> Void)?          // громкость микрофона (для полосок диктофона)
    var onHeard: ((String, Bool) -> Void)?   // распознанный текст, признак «фраза закончена»
    var onState: ((String) -> Void)?         // listening / listenEnd / denied / nospeech / error

    private let engine = AVAudioEngine()
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ru-RU"))
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var running = false
    private var lastLevel: CFTimeInterval = 0

    func listen(_ on: Bool) {
        if !on { stop(); return }
        guard let rec = recognizer, rec.isAvailable else { onState?("nospeech"); return }
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                guard status == .authorized else { self.onState?("nospeech"); return }
                AVAudioSession.sharedInstance().requestRecordPermission { ok in
                    DispatchQueue.main.async {
                        guard ok else { self.onState?("denied"); return }
                        self.start(rec)
                    }
                }
            }
        }
    }

    private func start(_ rec: SFSpeechRecognizer) {
        stop()
        do {
            let s = AVAudioSession.sharedInstance()
            try s.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .mixWithOthers])
            try s.setActive(true)
            let req = SFSpeechAudioBufferRecognitionRequest()
            req.shouldReportPartialResults = true
            if rec.supportsOnDeviceRecognition { req.requiresOnDeviceRecognition = true }
            request = req
            let input = engine.inputNode
            let fmt = input.outputFormat(forBus: 0)
            guard fmt.sampleRate > 0 else { onState?("error"); restoreSession(); return }
            input.removeTap(onBus: 0)
            input.installTap(onBus: 0, bufferSize: 1024, format: fmt) { [weak self] buf, _ in
                guard let self = self else { return }
                self.request?.append(buf)
                let n = Int(buf.frameLength)
                if n > 0, let ch = buf.floatChannelData {
                    var sum: Float = 0
                    for i in 0..<n { sum += ch[0][i] * ch[0][i] }
                    let rms = sqrt(sum / Float(n))
                    let now = CACurrentMediaTime()
                    if now - self.lastLevel > 0.1 { self.lastLevel = now; DispatchQueue.main.async { self.onLevel?(rms) } }
                }
            }
            engine.prepare()
            try engine.start()
            running = true
            task = rec.recognitionTask(with: req) { [weak self] result, error in
                if let r = result {
                    let text = r.bestTranscription.formattedString
                    let fin = r.isFinal
                    DispatchQueue.main.async { self?.onHeard?(text, fin) }
                }
                if error != nil || (result?.isFinal ?? false) { DispatchQueue.main.async { self?.stop() } }
            }
            onState?("listening")
        } catch {
            print("[Тихий дом] микрофон: \(error.localizedDescription)")
            onState?("error"); stop()
        }
    }

    func stop() {
        let was = running || request != nil
        request?.endAudio(); request = nil
        task?.finish(); task = nil
        if running { engine.inputNode.removeTap(onBus: 0); engine.stop(); running = false }
        if was { restoreSession(); onState?("listenEnd") }
    }

    // обычный режим звука игры, как до включения микрофона
    private func restoreSession() {
        let s = AVAudioSession.sharedInstance()
        try? s.setCategory(.soloAmbient, mode: .default, options: [])
        try? s.setActive(true)
    }
}
