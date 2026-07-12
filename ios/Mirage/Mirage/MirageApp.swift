import SwiftUI

@main
struct MirageApp: App {
    @StateObject private var model = MirageViewModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .onChange(of: scenePhase) { _, phase in
                    guard phase == .active else { return }
                    Task { await model.resumeFromForeground() }
                }
        }
    }
}
