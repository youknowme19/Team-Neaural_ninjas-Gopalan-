import Foundation
import ScreenCaptureKit
import CoreGraphics
import AVFoundation
import Speech

struct WindowInfo: Codable {
    let window_name: String
    let process_id: Int
    let app_name: String
}

class AudioStreamDelegate: NSObject, SCStreamOutput, SCStreamDelegate {
    private let stdoutHandle = FileHandle.standardOutput

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio, sampleBuffer.isValid else { return }

        var blockBuffer: CMBlockBuffer?
        var audioBufferList = AudioBufferList()

        let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            sampleBuffer,
            bufferListSizeNeededOut: nil,
            bufferListOut: &audioBufferList,
            bufferListSize: MemoryLayout<AudioBufferList>.size,
            blockBufferAllocator: nil,
            blockBufferMemoryAllocator: nil,
            flags: 0,
            blockBufferOut: &blockBuffer
        )

        guard status == noErr else { return }

        if let mData = audioBufferList.mBuffers.mData {
            let byteCount = Int(audioBufferList.mBuffers.mDataByteSize)
            if byteCount > 0 {
                let data = Data(bytes: mData, count: byteCount)
                stdoutHandle.write(data)
            }
        }
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        fputs("ScreenCapture stream stopped: \(error.localizedDescription)\n", stderr)
    }
}

class AudioTranscriptionDelegate: NSObject, SCStreamOutput, SCStreamDelegate {
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let recognitionQueue = DispatchQueue(label: "livespeak.speech.queue")

    override init() {
        super.init()
        setupRecognition()
    }

    private func setupRecognition() {
        recognitionQueue.async { [weak self] in
            guard let self = self else { return }
            self.recognitionTask?.cancel()
            self.recognitionTask = nil
            self.recognitionRequest = nil

            guard let recognizer = self.speechRecognizer, recognizer.isAvailable else {
                fputs("ScreenCaptureBridge: SFSpeechRecognizer is not available\n", stderr)
                return
            }

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            if #available(macOS 13.0, *) {
                request.addsPunctuation = true
            }
            if recognizer.supportsOnDeviceRecognition {
                request.requiresOnDeviceRecognition = true
            }
            self.recognitionRequest = request

            self.recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                guard let self = self else { return }

                if let result = result {
                    let formatted = result.bestTranscription.formattedString
                    let isFinal = result.isFinal

                    let payload: [String: Any] = [
                        "text": formatted,
                        "is_final": isFinal,
                        "timestamp": Int(Date().timeIntervalSince1970 * 1000)
                    ]

                    if let jsonData = try? JSONSerialization.data(withJSONObject: payload),
                       let jsonString = String(data: jsonData, encoding: .utf8) {
                        print(jsonString)
                        fflush(stdout)
                    }

                    if isFinal {
                        self.setupRecognition()
                    }
                }

                if let error = error {
                    let desc = error.localizedDescription
                    if !desc.contains("cancelled") {
                        fputs("ScreenCaptureBridge recognition note: \(desc)\n", stderr)
                    }
                    DispatchQueue.global().asyncAfter(deadline: .now() + 0.3) {
                        self.setupRecognition()
                    }
                }
            }
        }
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio, sampleBuffer.isValid else { return }
        recognitionRequest?.appendAudioSampleBuffer(sampleBuffer)
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        fputs("ScreenCapture stream stopped: \(error.localizedDescription)\n", stderr)
    }
}

@main
struct ScreenCaptureBridge {
    static func main() async {
        let args = CommandLine.arguments

        if args.count > 1 && args[1] == "list-windows" {
            await listActiveWindows()
            return
        }

        if args.count > 1 && args[1] == "capture" {
            let pidArg = args.count > 2 ? Int(args[2]) : nil
            await startAudioCapture(targetPid: pidArg)
            return
        }

        if args.count > 1 && args[1] == "transcribe" {
            let pidArg = args.count > 2 ? Int(args[2]) : nil
            await startAudioTranscription(targetPid: pidArg)
            return
        }

        printUsage()
    }

    static func printUsage() {
        let usage = """
        Usage:
          ScreenCaptureBridge list-windows
          ScreenCaptureBridge capture [process_id]
          ScreenCaptureBridge transcribe [process_id]
        """
        fputs("\(usage)\n", stderr)
    }

    static func listActiveWindows() async {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
            var results: [WindowInfo] = []

            for window in content.windows {
                guard let app = window.owningApplication else { continue }
                let title = window.title ?? ""
                let appName = app.applicationName

                let displayName = title.isEmpty ? appName : "\(appName) - \(title)"
                if !displayName.isEmpty && window.frame.width > 50 && window.frame.height > 50 {
                    results.append(WindowInfo(
                        window_name: displayName,
                        process_id: Int(app.processID),
                        app_name: appName
                    ))
                }
            }

            var seen = Set<String>()
            let uniqueResults = results.filter { item in
                let key = "\(item.process_id)-\(item.window_name)"
                if seen.contains(key) { return false }
                seen.insert(key)
                return true
            }

            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            let jsonData = try encoder.encode(uniqueResults)
            if let jsonString = String(data: jsonData, encoding: .utf8) {
                print(jsonString)
            }
        } catch {
            listWindowsCoreGraphicsFallback()
        }
    }

    static func listWindowsCoreGraphicsFallback() {
        guard let windowList = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else {
            print("[]")
            return
        }

        var results: [WindowInfo] = []
        var seen = Set<String>()

        for info in windowList {
            let pid = info[kCGWindowOwnerPID as String] as? Int ?? 0
            let appName = info[kCGWindowOwnerName as String] as? String ?? ""
            let windowName = info[kCGWindowName as String] as? String ?? ""
            let layer = info[kCGWindowLayer as String] as? Int ?? 0

            guard layer == 0, pid > 0 else { continue }
            let displayName = windowName.isEmpty ? appName : "\(appName) - \(windowName)"
            let key = "\(pid)-\(displayName)"

            if !seen.contains(key) && !displayName.isEmpty {
                seen.insert(key)
                results.append(WindowInfo(
                    window_name: displayName,
                    process_id: pid,
                    app_name: appName
                ))
            }
        }

        if let jsonData = try? JSONEncoder().encode(results),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        } else {
            print("[]")
        }
    }

    static func startAudioCapture(targetPid: Int?) async {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: false)
            guard let display = content.displays.first else {
                fputs("Error: No display found\n", stderr)
                exit(1)
            }

            let filter: SCContentFilter

            if let pid = targetPid, let app = content.applications.first(where: { $0.processID == pid_t(pid) }) {
                fputs("ScreenCaptureBridge: Locking audio target to PID \(pid) (\(app.applicationName))\n", stderr)
                filter = SCContentFilter(display: display, including: [app], exceptingWindows: [])
            } else {
                fputs("ScreenCaptureBridge: Capturing all system audio\n", stderr)
                filter = SCContentFilter(display: display, excludingWindows: [])
            }

            let config = SCStreamConfiguration()
            config.capturesAudio = true
            config.excludesCurrentProcessAudio = true
            config.sampleRate = 16000
            config.channelCount = 1

            config.width = 100
            config.height = 100
            config.minimumFrameInterval = CMTime(value: 1, timescale: 1)

            let delegate = AudioStreamDelegate()
            let stream = SCStream(filter: filter, configuration: config, delegate: delegate)
            try stream.addStreamOutput(delegate, type: .audio, sampleHandlerQueue: DispatchQueue(label: "livespeak.audio.queue"))

            try await stream.startCapture()
            fputs("ScreenCaptureBridge: Stream started successfully\n", stderr)

            while true {
                try await Task.sleep(nanoseconds: 1_000_000_000)
            }
        } catch {
            fputs("ScreenCaptureBridge error: \(error.localizedDescription)\n", stderr)
            exit(1)
        }
    }

    static func startAudioTranscription(targetPid: Int?) async {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: false)
            guard let display = content.displays.first else {
                fputs("Error: No display found\n", stderr)
                exit(1)
            }

            let filter: SCContentFilter

            if let pid = targetPid, let app = content.applications.first(where: { $0.processID == pid_t(pid) }) {
                fputs("ScreenCaptureBridge: Transcribing audio from PID \(pid) (\(app.applicationName))\n", stderr)
                filter = SCContentFilter(display: display, including: [app], exceptingWindows: [])
            } else {
                fputs("ScreenCaptureBridge: Transcribing all system audio\n", stderr)
                filter = SCContentFilter(display: display, excludingWindows: [])
            }

            let config = SCStreamConfiguration()
            config.capturesAudio = true
            config.excludesCurrentProcessAudio = true
            config.sampleRate = 16000
            config.channelCount = 1

            config.width = 100
            config.height = 100
            config.minimumFrameInterval = CMTime(value: 1, timescale: 1)

            let delegate = AudioTranscriptionDelegate()
            let stream = SCStream(filter: filter, configuration: config, delegate: delegate)
            try stream.addStreamOutput(delegate, type: .audio, sampleHandlerQueue: DispatchQueue(label: "livespeak.transcription.queue"))

            try await stream.startCapture()
            fputs("ScreenCaptureBridge: Live transcription started successfully\n", stderr)

            while true {
                try await Task.sleep(nanoseconds: 1_000_000_000)
            }
        } catch {
            fputs("ScreenCaptureBridge error: \(error.localizedDescription)\n", stderr)
            exit(1)
        }
    }
}
