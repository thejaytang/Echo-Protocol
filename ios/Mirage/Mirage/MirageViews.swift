import AuthenticationServices
import Foundation
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

struct RootView: View {
    @EnvironmentObject private var model: MirageViewModel

    var body: some View {
        ZStack {
            MirageTheme.background.ignoresSafeArea()
            switch model.route {
            case .bootstrapping:
                LaunchView()
            case .onboarding:
                OnboardingView()
            case .home:
                HomeView()
            case .waiting:
                WaitingView()
            case .friendRoom:
                FriendRoomView()
            case .game:
                GameView()
            }
        }
        .overlay(alignment: .top) {
            if let message = model.errorMessage {
                Text(message)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(.red.opacity(0.9), in: Capsule())
                    .padding(.top, 12)
            }
        }
        .overlay(alignment: .bottom) {
            if let reward = model.lastRewardStatus {
                Text(reward)
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(MirageTheme.accent, in: Capsule())
                    .padding(.bottom, 18)
            }
        }
    }
}

struct LaunchView: View {
    var body: some View {
        VStack(spacing: 14) {
            ProgressView()
                .controlSize(.large)
            Text("正在恢复会话")
                .font(.headline)
                .foregroundStyle(.secondary)
        }
    }
}

struct OnboardingView: View {
    @EnvironmentObject private var model: MirageViewModel
    @State private var nickname = ""
    @State private var ageConfirmed = false
    @State private var rulesConfirmed = false

    var canContinue: Bool {
        ageConfirmed && rulesConfirmed
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                OnboardingHeroPanel()
                OnboardingEntryPanel(nickname: $nickname)
                OnboardingRulePanel(
                    ageConfirmed: $ageConfirmed,
                    rulesConfirmed: $rulesConfirmed
                )

                SignInWithAppleButton(.signIn) { request in
                    request.requestedScopes = [.fullName, .email]
                } onCompletion: { result in
                    Task { await handleAppleResult(result) }
                }
                .frame(height: 50)
                .disabled(!canContinue || model.isLoading)

                #if DEBUG
                Button {
                    Task { await handleWeChatSignIn() }
                } label: {
                    PrimaryButtonLabel(title: model.isLoading ? "进入中..." : "微信登录")
                }
                .disabled(!canContinue || model.isLoading)

                Button {
                    Task { await handleGoogleSignIn() }
                } label: {
                    PrimaryButtonLabel(title: model.isLoading ? "进入中..." : "Google 登录")
                }
                .disabled(!canContinue || model.isLoading)
                #endif

                OnboardingLegalLinks(model: model)
            }
            .padding(20)
        }
    }

    private var submittedNickname: String? {
        let value = nickname.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }

    private func handleAppleResult(_ result: Result<ASAuthorization, Error>) async {
        switch result {
        case .success(let authorization):
            guard
                let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let data = credential.identityToken,
                let identityToken = String(data: data, encoding: .utf8)
            else {
                model.errorMessage = "Apple 登录凭证无效。"
                return
            }
            let name = [credential.fullName?.givenName, credential.fullName?.familyName]
                .compactMap { $0 }
                .joined()
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let authorizationCode = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
            await model.signInApple(
                identityToken: identityToken,
                authorizationCode: authorizationCode,
                nickname: submittedNickname ?? (name.isEmpty ? nil : name),
                ageConfirmed: ageConfirmed,
                communityConfirmed: rulesConfirmed
            )
        case .failure(let error):
            model.errorMessage = error.localizedDescription
        }
    }

    private func handleGoogleSignIn() async {
        #if DEBUG
        await model.signInGoogle(
            identityToken: "mock.google.ios-preview",
            nickname: submittedNickname,
            ageConfirmed: ageConfirmed,
            communityConfirmed: rulesConfirmed
        )
        #endif
    }

    private func handleWeChatSignIn() async {
        #if DEBUG
        await model.signInWeChat(
            code: "mock.wechat.ios-preview",
            nickname: nickname.isEmpty ? nil : nickname,
            ageConfirmed: ageConfirmed,
            communityConfirmed: rulesConfirmed
        )
        #endif
    }
}

struct OnboardingHeroPanel: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 7) {
                    Text("图灵迷局")
                        .font(.system(size: 42, weight: .bold))
                    Text("抓出伪装者")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(MirageTheme.accent)
                }
                Spacer()
                Image(systemName: "theatermasks.fill")
                    .font(.title2)
                    .frame(width: 48, height: 48)
                    .background(.white.opacity(0.18), in: Circle())
            }
            Text("伪装者混进席位。听发言、抓破绽，最后归票。")
                .font(.body)
                .foregroundStyle(.white.opacity(0.84))
            HStack(spacing: 8) {
                OnboardingFeaturePill(title: "限时开聊")
                OnboardingFeaturePill(title: "亮身份")
                OnboardingFeaturePill(title: "看复盘")
            }
        }
        .padding()
        .foregroundStyle(.white)
        .background(
            LinearGradient(
                colors: [Color(red: 0.22, green: 0.20, blue: 0.17), Color(red: 0.12, green: 0.13, blue: 0.15)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 18)
        )
    }
}

struct OnboardingFeaturePill: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.caption.weight(.bold))
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(.white.opacity(0.14), in: Capsule())
    }
}

struct OnboardingEntryPanel: View {
    @Binding var nickname: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("入场名片")
                .font(.headline)
            TextField("昵称", text: $nickname)
                .textFieldStyle(.roundedBorder)
            Text("昵称只用于本局展示。不要填写真实姓名、学校、地址、电话或支付信息。")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(.white, in: RoundedRectangle(cornerRadius: 14))
    }
}

struct OnboardingRulePanel: View {
    @Binding var ageConfirmed: Bool
    @Binding var rulesConfirmed: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("入场确认")
                .font(.headline)
            RuleToggleRow(
                title: "我已完成年龄确认",
                subtitle: "房间内会有真人发言和 AI 伪装。",
                isOn: $ageConfirmed
            )
            RuleToggleRow(
                title: "我同意社区规范",
                subtitle: "不暴露真实姓名、地址、电话、学校或支付信息。",
                isOn: $rulesConfirmed
            )
        }
        .padding()
        .background(MirageTheme.panel, in: RoundedRectangle(cornerRadius: 14))
    }
}

struct RuleToggleRow: View {
    let title: String
    let subtitle: String
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(.white, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct OnboardingLegalLinks: View {
    let model: MirageViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("用 Apple、微信或 Google 登录，战绩和装扮会跟随账号保存。")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Text("进房前请确认入场规则。")
                .font(.footnote)
                .foregroundStyle(.secondary)
            HStack(spacing: 14) {
                Link("隐私政策", destination: model.legalURL("/legal/privacy"))
                Link("服务条款", destination: model.legalURL("/legal/terms"))
                Link("社区规范", destination: model.legalURL("/legal/community"))
            }
            .font(.footnote.weight(.semibold))
        }
    }
}

struct HomeView: View {
    @EnvironmentObject private var model: MirageViewModel
    @State private var showSettings = false
    @State private var selectedTab: HomeTab = .lobby

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HomeHeader(user: model.user, summary: model.userSummary, showSettings: $showSettings)

                    if model.isBanned {
                        BannedAccountBanner(reason: model.banReason)
                    }

                    if !model.isBanned, let activeGame {
                        ActiveGameResumeCard(item: activeGame) {
                            Task { await model.openGameFromHistory(activeGame.gameId) }
                        }
                    }

                    homeContent
                }
                .padding(20)
            }
            HomeTabBar(
                selectedTab: $selectedTab,
                summary: model.userSummary,
                activeGameCount: model.gameHistory.filter { $0.phase != "COMPLETED" }.count
            )
        }
        .task {
            if model.modes.isEmpty {
                await model.loadModes()
            }
            if model.userSummary == nil {
                await model.loadHomeData()
            }
            applyPreferredHomeTab()
        }
        .onChange(of: model.preferredHomeTab) { _, _ in
            applyPreferredHomeTab()
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
                .environmentObject(model)
        }
    }

    private var activeGame: UserGameHistoryItem? {
        model.gameHistory.first { $0.phase != "COMPLETED" }
    }

    private func applyPreferredHomeTab() {
        guard let tab = model.preferredHomeTab else { return }
        selectedTab = HomeTab(rawValue: tab) ?? .lobby
        model.preferredHomeTab = nil
    }

    @ViewBuilder
    private var homeContent: some View {
        switch selectedTab {
        case .lobby:
            LobbyHomeSection()
                .environmentObject(model)
        case .records:
            RecordsHomeSection(summary: model.userSummary) { tab in
                selectedTab = tab
            }
                .environmentObject(model)
        case .profile:
            ProfileHomeSection(
                summary: model.userSummary,
                showSettings: $showSettings
            )
                .environmentObject(model)
        }
    }
}

enum HomeTab: String, CaseIterable, Identifiable {
    case lobby
    case records
    case profile

    var id: String { rawValue }

    var title: String {
        switch self {
        case .lobby:
            "大厅"
        case .records:
            "战绩"
        case .profile:
            "我的"
        }
    }

    var systemImage: String {
        switch self {
        case .lobby:
            "house.fill"
        case .records:
            "chart.bar.fill"
        case .profile:
            "person.crop.circle.fill"
        }
    }
}

struct HomeHeader: View {
    let user: MirageUser?
    let summary: UserSummary?
    @Binding var showSettings: Bool

    var body: some View {
        HStack(spacing: 12) {
            PlayerAvatar(initial: String((user?.nickname ?? "玩").prefix(1)), marked: false)
            VStack(alignment: .leading, spacing: 4) {
                Text("图灵迷局")
                    .font(.largeTitle.bold())
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                showSettings = true
            } label: {
                Image(systemName: "gearshape.fill")
                    .font(.title3)
                    .frame(width: 42, height: 42)
                    .background(.white, in: Circle())
            }
            .accessibilityLabel("设置")
        }
    }

    private var subtitle: String {
        let name = user?.nickname ?? "玩家"
        guard let progression = summary?.progression else {
            return "\(name)，今晚上桌"
        }
        return "\(name) · Lv.\(progression.level) \(progression.title)"
    }
}

struct LobbyHomeSection: View {
    @EnvironmentObject private var model: MirageViewModel
    @State private var selectedModeId: String?
    @State private var selectedTopicId: String?

    private var lobbyModes: [GameMode] {
        if !model.modes.isEmpty { return model.modes }
        return ["M01", "M02", "M03", "M04", "M06", "M08"].map(modeDetails(for:))
    }

    // 大厅显示全部模式，都走快速开始：单人点开即玩，缺的席位由 AI/脚本补位。
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HomeSectionTitle(title: "选择模式", meta: "点开即玩")

            ForEach(Array(lobbyModes.enumerated()), id: \.element.id) { index, mode in
                Button {
                    selectMode(mode.id)
                } label: {
                    LargeModeCard(
                        title: mode.name,
                        subtitle: mode.tagline ?? mode.intro,
                        detail: modeMetaLine(mode),
                        meta: "\(mode.playerCount) 人",
                        tint: index % 2 == 0 ? MirageTheme.accent : MirageTheme.ai
                    )
                }
                .disabled(model.isBanned)
            }
        }
        .sheet(isPresented: modeSheetPresented) {
            if let mode = selectedMode {
                ModeStartSheet(
                    mode: mode,
                    topics: model.topicsForMode(mode.id),
                    selectedTopicId: $selectedTopicId,
                    isBanned: model.isBanned
                ) {
                    selectedModeId = nil
                } startAction: {
                    let topicId = selectedTopicIdForMode(mode.id)
                    selectedModeId = nil
                    Task { await model.startMode(mode.id, topicId: topicId) }
                }
            }
        }
    }

    private var modeSheetPresented: Binding<Bool> {
        Binding(
            get: { selectedModeId != nil },
            set: { isPresented in
                if !isPresented {
                    selectedModeId = nil
                }
            }
        )
    }

    private var selectedMode: GameMode? {
        guard let selectedModeId else { return nil }
        return modeDetails(for: selectedModeId)
    }

    private func selectMode(_ modeId: String) {
        selectedModeId = modeId
        selectedTopicId = selectedTopicIdForMode(modeId)
    }

    private func selectedTopicIdForMode(_ modeId: String) -> String? {
        let availableTopics = model.topicsForMode(modeId)
        if let selectedTopicId, availableTopics.contains(where: { $0.id == selectedTopicId }) {
            return selectedTopicId
        }
        return availableTopics.first?.id
    }

    private func modeDetails(for id: String) -> GameMode {
        if let mode = model.modes.first(where: { $0.id == id }) {
            return mode
        }
        switch id {
        case "M02":
            return fallbackMode(id: "M02", name: "三角定位", playerCount: 3, aiCount: 1, minHumanCount: 2, discussionSeconds: 300, votingSeconds: 30, matchType: "public", difficulty: 1, intro: "三人围坐同一张圆桌，其中一名是伪装成真人的 AI。")
        case "M03":
            return fallbackMode(id: "M03", name: "开放频道", playerCount: 4, aiCount: 1, minHumanCount: 2, discussionSeconds: 360, votingSeconds: 45, matchType: "friend_room", difficulty: 2, intro: "四位熟人围坐圆桌，其中混着一名伪装成真人的 AI。")
        case "M04":
            return fallbackMode(id: "M04", name: "双源干扰", playerCount: 6, aiCount: 2, minHumanCount: 3, discussionSeconds: 480, votingSeconds: 60, matchType: "friend_room", difficulty: 3, intro: "六人圆桌里混入了两名 AI，真人要把票分到两名伪装者身上。")
        case "M06":
            return fallbackMode(id: "M06", name: "引路人", playerCount: 5, aiCount: 1, minHumanCount: 4, discussionSeconds: 420, votingSeconds: 50, matchType: "friend_room", difficulty: 3, intro: "同一张圆桌上，一名真人暗中站在 AI 一边，替它挡枪。")
        case "M08":
            return fallbackMode(id: "M08", name: "拟声陷阱", playerCount: 5, aiCount: 1, minHumanCount: 4, discussionSeconds: 420, votingSeconds: 50, matchType: "friend_room", difficulty: 3, intro: "同一张圆桌上，一名真人故意演得像 AI，替真正的 AI 吸走火力。")
        default:
            return fallbackMode(id: "M01", name: "单线接触", playerCount: 2, aiCount: 1, minHumanCount: 1, discussionSeconds: 120, votingSeconds: 20, matchType: "public", difficulty: 1, intro: "圆桌只坐两个人：对面可能是 AI，也可能是真人补位。")
        }
    }

    private func fallbackMode(id: String, name: String, playerCount: Int, aiCount: Int, minHumanCount: Int, discussionSeconds: Int, votingSeconds: Int, matchType: String, difficulty: Int, intro: String) -> GameMode {
        GameMode(
            id: id,
            name: name,
            playerCount: playerCount,
            aiCount: aiCount,
            minHumanCount: minHumanCount,
            discussionSeconds: discussionSeconds,
            finalStatementSeconds: 35,
            votingSeconds: votingSeconds,
            voteType: id == "M04" ? "identify_ai_pair" : "identify_ai",
            intro: intro,
            matchType: matchType,
            difficulty: difficulty,
            tagline: intro,
            goal: intro,
            flow: ["任务卡", "开聊", "陈述", "归票", "揭晓", "复盘"],
            rules: [intro],
            safety: "收局后可处理扰局玩家。"
        )
    }
}

struct ModeStartSheet: View {
    let mode: GameMode
    let topics: [GameTopic]
    @Binding var selectedTopicId: String?
    let isBanned: Bool
    let close: () -> Void
    let startAction: () -> Void

    private var soloFillNote: String? {
        (mode.minHumanCount ?? 1) > 1 ? "缺的席位由 AI 和脚本玩家补齐，可单人开局。" : nil
    }

    private var rules: [String] {
        let configured = mode.rules ?? []
        return configured.isEmpty ? [mode.intro] : configured
    }

    private var difficultyLabel: String {
        switch mode.difficulty ?? 1 {
        case 3...: "高阶局"
        case 2: "进阶局"
        default: "入门局"
        }
    }

    private var actionTitle: String {
        "开始对局"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(difficultyLabel)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(MirageTheme.accent)
                        Text(mode.name)
                            .font(.largeTitle.bold())
                        Text(mode.goal ?? mode.intro)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    Button("关闭", action: close)
                        .buttonStyle(.bordered)
                }

                ModeStartMetricGrid(mode: mode)
                WinConditionCard(mode: mode)
                RuleFlowView(flow: mode.flow ?? ["任务卡", "开聊", "归票", "揭晓", "复盘"])
                TopicSelectionPanel(
                    title: "本局话题",
                    message: "选一个开聊题。",
                    topics: topics,
                    selectedTopicId: $selectedTopicId
                )

                VStack(alignment: .leading, spacing: 8) {
                    Text("上桌提示")
                        .font(.headline)
                    ForEach(rules, id: \.self) { rule in
                        HStack(alignment: .top, spacing: 8) {
                            Circle()
                                .fill(MirageTheme.accent)
                                .frame(width: 6, height: 6)
                                .padding(.top, 6)
                            Text(rule)
                                .font(.subheadline)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding()
                .background(.white, in: RoundedRectangle(cornerRadius: 12))

                if let soloFillNote {
                    Text(soloFillNote)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.white, in: RoundedRectangle(cornerRadius: 12))
                }

                Text(mode.safety ?? "收局后可处理扰局玩家。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.white, in: RoundedRectangle(cornerRadius: 12))

                VStack(spacing: 10) {
                    Button(action: startAction) {
                        PrimaryButtonLabel(title: actionTitle)
                    }
                    .disabled(isBanned)

                    Button(action: close) {
                        Text("再看看")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding(20)
        }
        .background(MirageTheme.background.ignoresSafeArea())
        .onAppear {
            if selectedTopicId == nil {
                selectedTopicId = topics.first?.id
            }
        }
    }
}

struct TopicSelectionPanel: View {
    let title: String
    let message: String
    let topics: [GameTopic]
    @Binding var selectedTopicId: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)

            if topics.isEmpty {
                Text("这局暂时没有可选话题。")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(topics) { topic in
                    Button {
                        selectedTopicId = topic.id
                    } label: {
                        TopicChoiceRow(topic: topic, isSelected: topic.id == activeTopicId, showsAction: true)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding()
        .background(.white, in: RoundedRectangle(cornerRadius: 12))
    }

    private var activeTopicId: String? {
        selectedTopicId ?? topics.first?.id
    }
}

struct TopicChoiceRow: View {
    let topic: GameTopic
    let isSelected: Bool
    let showsAction: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                Text(topic.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)
                Text("\(topic.category) · \(topicRiskTitle(topic.risk))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if showsAction {
                Text(isSelected ? "已选" : "选择")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(isSelected ? .white : MirageTheme.accent)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(isSelected ? MirageTheme.accent : MirageTheme.accent.opacity(0.12), in: Capsule())
            }
        }
        .padding(12)
        .background(isSelected ? MirageTheme.accent.opacity(0.08) : Color.black.opacity(0.035), in: RoundedRectangle(cornerRadius: 10))
        .overlay {
            RoundedRectangle(cornerRadius: 10)
                .stroke(isSelected ? MirageTheme.accent.opacity(0.5) : Color.black.opacity(0.06), lineWidth: 1)
        }
    }
}

struct ModeStartMetricGrid: View {
    let mode: GameMode

    var body: some View {
        HStack(spacing: 8) {
            ModeStartMetric(title: "人数", value: "\(mode.playerCount)", caption: mode.id == "M01" ? "真假未知" : "AI \(mode.aiCount)")
            ModeStartMetric(title: "讨论", value: durationText(mode.discussionSeconds), caption: "限时发言")
            ModeStartMetric(title: "投票", value: durationText(mode.votingSeconds), caption: mode.id == "M01" ? "判真假" : "抓伪装者")
        }
    }

    private func durationText(_ seconds: Int) -> String {
        if seconds >= 60 {
            return "\(Int(round(Double(seconds) / 60.0))) 分"
        }
        return "\(seconds) 秒"
    }
}

struct ModeStartMetric: View {
    let title: String
    let value: String
    let caption: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline.bold())
            Text(caption)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.white, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct WinConditionCard: View {
    let mode: GameMode

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "flag.checkered")
                .font(.title3)
                .foregroundStyle(MirageTheme.accent)
                .frame(width: 34, height: 34)
                .background(MirageTheme.accent.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 5) {
                Text("怎么赢")
                    .font(.headline)
                Text(winConditionText)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding()
        .background(.white, in: RoundedRectangle(cornerRadius: 12))
    }

    private var winConditionText: String {
        switch mode.id {
        case "M01":
            return "判断对方是真人还是 AI。判断正确就赢，选择“真人”不是弃票。"
        case "M04":
            return "所有真人票都要落在 AI 身上，并且两名 AI 都至少吃到一票。"
        case "M06":
            return "侦探必须投中真正 AI；投出人类卧底不算侦探胜利。"
        case "M08":
            return "侦探必须分清伪 AI 真人和真正 AI，只有投中真正 AI 才赢。"
        default:
            return mode.goal ?? mode.intro
        }
    }
}


struct RuleFlowView: View {
    let flow: [String]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(flow.enumerated()), id: \.offset) { index, item in
                    HStack(spacing: 8) {
                        Text(flowStepTitle(item))
                            .font(.caption.weight(.bold))
                            .foregroundStyle(MirageTheme.accent)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(MirageTheme.accent.opacity(0.18), in: Capsule())
                            .foregroundStyle(MirageTheme.accent)
                        if index < flow.count - 1 {
                            Image(systemName: "chevron.right")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }
}

struct ModeRulesSheet: View {
    let modes: [GameMode]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("玩法速览")
                        .font(.largeTitle.bold())
                    Spacer()
                    Button("关闭") {
                        dismiss()
                    }
                    .buttonStyle(.bordered)
                }
                Text("选人数，选话题，准备上桌。归票后亮身份，收局看复盘。")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if modes.isEmpty {
                    InfoPanel(title: "玩法加载中", body: "稍等一下，模式马上出现。")
                } else {
                    ForEach(modes) { mode in
                        ModeRuleDetailCard(mode: mode)
                    }
                }
            }
            .padding(20)
        }
        .background(MirageTheme.background.ignoresSafeArea())
    }
}

struct ModeRuleDetailCard: View {
    let mode: GameMode

    private var rules: [String] {
        let configured = mode.rules ?? []
        return configured.isEmpty ? [mode.intro] : configured
    }

    private var matchTypeTitle: String {
        mode.matchType == "friend_room" ? "好友房" : "公开匹配"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(mode.name)
                        .font(.headline)
                    Text(mode.goal ?? mode.intro)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(matchTypeTitle)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 6)
                    .background(MirageTheme.accent, in: Capsule())
            }
            RuleFlowView(flow: mode.flow ?? ["任务卡", "开聊", "归票", "揭晓", "复盘"])
            VStack(alignment: .leading, spacing: 8) {
                ForEach(rules, id: \.self) { rule in
                    HStack(alignment: .top, spacing: 8) {
                        Circle()
                            .fill(MirageTheme.accent)
                            .frame(width: 6, height: 6)
                            .padding(.top, 6)
                        Text(rule)
                            .font(.subheadline)
                            .foregroundStyle(.primary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            Text(mode.safety ?? "收局后可处理扰局玩家。")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.black.opacity(0.04), in: RoundedRectangle(cornerRadius: 8))
        }
        .padding()
        .background(.white, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct RecordsHomeSection: View {
    @EnvironmentObject private var model: MirageViewModel
    let summary: UserSummary?
    let openTab: (HomeTab) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HomeSectionTitle(title: "战绩", meta: "赛季")
            SeasonRankCard(
                summary: summary,
                actionTitle: seasonActionTitle,
                actionDisabled: seasonActionDisabled,
                action: handleSeasonAction
            )
            RecordSummaryCard(summary: summary)
            SeasonStatsPanel(summary: summary)
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("最近对局")
                        .font(.headline)
                    Spacer()
                    Text("\(model.gameHistory.count) 局")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }

                if model.gameHistory.isEmpty {
                    EmptyRecordCard {
                        Task { await model.startMode("M01") }
                    }
                } else {
                    ForEach(model.gameHistory) { item in
                        GameHistoryRow(item: item) {
                            Task { await model.openGameFromHistory(item.gameId) }
                        }
                    }
                }
            }
            .padding()
            .background(.white, in: RoundedRectangle(cornerRadius: 12))
            if leaderboardUnlocked {
                LeaderboardHomeSection(leaderboard: model.leaderboard)
            } else {
                LeaderboardLockedCard(completedGames: summary?.stats.completedGames ?? 0) {
                    Task { await model.startMode("M01") }
                }
            }
        }
    }

    private var leaderboardUnlocked: Bool {
        (summary?.stats.completedGames ?? 0) >= 3
    }

    private var hasClaimableMission: Bool {
        (summary?.missions.items ?? []).contains { $0.claimable && !$0.claimed }
    }

    private var seasonActionTitle: String {
        if hasClaimableMission { return "去领取" }
        return summary?.recent == nil ? "快速上桌" : "再来一局"
    }

    private var seasonActionDisabled: Bool {
        model.isBanned && !hasClaimableMission
    }

    private func handleSeasonAction() {
        if hasClaimableMission {
            openTab(.lobby)
            return
        }
        Task { await model.startMode(summary?.recent?.modeId ?? "M01") }
    }
}

struct LeaderboardLockedCard: View {
    let completedGames: Int
    let start: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "lock.fill")
                    .frame(width: 44, height: 44)
                    .background(MirageTheme.accent.opacity(0.16), in: Circle())
                    .foregroundStyle(MirageTheme.accent)
                VStack(alignment: .leading, spacing: 5) {
                    Text("排行榜 3 局后解锁")
                        .font(.headline)
                    Text("先完成 3 局，熟悉任务卡、发言和归票后再看排名。")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                Text("还差 \(remainingGames) 局")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(MirageTheme.accent)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(MirageTheme.accent.opacity(0.12), in: Capsule())
            }

            Button(action: start) {
                Label("继续开局", systemImage: "play.fill")
                    .font(.subheadline.weight(.bold))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(MirageTheme.accent)
        }
        .padding()
        .background(.white, in: RoundedRectangle(cornerRadius: 12))
    }

    private var remainingGames: Int {
        max(0, 3 - completedGames)
    }
}

struct LeaderboardHomeSection: View {
    @EnvironmentObject private var model: MirageViewModel
    let leaderboard: LeaderboardSummary?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HomeSectionTitle(title: "排行榜", meta: "S1")
            LeaderboardHeroCard(leaderboard: leaderboard)
            LeaderboardListCard(title: "榜首席位", subtitle: "本赛季前三玩家", rows: topRows, emptyTitle: "还没有榜单") {
                Task { await model.startMode("M01") }
            }
            LeaderboardListCard(title: "我的附近", subtitle: "看清下一个要追上的位置", rows: aroundRows, emptyTitle: "附近名次待解锁") {
                Task { await model.startMode("M01") }
            }
        }
    }

    private var topRows: [LeaderboardRow] {
        Array((leaderboard?.top ?? []).prefix(3))
    }

    private var aroundRows: [LeaderboardRow] {
        leaderboard?.aroundMe ?? []
    }
}

struct LeaderboardHeroCard: View {
    let leaderboard: LeaderboardSummary?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(leaderboard?.season.title ?? "S1 推理赛季")
                        .font(.caption.weight(.black))
                        .foregroundStyle(MirageTheme.accent)
                    Text(rankTitle)
                        .font(.title2.bold())
                        .foregroundStyle(.white)
                    Text(rankSubtitle)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.7))
                }
                Spacer()
                Text(leaderboard?.myRank.map { "XP \($0.xp)" } ?? "开局")
                    .font(.caption.weight(.black))
                    .foregroundStyle(MirageTheme.avatar)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 8)
                    .background(MirageTheme.accent, in: Capsule())
            }

            Text(leaderboard?.season.rule ?? "按经验、胜场、复盘局数综合排序")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.65))

            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 8) {
                SeasonStatPill(title: "在榜", value: "\(leaderboard?.totalPlayers ?? 0)")
                SeasonStatPill(title: "我的胜率", value: percentText(leaderboard?.myRank?.winRate))
                SeasonStatPill(title: "复盘", value: "\(leaderboard?.myRank?.replayReady ?? 0)")
            }
        }
        .padding()
        .background(
            LinearGradient(
                colors: [MirageTheme.avatar, Color(red: 0.11, green: 0.13, blue: 0.21)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 12)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(MirageTheme.accent.opacity(0.26), lineWidth: 1)
        }
    }

    private var rankTitle: String {
        if let rank = leaderboard?.myRank {
            return "第 \(rank.rank) 名"
        }
        return "未入榜"
    }

    private var rankSubtitle: String {
        if let rank = leaderboard?.myRank {
            return "\(rank.title) · \(rank.score) 分"
        }
        return "完成一局后进入赛季榜"
    }
}

struct LeaderboardListCard: View {
    let title: String
    let subtitle: String
    let rows: [LeaderboardRow]
    let emptyTitle: String
    let start: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.headline)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(rows.isEmpty ? "待解锁" : "\(rows.count) 位")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }

            if rows.isEmpty {
                LeaderboardEmptyRow(title: emptyTitle, start: start)
            } else {
                ForEach(rows) { row in
                    LeaderboardRowView(row: row)
                }
            }
        }
        .padding()
        .background(.white, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct LeaderboardEmptyRow: View {
    let title: String
    let start: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "trophy")
                .frame(width: 44, height: 44)
                .background(MirageTheme.accent.opacity(0.16), in: Circle())
                .foregroundStyle(MirageTheme.accent)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text("打一局，拿经验和复盘分。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("开局", action: start)
                .font(.caption.weight(.bold))
                .buttonStyle(.borderedProminent)
                .tint(MirageTheme.accent)
        }
        .padding(.vertical, 8)
    }
}

struct LeaderboardRowView: View {
    let row: LeaderboardRow

    var body: some View {
        HStack(spacing: 12) {
            Text("#\(row.rank)")
                .font(.subheadline.weight(.black))
                .foregroundStyle(MirageTheme.avatar)
                .frame(width: 44, height: 44)
                .background(MirageTheme.accent, in: Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text(row.nickname + (row.isCurrentUser ? " · 我" : ""))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text("Lv.\(row.level) \(row.title) · 胜率 \(percentText(row.winRate)) · 完赛 \(row.completedGames)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            Spacer()
            Text("\(row.score) 分")
                .font(.caption.weight(.bold))
                .foregroundStyle(MirageTheme.accent)
        }
        .padding(.vertical, 8)
    }
}

struct EmptyRecordCard: View {
    let start: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("今晚还没上桌")
                .font(.headline)
            Text("打一局后，这里会保存结果和关键线索。")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button(action: start) {
                Label("快速上桌", systemImage: "play.fill")
                    .font(.subheadline.weight(.bold))
            }
            .buttonStyle(.borderedProminent)
            .tint(MirageTheme.accent)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(MirageTheme.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
    }
}

struct GameHistoryRow: View {
    let item: UserGameHistoryItem
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                PlayerAvatar(initial: item.winner == "human" ? "胜" : "AI", marked: item.winner != "human")
                VStack(alignment: .leading, spacing: 4) {
                    Text(historyTitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text("\(item.topicTitle) · \(item.playerCount) 人局 · \(timeLabel(item.updatedAt))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Spacer()
                Text(actionTitle)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(MirageTheme.accent)
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
    }

    private var historyTitle: String {
        if item.phase != "COMPLETED" {
            return "进行中 · \(phaseTitle(item.phase))"
        }
        return item.winner == "human" ? "判断正确 · \(modeDisplayTitle(item.modeId))" : "AI 获胜 · \(modeDisplayTitle(item.modeId))"
    }

    private var actionTitle: String {
        item.phase == "COMPLETED" ? (item.replayReady ? "看复盘" : "查看") : "继续"
    }
}

struct MissionsHomeSection: View {
    @EnvironmentObject private var model: MirageViewModel
    let summary: UserSummary?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HomeSectionTitle(title: "今日悬赏", meta: "奖励")
            MissionWalletCard(wallet: summary?.wallet, claimableCount: claimableMissionCount) {
                Task { await model.claimAllMissionRewards() }
            }
            .disabled(model.isBanned || claimableMissionCount == 0)
            VStack(spacing: 10) {
                if let items = summary?.missions.items, !items.isEmpty {
                    ForEach(items) { item in
                        MissionClaimRow(item: item, buttonTitle: buttonTitle(for: item)) {
                            handleMissionAction(item)
                        }
                        .disabled(model.isBanned || item.claimed)
                    }
                } else {
                    MissionRow(
                        title: "完成 1 局快速开始",
                        subtitle: "奖励：推理星 +20",
                        buttonTitle: summary?.missions.quickStartCompletedToday == true ? "已完成" : "开始"
                    ) {
                        Task { await model.startMode("M01") }
                    }
                    .disabled(model.isBanned || summary?.missions.quickStartCompletedToday == true)

                    ProgressStatusRow(
                        title: "看 1 次复盘",
                        subtitle: "奖励：推理星 +30",
                        progress: summary?.missions.replayReadyToday == true ? 1.0 : 0.0
                    )

                    ProgressStatusRow(
                        title: "赢下 1 局",
                        subtitle: "奖励：推理星 +40",
                        progress: summary?.missions.winCompletedToday == true ? 1.0 : 0.0
                    )
                }
            }
            .padding()
            .background(.white, in: RoundedRectangle(cornerRadius: 12))
            InfoPanel(title: "今日悬赏", body: "打一局、看复盘、赢一局，拿推理星。")
        }
    }

    private func handleMissionAction(_ item: UserMissionItem) {
        if item.claimable {
            Task { await model.claimMissionReward(missionId: item.id) }
            return
        }
        Task { await model.startMode("M01") }
    }

    private func buttonTitle(for item: UserMissionItem) -> String {
        if item.claimed { return "已领取" }
        if item.claimable { return "领取" }
        return "开局"
    }

    private var claimableMissionCount: Int {
        (summary?.missions.items ?? []).filter { $0.claimable && !$0.claimed }.count
    }
}

struct ProfileHomeSection: View {
    @EnvironmentObject private var model: MirageViewModel
    let summary: UserSummary?
    @Binding var showSettings: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HomeSectionTitle(title: "我的", meta: "安全")
            ProfileAccountCard(userName: model.user?.nickname, isBanned: model.isBanned)
            MissionsHomeSection(summary: summary)
                .environmentObject(model)
            VStack(spacing: 10) {
                ProfileStatusRow(title: "当前装扮", subtitle: currentCosmeticText, meta: "背包")
                ProfileStatusRow(title: "安全中心", subtitle: "已处理 \(summary?.safety.reportsSubmitted ?? 0) 次举报 · 拉黑 \(summary?.safety.blocks ?? 0) 人", meta: "账号")
            }
            .padding()
            .background(.white, in: RoundedRectangle(cornerRadius: 12))

            CosmeticInventorySection(cosmetics: summary?.cosmetics) { item in
                handleCosmeticAction(item)
            }
            CommercePreviewSection(catalog: model.commerceCatalog)

            ProfileSettingsEntry {
                showSettings = true
            }
        }
    }

    private var currentCosmeticText: String {
        guard let item = summary?.cosmetics?.equipped else {
            return "黑金侦探框 · 基础"
        }
        return "\(item.name) · \(item.rarity)"
    }

    private func handleCosmeticAction(_ item: UserCosmeticItem) {
        if item.equipped { return }
        if item.owned {
            Task { await model.equipCosmetic(itemId: item.id) }
        } else {
            Task { await model.unlockCosmetic(itemId: item.id) }
        }
    }
}

struct ProfileAccountCard: View {
    let userName: String?
    let isBanned: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: "shield.checkered")
                .font(.title3.weight(.semibold))
                .frame(width: 46, height: 46)
                .background(.white.opacity(0.18), in: Circle())
            VStack(alignment: .leading, spacing: 6) {
                Text("账号与安全")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.74))
                Text(userName ?? "玩家")
                    .font(.title2.bold())
                Text("固定账号保存战绩和装扮。房间规则、客服申诉、隐私和删档都在这里。")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.78))
            }
            Spacer()
            Text(isBanned ? "受限" : "在线")
                .font(.caption.weight(.bold))
                .foregroundStyle(MirageTheme.avatar)
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(.white, in: Capsule())
        }
        .padding()
        .foregroundStyle(.white)
        .background(
            LinearGradient(
                colors: [MirageTheme.avatar, MirageTheme.accent],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 12)
        )
    }
}

struct CommercePreviewSection: View {
    let catalog: CommerceCatalog?

    var body: some View {
        if let catalog, !catalog.offers.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(catalog.headline)
                            .font(.headline)
                        Text(catalog.summary)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text("未开放")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(MirageTheme.accent)
                }

                ForEach(catalog.offers.prefix(3)) { offer in
                    VStack(alignment: .leading, spacing: 5) {
                        HStack {
                            Text(offer.title)
                                .font(.subheadline.weight(.semibold))
                            Spacer()
                            Text(offer.priceLabel)
                                .font(.caption.weight(.bold))
                                .foregroundStyle(.secondary)
                        }
                        Text(offer.value)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(offer.fairness)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .padding(10)
                    .background(Color.black.opacity(0.04), in: RoundedRectangle(cornerRadius: 10))
                }

                if let guardText = catalog.fairnessGuards.first {
                    Text(guardText)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
            .background(.white, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}

struct ProfileSettingsEntry: View {
    let openSettings: () -> Void

    var body: some View {
        Button(action: openSettings) {
            HStack(spacing: 12) {
                Image(systemName: "shield.checkered")
                    .frame(width: 42, height: 42)
                    .background(MirageTheme.accent.opacity(0.16), in: Circle())
                    .foregroundStyle(MirageTheme.accent)
                VStack(alignment: .leading, spacing: 4) {
                    Text("账号与规则")
                        .font(.headline)
                        .foregroundStyle(.primary)
                    Text("社区规范、客服、隐私和删档都在这里。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
            }
            .padding()
            .background(.white, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }
}

struct HomeTabBar: View {
    @Binding var selectedTab: HomeTab
    let summary: UserSummary?
    let activeGameCount: Int

    var body: some View {
        HStack(spacing: 0) {
            ForEach(HomeTab.allCases) { tab in
                Button {
                    selectedTab = tab
                } label: {
                    VStack(spacing: 4) {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: tab.systemImage)
                                .font(.headline)
                            if let badge = badge(for: tab) {
                                Text(badge)
                                    .font(.caption2.weight(.black))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 5)
                                    .frame(minWidth: 16, minHeight: 16)
                                    .background(Color.red, in: Capsule())
                                    .offset(x: 12, y: -8)
                            }
                        }
                        .frame(height: 22)
                        Text(tab.title)
                            .font(.caption.weight(.semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .foregroundStyle(selectedTab == tab ? MirageTheme.accent : .secondary)
                    .padding(.vertical, 10)
                }
            }
        }
        .background(.white)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color.black.opacity(0.08))
                .frame(height: 1)
        }
    }

    private func badge(for tab: HomeTab) -> String? {
        switch tab {
        case .profile:
            missionClaimableCount > 0 ? "\(min(missionClaimableCount, 9))" : nil
        case .records:
            activeGameCount > 0 ? "续" : nil
        default:
            nil
        }
    }

    private var missionClaimableCount: Int {
        (summary?.missions.items ?? []).filter { $0.claimable && !$0.claimed }.count
    }
}

struct HomeSectionTitle: View {
    let title: String
    let meta: String

    var body: some View {
        HStack {
            Text(title)
                .font(.title2.bold())
                .foregroundStyle(.white)
            Spacer()
            Text(meta)
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(MirageTheme.accent, in: Capsule())
        }
    }
}




func modeDifficultyTitle(_ mode: GameMode) -> String {
    switch mode.difficulty ?? 1 {
    case 3...: "高阶"
    case 2: "进阶"
    default: "入门"
    }
}

func modeMetaLine(_ mode: GameMode) -> String {
    let minutes = max(1, (mode.discussionSeconds + mode.votingSeconds) / 60)
    return "\(modeDifficultyTitle(mode)) · 约 \(minutes) 分 · 混入 \(mode.aiCount) 名 AI"
}

struct LargeModeCard: View {
    let title: String
    let subtitle: String
    var detail: String? = nil
    let meta: String
    let tint: Color

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.82))
                    .multilineTextAlignment(.leading)
                if let detail {
                    Text(detail)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.66))
                }
            }
            Spacer()
            Text(meta)
                .font(.headline.bold())
                .foregroundStyle(tint)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(.white.opacity(0.92), in: RoundedRectangle(cornerRadius: 10))
        }
        .padding(18)
        .frame(minHeight: 118)
        .background(
            LinearGradient(
                colors: [tint.opacity(0.95), MirageTheme.avatar],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 12)
        )
    }
}

struct SmallModeCard: View {
    let title: String
    let subtitle: String
    let meta: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                Text(meta)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(MirageTheme.accent, in: Capsule())
            }
            .frame(maxWidth: .infinity, minHeight: 104, alignment: .leading)
            .padding()
            .background(.white, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}


struct RecordSummaryCard: View {
    let summary: UserSummary?

    var body: some View {
        HStack(spacing: 12) {
            PlayerAvatar(initial: "AI", marked: true)
            VStack(alignment: .leading, spacing: 5) {
                Text(recentTitle)
                    .font(.headline)
                    .foregroundStyle(.white)
                Text(recentSubtitle)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.68))
            }
            Spacer()
        }
        .padding()
        .background(
            LinearGradient(
                colors: [MirageTheme.avatar, MirageTheme.ai.opacity(0.76)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 12)
        )
    }

    private var recentTitle: String {
        guard let recent = summary?.recent else {
            return "暂无战绩"
        }
        return recent.winner == "human" ? "最近一局：判断正确" : "最近一局：AI 获胜"
    }

    private var recentSubtitle: String {
        guard let recent = summary?.recent else {
            return "还没有最近战况。"
        }
        return "\(recent.topicTitle) · \(recent.replayReady ? "复盘已整理" : "复盘整理中")"
    }
}

struct SeasonRankCard: View {
    let summary: UserSummary?
    let actionTitle: String
    let actionDisabled: Bool
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("S1 推理赛季")
                        .font(.caption.weight(.black))
                        .foregroundStyle(MirageTheme.accent)
                    Text(rankTitle)
                        .font(.title2.bold())
                        .foregroundStyle(.white)
                    Text(rankSubtitle)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.7))
                }
                Spacer()
                Text("XP \(summary?.progression?.xp ?? 0)")
                    .font(.caption.weight(.black))
                    .foregroundStyle(MirageTheme.avatar)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 8)
                    .background(MirageTheme.accent, in: Capsule())
            }

            ProgressView(value: summary?.progression?.progress ?? 0)
                .tint(MirageTheme.accent)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 8) {
                SeasonStatPill(title: "胜率", value: percentText(summary?.stats.winRate))
                SeasonStatPill(title: "完赛", value: "\(summary?.stats.completedGames ?? 0)")
                SeasonStatPill(title: "复盘", value: percentText(summary?.stats.replayReadyRate))
            }

            HStack(spacing: 7) {
                SeasonTrackPill(title: summary?.progression?.title ?? "新手侦探", active: true)
                Text("›")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.42))
                SeasonTrackPill(title: nextTrackTitle, active: false)
                Text("›")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.42))
                SeasonTrackPill(title: "AI 克星", active: false)
            }

            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(objectiveTitle)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                    Text(objectiveSubtitle)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.64))
                }
                Spacer()
                Button(actionTitle, action: action)
                    .font(.caption.weight(.bold))
                    .buttonStyle(.borderedProminent)
                    .tint(MirageTheme.accent)
                    .disabled(actionDisabled)
            }
            .padding(.top, 4)
        }
        .padding()
        .background(
            LinearGradient(
                colors: [MirageTheme.avatar, Color(red: 0.11, green: 0.13, blue: 0.21)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 12)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(MirageTheme.accent.opacity(0.26), lineWidth: 1)
        }
    }

    private var rankTitle: String {
        guard let progression = summary?.progression else { return "Lv.1 新手侦探" }
        return "Lv.\(progression.level) \(progression.title)"
    }

    private var rankSubtitle: String {
        guard let progression = summary?.progression else {
            return "距离 见习预言家 还差 50 XP"
        }
        let remainingXp = max(0, progression.nextLevelXp - progression.xp)
        if remainingXp == 0 { return "当前段位进度已拉满" }
        return "距离 \(progression.nextTitle) 还差 \(remainingXp) XP"
    }

    private var nextTrackTitle: String {
        let current = summary?.progression?.title ?? "新手侦探"
        let next = summary?.progression?.nextTitle ?? "见习预言家"
        return current == next ? "高阶侦探" : next
    }

    private var hasClaimableMission: Bool {
        (summary?.missions.items ?? []).contains { $0.claimable && !$0.claimed }
    }

    private var objectiveTitle: String {
        if hasClaimableMission { return "今日段位奖励待领取" }
        return summary?.recent == nil ? "今晚首局" : "继续冲榜"
    }

    private var objectiveSubtitle: String {
        if hasClaimableMission {
            return "先把悬赏奖励拿到手，经验会推进等级称号。"
        }
        if summary?.recent == nil {
            return "完成一局后解锁战绩、复盘和今日悬赏。"
        }
        return "复用上一局模式，保持判断手感。"
    }
}

struct SeasonStatPill: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.caption2.weight(.bold))
                .foregroundStyle(.white.opacity(0.64))
            Text(value)
                .font(.headline.bold())
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.78)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }
}

struct SeasonTrackPill: View {
    let title: String
    let active: Bool

    var body: some View {
        Text(title)
            .font(.caption2.weight(.black))
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .foregroundStyle(active ? MirageTheme.avatar : .white.opacity(0.72))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(active ? MirageTheme.accent : .white.opacity(0.08), in: RoundedRectangle(cornerRadius: 9))
            .overlay {
                RoundedRectangle(cornerRadius: 9)
                    .stroke(.white.opacity(active ? 0 : 0.1), lineWidth: 1)
            }
    }
}

struct SeasonStatsPanel: View {
    let summary: UserSummary?

    var body: some View {
        VStack(spacing: 10) {
            DarkProgressStatusRow(title: "识别胜率", subtitle: "已完成 \(summary?.stats.completedGames ?? 0) 局，胜利 \(summary?.stats.wins ?? 0) 局", progress: summary?.stats.winRate ?? 0)
            DarkProgressStatusRow(title: "复盘局数", subtitle: "\(summary?.stats.replayReady ?? 0) 局可回看复盘", progress: summary?.stats.replayReadyRate ?? 0)
        }
        .padding()
        .background(Color(red: 0.12, green: 0.14, blue: 0.21), in: RoundedRectangle(cornerRadius: 12))
    }
}

struct DarkProgressStatusRow: View {
    let title: String
    let subtitle: String
    let progress: Double

    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.62))
            }
            Spacer()
            ProgressView(value: progress)
                .frame(width: 88)
                .tint(MirageTheme.accent)
        }
        .padding(.vertical, 8)
    }
}

struct ActiveGameResumeCard: View {
    let item: UserGameHistoryItem
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 34, weight: .bold))
                    .foregroundStyle(.white)
                VStack(alignment: .leading, spacing: 5) {
                    Text("继续上一局")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text("\(phaseTitle(item.phase)) · \(item.topicTitle)")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.78))
                        .lineLimit(2)
                }
                Spacer()
                Text("继续")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(MirageTheme.accent)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(.white, in: Capsule())
            }
            .padding()
            .background(
                LinearGradient(
                    colors: [MirageTheme.accent, MirageTheme.avatar],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                in: RoundedRectangle(cornerRadius: 14)
            )
        }
        .buttonStyle(.plain)
    }
}

struct ProgressStatusRow: View {
    let title: String
    let subtitle: String
    let progress: Double

    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            ProgressView(value: progress)
                .frame(width: 88)
                .tint(MirageTheme.accent)
        }
        .padding(.vertical, 8)
    }
}

struct MissionWalletCard: View {
    let wallet: UserWalletSummary?
    let claimableCount: Int
    let claimAll: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                WalletMetric(title: "推理星", value: "\(wallet?.clueStars ?? 0)")
                WalletMetric(title: "经验", value: "\(wallet?.xp ?? 0)")
            }
            HStack(spacing: 10) {
                Text(claimableCount > 0 ? "\(claimableCount) 个奖励可领" : "今日奖励")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.72))
                Spacer()
                Button(claimableCount > 0 ? "一键领取" : "已同步", action: claimAll)
                    .font(.caption.weight(.black))
                    .foregroundStyle(MirageTheme.avatar)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(MirageTheme.accent, in: Capsule())
                    .disabled(claimableCount == 0)
            }
        }
        .padding()
        .background(
            LinearGradient(
                colors: [MirageTheme.avatar, MirageTheme.ai.opacity(0.86)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 12)
        )
    }
}

struct CosmeticInventorySection: View {
    let cosmetics: UserCosmeticSummary?
    let action: (UserCosmeticItem) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("背包装扮")
                        .font(.headline)
                    Text("推理星可解锁头像框，装扮会显示在个人资料里。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(cosmetics?.equipped.name ?? "默认")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(MirageTheme.accent)
            }

            ForEach(cosmetics?.items ?? []) { item in
                CosmeticInventoryRow(item: item) {
                    action(item)
                }
            }
        }
        .padding()
        .background(.white, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct CosmeticInventoryRow: View {
    let item: UserCosmeticItem
    let action: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Text(String(item.name.prefix(1)))
                .font(.headline.weight(.black))
                .foregroundStyle(MirageTheme.accent)
                .frame(width: 46, height: 46)
                .overlay {
                    Circle()
                        .stroke(MirageTheme.accent, lineWidth: 2)
                }
                .background(MirageTheme.accent.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text(item.name)
                    .font(.subheadline.weight(.semibold))
                Text(item.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 5) {
                Button(buttonTitle, action: action)
                    .font(.caption.weight(.bold))
                    .buttonStyle(.borderedProminent)
                    .disabled(item.equipped || (!item.owned && !item.affordable))
                Text(metaText)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(item.affordable || item.owned ? Color.secondary : Color.red)
            }
        }
        .padding(.vertical, 8)
    }

    private var buttonTitle: String {
        if item.equipped { return "使用中" }
        if item.owned { return "装备" }
        return "解锁"
    }

    private var metaText: String {
        if item.owned { return item.rarity }
        return "\(item.cost) 推理星"
    }
}

struct WalletMetric: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundStyle(.white.opacity(0.72))
            Text(value)
                .font(.title2.bold())
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct MissionClaimRow: View {
    let item: UserMissionItem
    let buttonTitle: String
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title)
                        .font(.subheadline.weight(.semibold))
                    Text(item.description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button(buttonTitle, action: action)
                    .font(.caption.weight(.bold))
                    .buttonStyle(.borderedProminent)
            }
            ProgressView(value: Double(item.progress), total: Double(max(item.target, 1)))
                .tint(item.claimed ? .green : MirageTheme.accent)
            HStack {
                Text(rewardText)
                Spacer()
                Text(statusText)
                    .foregroundStyle(item.claimed ? .green : (item.claimable ? MirageTheme.accent : .secondary))
            }
            .font(.caption.weight(.semibold))
        }
        .padding(.vertical, 8)
    }

    private var rewardText: String {
        "奖励：推理星 +\(item.reward.clueStars) · 经验 +\(item.reward.xp)"
    }

    private var statusText: String {
        if item.claimed { return "已领取" }
        if item.claimable { return "可领取" }
        return "\(item.progress)/\(item.target)"
    }
}

struct PlayerProgressionCard: View {
    let summary: UserSummary?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(rankTitle)
                        .font(.title2.bold())
                    Text("距离 \(nextTitle) 还需要 \(remainingXp) 经验")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.76))
                }
                Spacer()
                Text("推理星 \(summary?.wallet?.clueStars ?? 0)")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(MirageTheme.avatar)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(.white, in: Capsule())
            }
            ProgressView(value: summary?.progression?.progress ?? 0)
                .tint(.white)
            HStack {
                Text("XP \(summary?.progression?.xp ?? 0)")
                Spacer()
                Text("下一级 \(summary?.progression?.nextLevelXp ?? 50)")
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(.white.opacity(0.78))
        }
        .padding()
        .foregroundStyle(.white)
        .background(
            LinearGradient(
                colors: [MirageTheme.avatar, MirageTheme.accent],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 12)
        )
    }

    private var rankTitle: String {
        guard let progression = summary?.progression else { return "Lv.1 新手侦探" }
        return "Lv.\(progression.level) \(progression.title)"
    }

    private var nextTitle: String {
        summary?.progression?.nextTitle ?? "见习预言家"
    }

    private var remainingXp: Int {
        guard let progression = summary?.progression else { return 50 }
        return max(0, progression.nextLevelXp - progression.xp)
    }
}

struct MissionRow: View {
    let title: String
    let subtitle: String
    let buttonTitle: String
    let action: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button(buttonTitle, action: action)
                .font(.caption.weight(.bold))
                .buttonStyle(.borderedProminent)
        }
        .padding(.vertical, 8)
    }
}

struct ProfileStatusRow: View {
    let title: String
    let subtitle: String
    let meta: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(meta)
                .font(.caption.weight(.bold))
                .foregroundStyle(MirageTheme.accent)
        }
        .padding(.vertical, 8)
    }
}

struct LinkRow: View {
    let title: String
    let meta: String
    let destination: URL

    var body: some View {
        Link(destination: destination) {
            HStack {
                Text(title)
                Spacer()
                Text(meta)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
    }
}

struct InfoPanel: View {
    let title: String
    let message: String

    init(title: String, body message: String) {
        self.title = title
        self.message = message
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct WaitingView: View {
    @EnvironmentObject private var model: MirageViewModel

    var body: some View {
        VStack(spacing: 0) {
            HeaderBar(title: waitingMode?.name ?? "公开匹配") {
                Task { await model.cancelMatchmakingAndGoHome() }
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    MatchingHeroCard(
                        modeName: waitingMode?.name ?? modeDisplayTitle(waitingModeId),
                        topicTitle: model.topicTitle(for: model.waitingTopicId),
                        ticketCode: ticketCode,
                        waitingStartedAt: model.waitingStartedAt,
                        playerCount: waitingMode?.playerCount ?? 3,
                        discussionSeconds: waitingMode?.discussionSeconds ?? 300,
                        votingSeconds: waitingMode?.votingSeconds ?? 30
                    )
                    MatchingSeatBoard(
                        nickname: model.user?.nickname ?? "你",
                        playerCount: waitingMode?.playerCount ?? 3,
                        aiCount: waitingMode?.aiCount ?? 1
                    )
                    MatchingFlowPanel(
                        modeName: waitingMode?.name ?? modeDisplayTitle(waitingModeId),
                        flow: waitingMode?.flow ?? ["任务卡", "开聊", "归票", "揭晓", "复盘"]
                    )
                    WaitingFallbackPanel(
                        waitingStartedAt: model.waitingStartedAt,
                        quickStart: {
                            Task { await model.switchWaitingToQuickStart() }
                        }
                    )
                    Button {
                        Task { await model.cancelMatchmakingAndGoHome() }
                    } label: {
                        PrimaryButtonLabel(title: "取消匹配")
                    }
                }
                .padding(20)
            }
        }
        .task {
            await model.pollMatchmaking()
        }
    }

    private var waitingModeId: String {
        model.waitingModeId ?? "M02"
    }

    private var waitingMode: GameMode? {
        model.modes.first { $0.id == waitingModeId }
    }

    private var ticketCode: String {
        guard let ticketId = model.matchmakingTicketId else { return "排队中" }
        return "候场码 " + String(ticketId.replacingOccurrences(of: "-", with: "").prefix(6)).uppercased()
    }
}

struct WaitingFallbackPanel: View {
    let waitingStartedAt: String?
    let quickStart: () -> Void

    var body: some View {
        TimelineView(.periodic(from: Date(), by: 1)) { context in
            VStack(alignment: .leading, spacing: 12) {
                Text("换个开法")
                    .font(.headline)
                Text(waitingFallbackText(now: context.date, startedAt: waitingStartedAt))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Button(action: quickStart) {
                    PrimaryButtonLabel(title: "先玩单线接触")
                }
            }
            .padding()
            .background(.white, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}

struct FriendRoomView: View {
    @EnvironmentObject private var model: MirageViewModel

    private var isCurrentUserHost: Bool {
        guard let hostUserId = model.room?.hostUserId, let userId = model.user?.id else {
            return false
        }
        return hostUserId == userId
    }

    private var isLobby: Bool {
        model.room?.status == "LOBBY"
    }

    private var currentPlayer: GamePlayer? {
        guard let userId = model.user?.id else { return nil }
        return model.room?.players.first { $0.userId == userId }
    }

    private var isCurrentUserReady: Bool {
        currentPlayer?.ready == true
    }

    private var allHumansReady: Bool {
        guard let room = model.room else { return false }
        return room.players.filter { $0.kind == "human" }.allSatisfy { $0.ready }
    }

    private var humanCount: Int {
        model.room?.players.filter { $0.kind == "human" }.count ?? 0
    }

    private var requiredHumanCount: Int {
        guard let room = model.room else { return 2 }
        if let mode = model.modes.first(where: { $0.id == room.modeId }) {
            return mode.minHumanCount
        }
        switch room.modeId {
        case "M04":
            return 3
        case "M06", "M08":
            return 4
        case "M01":
            return 1
        default:
            return 2
        }
    }

    private var hasEnoughHumans: Bool {
        humanCount >= requiredHumanCount
    }

    private var canStartRoom: Bool {
        isCurrentUserHost && isLobby && hasEnoughHumans && allHumansReady
    }

    private var startHint: String {
        if !isLobby { return "房间当前不能开局。" }
        if !isCurrentUserHost { return "准备后等待房主开局。房主离开时会自动换房主。" }
        if !hasEnoughHumans { return "还需要 \(requiredHumanCount - humanCount) 名真人玩家加入后才能开局。" }
        if !allHumansReady { return "等待所有真人成员准备后即可开始。" }
        return "所有成员已准备，可以开始。"
    }

    var body: some View {
        VStack(spacing: 0) {
            HeaderBar(title: "好友房") {
                Task { await model.leaveFriendRoomAndGoHome() }
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)

            ScrollView {
                if let room = model.room {
                    let mode = model.modes.first(where: { $0.id == room.modeId })
                    VStack(alignment: .leading, spacing: 16) {
                        FriendRoomHeader(
                            room: room,
                            modeName: mode?.name ?? modeDisplayTitle(room.modeId),
                            startHint: startHint,
                            isCurrentUserHost: isCurrentUserHost,
                            allHumansReady: allHumansReady,
                            copiedInviteCode: model.copiedInviteCode,
                            copyInviteCode: model.copyInviteCode
                        )
                        FriendRoomTopicPanel(
                            topics: model.topicsForMode(room.modeId),
                            selectedTopicId: room.topicId,
                            isEditable: isCurrentUserHost && isLobby,
                            setTopic: { topicId in
                                Task { await model.setRoomTopic(topicId: topicId) }
                            }
                        )
                        FriendRoomSeatBoard(
                            room: room,
                            currentUserId: model.user?.id,
                            seatCount: mode?.playerCount ?? room.players.count
                        )
                        FriendRoomControlPanel(
                            isLobby: isLobby,
                            isCurrentUserReady: isCurrentUserReady,
                            isCurrentUserHost: isCurrentUserHost,
                            canStartRoom: canStartRoom,
                            startHint: startHint,
                            setReady: {
                                Task { await model.setReady(true) }
                            },
                            startRoom: {
                                Task { await model.startRoom() }
                            }
                        )
                        FriendRoomTimeoutPanel(
                            roomCreatedAt: room.createdAt,
                            humanCount: humanCount,
                            requiredHumanCount: requiredHumanCount,
                            copyInviteCode: model.copyInviteCode,
                            quickStart: {
                                Task {
                                    await model.leaveFriendRoomAndGoHome()
                                    await model.startMode("M01")
                                }
                            }
                        )
                    }
                    .padding(20)
                }
            }
        }
        .task {
            if model.modes.isEmpty || model.topics.isEmpty {
                await model.loadModes()
            }
            await model.pollFriendRoom()
        }
    }
}

struct FriendRoomTimeoutPanel: View {
    let roomCreatedAt: String
    let humanCount: Int
    let requiredHumanCount: Int
    let copyInviteCode: () -> Void
    let quickStart: () -> Void

    var body: some View {
        TimelineView(.periodic(from: Date(), by: 1)) { context in
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("好友房已等待 \(waitingElapsedText(now: context.date, startedAt: roomCreatedAt))")
                            .font(.headline)
                        Text(friendRoomFallbackText(now: context.date, startedAt: roomCreatedAt, humanCount: humanCount, requiredHumanCount: requiredHumanCount))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    Text("\(humanCount)/\(requiredHumanCount) 真人")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(MirageTheme.accent)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .background(MirageTheme.accent.opacity(0.12), in: Capsule())
                }
                Button(action: quickStart) {
                    PrimaryButtonLabel(title: "先玩单线接触")
                }
                Button(action: copyInviteCode) {
                    Text("复制房号继续拉人")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.bordered)
            }
            .padding()
            .background(.white, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}

struct FriendRoomTopicPanel: View {
    let topics: [GameTopic]
    let selectedTopicId: String?
    let isEditable: Bool
    let setTopic: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("本局话题")
                    .font(.headline)
                Spacer()
                Text(isEditable ? "房主可换" : "已锁定")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(isEditable ? MirageTheme.accent : .secondary)
            }

            if topics.isEmpty {
                Text("围绕话题聊天，抓出伪装者。")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(topics) { topic in
                    Button {
                        if isEditable {
                            setTopic(topic.id)
                        }
                    } label: {
                        TopicChoiceRow(topic: topic, isSelected: topic.id == activeTopicId, showsAction: isEditable)
                    }
                    .buttonStyle(.plain)
                    .disabled(!isEditable || topic.id == activeTopicId)
                }
            }
        }
        .padding()
        .background(MirageTheme.panel, in: RoundedRectangle(cornerRadius: 16))
    }

    private var activeTopicId: String? {
        selectedTopicId ?? topics.first?.id
    }
}

struct MatchingHeroCard: View {
    let modeName: String
    let topicTitle: String
    let ticketCode: String
    let waitingStartedAt: String?
    let playerCount: Int
    let discussionSeconds: Int
    let votingSeconds: Int

    var body: some View {
        TimelineView(.periodic(from: Date(), by: 1)) { context in
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("匹配中")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(MirageTheme.accent)
                        Text(modeName)
                            .font(.title2.bold())
                    }
                    Spacer()
                    Text(ticketCode)
                        .font(.caption.weight(.bold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(MirageTheme.accent.opacity(0.16), in: Capsule())
                        .foregroundStyle(MirageTheme.accent)
                }
                Text(topicTitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                HStack(spacing: 8) {
                    MatchingStatPill(title: "席位", value: "\(playerCount) 人")
                    MatchingStatPill(title: "已等待", value: waitingElapsedText(now: context.date, startedAt: waitingStartedAt))
                    MatchingStatPill(title: "投票", value: matchingDurationText(votingSeconds))
                }
                ProgressView()
                    .tint(MirageTheme.accent)
                Text("已保留你的座位，真人到位后自动开局。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding()
            .background(MirageTheme.panel, in: RoundedRectangle(cornerRadius: 16))
        }
    }

    private func matchingDurationText(_ seconds: Int) -> String {
        seconds >= 60 ? "\(seconds / 60) 分" : "\(seconds) 秒"
    }
}

struct MatchingStatPill: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.caption2.weight(.bold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.caption.weight(.bold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color.black.opacity(0.035), in: RoundedRectangle(cornerRadius: 10))
    }
}

struct MatchingSeatBoard: View {
    let nickname: String
    let playerCount: Int
    let aiCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("队列座位")
                .font(.headline)
            HStack(spacing: 10) {
                MatchingSeat(name: nickname, status: "已入座", icon: "person.fill", active: true)
                ForEach(0..<waitingHumanSeats, id: \.self) { index in
                    MatchingSeat(name: "真人玩家", status: index == 0 ? "寻找中" : "等待加入", icon: "person.crop.circle.badge.questionmark", active: false)
                }
                ForEach(0..<visibleAiSeats, id: \.self) { index in
                    MatchingSeat(name: visibleAiSeats > 1 ? "伪装者 \(index + 1)" : "伪装者", status: "开局补位", icon: "cpu.fill", active: true)
                }
            }
        }
        .padding()
        .background(
            LinearGradient(
                colors: [Color(red: 0.22, green: 0.20, blue: 0.17), Color(red: 0.12, green: 0.13, blue: 0.15)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 18)
        )
    }

    private var waitingHumanSeats: Int {
        max(1, max(1, playerCount - aiCount) - 1)
    }

    private var visibleAiSeats: Int {
        max(1, aiCount)
    }
}

struct MatchingSeat: View {
    let name: String
    let status: String
    let icon: String
    let active: Bool

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.headline)
                .frame(width: 42, height: 42)
                .background(active ? MirageTheme.accent : Color.gray.opacity(0.35), in: Circle())
                .foregroundStyle(.white)
            Text(name)
                .font(.caption.weight(.bold))
                .lineLimit(1)
            Text(status)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(active ? MirageTheme.accent : .secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(.white, in: RoundedRectangle(cornerRadius: 14))
    }
}

struct MatchingFlowPanel: View {
    let modeName: String
    let flow: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("开局后")
                .font(.headline)
            Text("\(modeName) 会按这个流程推进。")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            RuleFlowView(flow: flow)
        }
        .padding()
        .background(MirageTheme.panel, in: RoundedRectangle(cornerRadius: 16))
    }
}

struct FriendRoomHeader: View {
    let room: MirageRoom
    let modeName: String
    let startHint: String
    let isCurrentUserHost: Bool
    let allHumansReady: Bool
    let copiedInviteCode: String?
    let copyInviteCode: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("邀请码")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                    Text(room.inviteCode)
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                }
                Spacer()
                ReadyStatusPill(title: isCurrentUserHost ? "房主" : "成员", ready: allHumansReady)
            }
            Button(action: copyInviteCode) {
                HStack {
                    Image(systemName: copiedInviteCode == room.inviteCode ? "checkmark.circle.fill" : "doc.on.doc.fill")
                    Text(copiedInviteCode == room.inviteCode ? "邀请码已复制" : "复制邀请码")
                    Spacer()
                    Text("发给好友加入")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                .font(.subheadline.weight(.bold))
                .padding(12)
                .background(.white, in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            Text("\(modeName) · \(roomStatusTitle(room.status))")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(startHint)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(MirageTheme.panel, in: RoundedRectangle(cornerRadius: 16))
    }
}

struct FriendRoomSeatBoard: View {
    let room: MirageRoom
    let currentUserId: String?
    let seatCount: Int
    private let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("房间座位")
                    .font(.headline)
                Spacer()
                Text("\(room.players.count)/\(visibleSeatCount) 入座")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
            }
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(0..<visibleSeatCount, id: \.self) { index in
                    if index < room.players.count {
                        let player = room.players[index]
                        FriendRoomSeatCard(
                            player: player,
                            isSelf: player.userId != nil && player.userId == currentUserId,
                            isHost: player.userId != nil && player.userId == room.hostUserId
                        )
                    } else {
                        FriendRoomEmptySeatCard(index: index)
                    }
                }
            }
            Text("\(readyCount)/\(max(humanCount, 1)) 已准备")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.7))
        }
        .padding()
        .background(
            LinearGradient(
                colors: [Color(red: 0.22, green: 0.20, blue: 0.17), Color(red: 0.12, green: 0.13, blue: 0.15)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 18)
        )
    }

    private var visibleSeatCount: Int {
        max(seatCount, room.players.count)
    }

    private var humanCount: Int {
        room.players.filter { $0.kind == "human" }.count
    }

    private var readyCount: Int {
        room.players.filter { $0.kind == "human" && $0.ready }.count
    }
}

struct FriendRoomEmptySeatCard: View {
    let index: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "person.crop.circle.badge.plus")
                    .font(.title2)
                    .foregroundStyle(.white.opacity(0.7))
                Spacer()
                Text("#\(index + 1)")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white.opacity(0.58))
            }
            Text("空位")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white.opacity(0.9))
                .lineLimit(1)
            Text("等待入座")
                .font(.caption.weight(.bold))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(.white.opacity(0.08), in: Capsule())
                .foregroundStyle(.white.opacity(0.72))
        }
        .padding(12)
        .frame(minHeight: 126)
        .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(.white.opacity(0.22), style: StrokeStyle(lineWidth: 1, dash: [5, 5]))
        )
    }
}

struct FriendRoomSeatCard: View {
    let player: GamePlayer
    let isSelf: Bool
    let isHost: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                PlayerAvatar(initial: String(player.nickname.prefix(1)), marked: isHost)
                Spacer()
                if isHost {
                    Text("房主")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(MirageTheme.accent.opacity(0.18), in: Capsule())
                        .foregroundStyle(MirageTheme.accent)
                }
            }
            Text(isSelf ? "\(player.nickname) · 你" : player.nickname)
                .font(.subheadline.weight(.bold))
                .lineLimit(1)
            ReadyStatusPill(title: player.ready ? "已准备" : "未准备", ready: player.ready)
        }
        .padding(12)
        .frame(minHeight: 126)
        .background(.white, in: RoundedRectangle(cornerRadius: 14))
    }
}

struct FriendRoomControlPanel: View {
    let isLobby: Bool
    let isCurrentUserReady: Bool
    let isCurrentUserHost: Bool
    let canStartRoom: Bool
    let startHint: String
    let setReady: () -> Void
    let startRoom: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("开局操作")
                .font(.headline)
            Text(startHint)
                .font(.footnote)
                .foregroundStyle(.secondary)

            Button(action: setReady) {
                PrimaryButtonLabel(title: isCurrentUserReady ? "已准备" : "我已准备")
            }
            .disabled(!isLobby || isCurrentUserReady)

            if isCurrentUserHost {
                Button(action: startRoom) {
                    PrimaryButtonLabel(title: "房主开始")
                }
                .disabled(!canStartRoom)
            } else {
                Text("等待房主开局。房主离开时会自动换房主。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(.white.opacity(0.7), in: RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding()
        .background(.white.opacity(0.75), in: RoundedRectangle(cornerRadius: 16))
    }
}

struct ReadyStatusPill: View {
    let title: String
    let ready: Bool

    var body: some View {
        Text(title)
            .font(.caption.weight(.bold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(ready ? Color.green.opacity(0.16) : Color.gray.opacity(0.14), in: Capsule())
            .foregroundStyle(ready ? .green : .secondary)
    }
}

struct GameView: View {
    @EnvironmentObject private var model: MirageViewModel
    @State private var draft = ""
    @State private var selectedDiscussionTargetId: String?
    @State private var selectedVoteTargetId: String?
    @State private var lastDiscussionTargetId: String?
    @State private var confirmingVote = false
    @State private var showGameRules = false
    @State private var showTaskCardReview = false
    private let timer = Timer.publish(every: 8, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 0) {
            if let game = model.game {
                GameRoomTopBar(
                    game: game,
                    taskAction: {
                        showTaskCardReview = true
                    },
                    exitAction: {
                        model.goHome()
                    }
                )
                    .padding(.horizontal, 18)
                    .padding(.top, 12)

                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        GamePhaseRail(phase: game.phase, taskCardPending: shouldShowTaskCard(game))
                        GameSeatBoard(
                            game: game,
                            currentUserId: model.user?.id,
                            selectedDiscussionTargetId: $selectedDiscussionTargetId,
                            selectedVoteTargetId: $selectedVoteTargetId
                        )
                        TopicCard(game: game) {
                            showGameRules = true
                        }
                        if shouldPlaceStageActionBeforeMessages(game) {
                            stageActionPanel(for: game)
                        }

                        MessageTimeline(
                            game: game,
                            currentUserId: model.user?.id,
                            toggleMessageClue: { messageId in
                                Task { await model.toggleMessageClue(messageId: messageId) }
                            }
                        )

                        if shouldShowTaskCard(game) {
                            TaskCardPanel(
                                game: game,
                                currentUserId: model.user?.id,
                                primaryTitle: "开始发言",
                                acknowledge: {
                                    Task { await model.acknowledgeTaskCard() }
                                }
                            )
                        } else if !shouldPlaceStageActionBeforeMessages(game) {
                            stageActionPanel(for: game)
                        }
                    }
                    .padding(18)
                }

                BottomPhaseBar(
                    phase: game.phase,
                    taskCardPending: shouldShowTaskCard(game),
                    finalStatementSubmitted: game.finalStatement?.submitted == true,
                    draft: $draft,
                    send: {
                        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !text.isEmpty else { return }
                        draft = ""
                        Task { await model.sendMessage(text) }
                    }
                )
            }
        }
        .background(MirageTheme.gameBackground.ignoresSafeArea())
        .onReceive(timer) { _ in
            Task { await model.refreshGame() }
        }
        .onChange(of: model.game?.phase) { _, phase in
            if phase != "VOTING" {
                confirmingVote = false
            }
        }
        .onChange(of: model.game?.id) { _, _ in
            selectedDiscussionTargetId = nil
            selectedVoteTargetId = nil
            lastDiscussionTargetId = nil
            confirmingVote = false
        }
        .onChange(of: selectedDiscussionTargetId) { _, value in
            if model.game?.phase == "DISCUSSION" {
                lastDiscussionTargetId = value
            }
        }
        .sheet(isPresented: $showGameRules) {
            let currentModes = model.modes.filter { mode in
                mode.id == model.game?.modeId
            }
            ModeRulesSheet(modes: currentModes)
        }
        .sheet(isPresented: $showTaskCardReview) {
            if let game = model.game {
                TaskCardPanel(
                    game: game,
                    currentUserId: model.user?.id,
                    primaryTitle: "继续游戏",
                    acknowledge: {
                        showTaskCardReview = false
                    }
                )
                .padding()
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
            }
        }
        .overlay(alignment: .bottom) {
            if let status = model.lastReportStatus {
                Text(status)
                    .font(.footnote.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(.black.opacity(0.75), in: Capsule())
                    .foregroundStyle(.white)
                    .padding(.bottom, 72)
            }
        }
    }

    @ViewBuilder
    private func stageActionPanel(for game: MirageGame) -> some View {
        StageActionPanel(
            game: game,
            currentUserId: model.user?.id,
            selectedDiscussionTargetId: $selectedDiscussionTargetId,
            selectedVoteTargetId: $selectedVoteTargetId,
            lastDiscussionTargetId: $lastDiscussionTargetId,
            confirmingVote: $confirmingVote,
            vote: {
                guard let targetPlayerId = currentVoteTargetId(for: game) else { return }
                Task {
                    await model.vote(targetPlayerId: targetPlayerId)
                    confirmingVote = false
                }
            },
            report: { targetUserId, reason, block in
                Task {
                    await model.report(messageId: nil, targetUserId: targetUserId, reason: reason, block: block)
                }
            },
            viewReplay: {
                Task { await model.viewReplay() }
            },
            replayAgain: { modeId, roomId, rematchRoomId in
                Task {
                    await model.replayAgain(modeId: modeId, roomId: roomId, rematchRoomId: rematchRoomId)
                }
            },
            openAccount: {
                model.goHome(tab: "profile")
            }
        )
    }

    private func shouldShowTaskCard(_ game: MirageGame) -> Bool {
        game.phase == "DISCUSSION" && game.taskCard?.acknowledged == false
    }

    private func shouldPlaceStageActionBeforeMessages(_ game: MirageGame) -> Bool {
        switch game.phase {
        case "FINAL_STATEMENT", "VOTING", "REVEAL", "COMPLETED":
            return true
        default:
            return false
        }
    }

    private func currentVoteTargetId(for game: MirageGame) -> String? {
        if let selectedVoteTargetId { return selectedVoteTargetId }
        if let targetPlayerId = game.myVote?.targetPlayerId { return targetPlayerId }
        guard game.phase == "VOTING", let lastDiscussionTargetId else { return nil }
        return game.players.contains { player in
            player.id == lastDiscussionTargetId && player.userId != model.user?.id
        } ? lastDiscussionTargetId : nil
    }
}

struct SettingsView: View {
    @EnvironmentObject private var model: MirageViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showDeleteConfirmation = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    SettingsHeaderCard(user: model.user)
                    VStack(spacing: 10) {
                        SettingsLinkCard(title: "隐私政策", subtitle: "查看隐私与数据使用", destination: model.legalURL("/legal/privacy"))
                        SettingsLinkCard(title: "服务条款", subtitle: "查看服务规则", destination: model.legalURL("/legal/terms"))
                        SettingsLinkCard(title: "社区规范", subtitle: "查看发言、举报和封禁规则", destination: model.legalURL("/legal/community"))
                        SettingsLinkCard(title: "联系客服", subtitle: "反馈问题或申诉账号限制", destination: model.legalURL("/support"))
                    }
                    SettingsDangerCard {
                        showDeleteConfirmation = true
                    }
                }
                .padding(20)
            }
            .background(MirageTheme.background.ignoresSafeArea())
            .navigationTitle("设置")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("关闭") { dismiss() }
                }
            }
            .confirmationDialog("删除账号和个人数据？", isPresented: $showDeleteConfirmation, titleVisibility: .visible) {
                Button("确认删除", role: .destructive) {
                    Task {
                        await model.deleteAccount()
                        dismiss()
                    }
                }
                Button("取消", role: .cancel) {}
            } message: {
                Text("账号资料会被匿名化，未开始的匹配和房间会移除，本地登录状态会清除。")
            }
        }
    }
}

struct SettingsHeaderCard: View {
    let user: MirageUser?

    var body: some View {
        HStack(spacing: 12) {
            PlayerAvatar(initial: String((user?.nickname ?? "玩").prefix(1)), marked: false)
            VStack(alignment: .leading, spacing: 4) {
                Text(user?.nickname ?? "玩家")
                    .font(.headline)
                Text(user?.bannedAt == nil ? "账号状态正常" : "账号已被限制")
                    .font(.caption)
                    .foregroundStyle(user?.bannedAt == nil ? Color.secondary : Color.red)
            }
            Spacer()
            Image(systemName: "shield.checkered")
                .foregroundStyle(MirageTheme.accent)
        }
        .padding()
        .background(.white, in: RoundedRectangle(cornerRadius: 14))
    }
}

struct SettingsLinkCard: View {
    let title: String
    let subtitle: String
    let destination: URL

    var body: some View {
        Link(destination: destination) {
            HStack(spacing: 12) {
                Image(systemName: "doc.text.fill")
                    .frame(width: 34, height: 34)
                    .background(MirageTheme.accent.opacity(0.14), in: Circle())
                    .foregroundStyle(MirageTheme.accent)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.subheadline.weight(.semibold))
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
            }
            .padding()
            .background(.white, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}

struct SettingsDangerCard: View {
    let deleteAccount: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("账号数据")
                .font(.headline)
            Text("删除后会匿名化账号资料，移除未开始的匹配和房间，并清除本地登录状态。")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Button(role: .destructive, action: deleteAccount) {
                Text("删除账号和个人数据")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .background(.white, in: RoundedRectangle(cornerRadius: 14))
    }
}

struct BannedAccountBanner: View {
    let reason: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("账号已被限制", systemImage: "exclamationmark.shield.fill")
                .font(.headline)
            Text(reasonText)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text("你仍可以查看规则、联系客服或删除账号。")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.red.opacity(0.25), lineWidth: 1)
        )
    }

    private var reasonText: String {
        guard let reason, !reason.isEmpty else {
            return "该账号暂时不能参与匹配、好友房、发言、投票或举报。"
        }
        return "原因：\(reason)"
    }
}

struct HeaderBar: View {
    let title: String
    let action: () -> Void

    var body: some View {
        HStack {
            Button(action: action) {
                Image(systemName: "chevron.left")
                    .frame(width: 38, height: 38)
                    .background(.white, in: Circle())
            }
            VStack(alignment: .leading) {
                Text("图灵迷局")
                    .font(.title2.bold())
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
    }
}

struct ScoreStrip: View {
    let summary: UserSummary?

    var body: some View {
        HStack(spacing: 10) {
            ScoreItem(label: "识别率", value: percentText(summary?.stats.winRate))
            ScoreItem(label: "完成局", value: "\(summary?.stats.completedGames ?? 0)")
            ScoreItem(label: "复盘", value: percentText(summary?.stats.replayReadyRate))
        }
    }
}

struct ScoreItem: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.bold())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.white, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct ModeCard: View {
    let title: String
    let subtitle: String
    let meta: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(meta)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(MirageTheme.accent)
        }
        .padding()
        .background(.white, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct PrimaryButtonLabel: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(MirageTheme.accent, in: RoundedRectangle(cornerRadius: 12))
            .foregroundStyle(.white)
    }
}

struct TopicCard: View {
    let game: MirageGame
    let showRules: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label(game.topic.category, systemImage: "quote.bubble.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(MirageTheme.accent)
                Spacer()
                Text(phaseTitle(game.phase))
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.62))
            }
            Text(game.topic.title)
                .font(.title3.bold())
                .foregroundStyle(.white)
            Text(topicHint(for: game.phase, modeId: game.modeId))
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.68))
            Button(action: showRules) {
                Label("看玩法", systemImage: "list.bullet.rectangle")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(MirageTheme.accent.opacity(0.24), lineWidth: 1)
        )
    }
}

struct GameRoomTopBar: View {
    let game: MirageGame
    let taskAction: () -> Void
    let exitAction: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: exitAction) {
                Image(systemName: "chevron.left")
                    .font(.headline.weight(.bold))
                    .frame(width: 38, height: 38)
                    .background(.white.opacity(0.12), in: Circle())
                    .foregroundStyle(.white)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("图灵迷局")
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                Text(roomLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.62))
            }
            Spacer()
            Button(action: taskAction) {
                Label("任务", systemImage: "checklist")
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background(.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(.white)
            }
            VStack(alignment: .trailing, spacing: 3) {
                Text(phaseTitle(game.phase))
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.62))
                Text(remainingTimeText(game.phaseEndsAt))
                    .font(.title3.bold())
                    .foregroundStyle(MirageTheme.accent)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
        }
    }

    private var roomLabel: String {
        let roomType = game.roomId == nil ? "快速局" : "好友房"
        if game.phase == "REVEAL" || game.phase == "COMPLETED" {
            return "\(roomType) · 匿名结果"
        }
        let code = game.roomId.map { shortCode($0) } ?? shortCode(game.id)
        return "\(roomType) · 房间 \(code)"
    }
}

struct GamePhaseRail: View {
    let phase: String
    let taskCardPending: Bool
    private var steps: [String] {
        ["TASK", "DISCUSSION", "FINAL_STATEMENT", "VOTING", "REVEAL", "COMPLETED"]
    }

    var body: some View {
        HStack(spacing: 8) {
            ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                let activeIndex = steps.firstIndex(of: activeStep) ?? 0
                let isActive = index == activeIndex
                let isDone = index < activeIndex
                VStack(spacing: 6) {
                    Image(systemName: icon(for: step))
                        .font(.caption.weight(.bold))
                        .frame(width: 30, height: 30)
                        .background(dotColor(isActive: isActive, isDone: isDone), in: Circle())
                        .foregroundStyle(.white)
                    Text(phaseShortTitle(step))
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(isActive ? MirageTheme.accent : .white.opacity(0.56))
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(12)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
    }

    private var activeStep: String {
        if taskCardPending {
            return "TASK"
        }
        return phase
    }

    private func dotColor(isActive: Bool, isDone: Bool) -> Color {
        if isActive || isDone {
            return MirageTheme.accent
        }
        return Color.gray.opacity(0.35)
    }

    private func icon(for step: String) -> String {
        switch step {
        case "TASK":
            return "checklist"
        case "DISCUSSION":
            return "bubble.left.and.bubble.right.fill"
        case "FINAL_STATEMENT":
            return "quote.bubble.fill"
        case "VOTING":
            return "checkmark.seal.fill"
        case "REVEAL":
            return "eye.fill"
        default:
            return "doc.text.magnifyingglass"
        }
    }
}

struct GameSeatBoard: View {
    let game: MirageGame
    let currentUserId: String?
    @Binding var selectedDiscussionTargetId: String?
    @Binding var selectedVoteTargetId: String?
    private let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
    private var canSelectSeats: Bool {
        game.phase == "DISCUSSION" || game.phase == "VOTING"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("座位")
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
                Text("\(game.players.count) 人局")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.62))
            }
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(game.players) { player in
                    let isSelf = player.userId != nil && player.userId == currentUserId
                    if isSelf || !canSelectSeats {
                        GameSeatCard(
                            player: player,
                            isSelf: isSelf,
                            isSelected: canSelectSeats && selectedSeatTargetId == player.id,
                            phase: game.phase
                        )
                    } else {
                        Button {
                            selectSeat(player.id)
                        } label: {
                            GameSeatCard(
                                player: player,
                                isSelf: false,
                                isSelected: canSelectSeats && selectedSeatTargetId == player.id,
                                phase: game.phase
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding()
        .background(
            LinearGradient(
                colors: [Color(red: 0.22, green: 0.20, blue: 0.17), Color(red: 0.12, green: 0.13, blue: 0.15)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 18)
        )
    }

    private var selectedSeatTargetId: String? {
        switch game.phase {
        case "DISCUSSION":
            return selectedDiscussionTargetId
        case "VOTING":
            return selectedVoteTargetId
        default:
            return nil
        }
    }

    private func selectSeat(_ playerId: String) {
        switch game.phase {
        case "DISCUSSION":
            selectedDiscussionTargetId = playerId
        case "VOTING":
            selectedVoteTargetId = playerId
        default:
            break
        }
    }
}

struct GameSeatCard: View {
    let player: GamePlayer
    let isSelf: Bool
    let isSelected: Bool
    let phase: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                PlayerAvatar(initial: String(player.nickname.prefix(1)), marked: isSelected || isRevealedAI)
                Spacer()
                if isSelf {
                    Text("你")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(MirageTheme.accent.opacity(0.18), in: Capsule())
                        .foregroundStyle(MirageTheme.accent)
                }
            }
            Text(player.nickname)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
                .lineLimit(1)
            HStack {
                Text(visibleRoleTitle(player, phase: phase, isSelf: isSelf))
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.62))
                Spacer()
            }
        }
        .padding(12)
        .frame(minHeight: 126)
        .background(.white.opacity(isSelf ? 0.14 : 0.10), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(isSelected ? MirageTheme.ai : .white.opacity(0.08), lineWidth: isSelected ? 2 : 1)
        )
    }

    private var isRevealedAI: Bool {
        (phase == "REVEAL" || phase == "COMPLETED") && player.role == "ai"
    }
}

struct PlayerBadge: View {
    let player: GamePlayer
    let phase: String
    let currentUserId: String?

    var body: some View {
        HStack(spacing: 10) {
            PlayerAvatar(initial: String(player.nickname.prefix(1)), marked: isRevealedAI)
            VStack(alignment: .leading, spacing: 3) {
                Text(player.nickname)
                    .font(.subheadline.weight(.semibold))
                Text(visibleRoleTitle(player, phase: phase, isSelf: isSelf))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var isSelf: Bool {
        guard let currentUserId, let userId = player.userId else { return false }
        return currentUserId == userId
    }

    private var isRevealedAI: Bool {
        (phase == "REVEAL" || phase == "COMPLETED") && player.role == "ai"
    }
}

struct PlayerAvatar: View {
    let initial: String
    let marked: Bool

    var body: some View {
        Text(initial)
            .font(.headline.bold())
            .frame(width: 44, height: 44)
            .background(marked ? MirageTheme.ai : MirageTheme.avatar, in: Circle())
            .foregroundStyle(.white)
            .overlay(Circle().stroke(.white, lineWidth: 2))
            .shadow(color: .black.opacity(0.12), radius: 8, y: 4)
    }
}

struct MessageTimeline: View {
    let game: MirageGame
    let currentUserId: String?
    let toggleMessageClue: (_ messageId: String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("发言")
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
                Text("\(game.messages.count) 条")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.62))
            }
            if game.messages.isEmpty {
                Text("等第一句发言，先听谁在回避细节。")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.68))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(.white.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(.white.opacity(0.10), lineWidth: 1)
                    )
            } else {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(game.messages) { message in
                        RoomMessageBubble(
                            game: game,
                            message: message,
                            currentUserId: currentUserId,
                            toggleMessageClue: toggleMessageClue
                        )
                    }
                }
            }
        }
    }
}

struct RoomMessageBubble: View {
    let game: MirageGame
    let message: GameMessage
    let currentUserId: String?
    let toggleMessageClue: (_ messageId: String) -> Void

    var sender: GamePlayer? {
        guard let senderId = message.senderPlayerId else { return nil }
        return game.players.first { $0.id == senderId }
    }

    var isOwnMessage: Bool {
        guard let currentUserId, let senderUserId = sender?.userId else { return false }
        return currentUserId == senderUserId
    }

    var canMarkClue: Bool {
        game.phase == "DISCUSSION" && message.senderKind == "player" && sender != nil && !isOwnMessage
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if isOwnMessage {
                Spacer(minLength: 36)
            } else {
                avatarView
            }
            VStack(alignment: isOwnMessage ? .trailing : .leading, spacing: 6) {
                HStack(spacing: 6) {
                    if isOwnMessage {
                        Text(timeLabel(message.createdAt))
                    }
                    Text(sender?.nickname ?? "系统")
                        .font(.footnote.weight(.semibold))
                    if !isOwnMessage {
                        Text(timeLabel(message.createdAt))
                    }
                }
                .font(.caption)
                .foregroundStyle(.white.opacity(0.56))

                Text(message.text)
                    .font(.body)
                    .foregroundStyle(.white)
                    .padding(12)
                    .background(isOwnMessage ? MirageTheme.accent.opacity(0.22) : .white.opacity(0.10), in: RoundedRectangle(cornerRadius: 14))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(message.reactionType == "clue" ? MirageTheme.ai.opacity(0.7) : .white.opacity(0.08), lineWidth: message.reactionType == "clue" ? 1.5 : 1)
                    )
                if canMarkClue {
                    HStack(spacing: 6) {
                        Button {
                            toggleMessageClue(message.id)
                        } label: {
                            Text(message.reactionType == "clue" ? "已标线索" : "标为线索")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(message.reactionType == "clue" ? MirageTheme.avatar : MirageTheme.ai)
                                .padding(.horizontal, 9)
                                .padding(.vertical, 6)
                                .background(message.reactionType == "clue" ? MirageTheme.ai : MirageTheme.ai.opacity(0.12), in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            if isOwnMessage {
                avatarView
            } else {
                Spacer(minLength: 36)
            }
        }
    }

    @ViewBuilder
    private var avatarView: some View {
        if let sender {
            PlayerAvatar(initial: String(sender.nickname.prefix(1)), marked: isRevealedAI(sender))
        } else {
            Image(systemName: "shield.checkered")
                .frame(width: 44, height: 44)
                .background(MirageTheme.accent.opacity(0.18), in: Circle())
                .foregroundStyle(MirageTheme.accent)
        }
    }

    private func isRevealedAI(_ player: GamePlayer) -> Bool {
        (game.phase == "REVEAL" || game.phase == "COMPLETED") && player.role == "ai"
    }
}

struct TaskCardPanel: View {
    let game: MirageGame
    let currentUserId: String?
    let primaryTitle: String
    let acknowledge: () -> Void

    private var currentPlayer: GamePlayer? {
        game.players.first { player in
            guard let userId = player.userId else { return false }
            return userId == currentUserId
        }
    }

    var body: some View {
        let title = taskCardTitle(currentPlayer?.role ?? "hidden")

        VStack(alignment: .leading, spacing: 14) {
            Text("任务卡")
                .font(.caption.weight(.bold))
                .foregroundStyle(MirageTheme.accent)
            Text(title)
                .font(.title2.bold())
                .foregroundStyle(.white)
            HStack(spacing: 12) {
                PlayerAvatar(initial: String((currentPlayer?.nickname ?? "玩").prefix(1)), marked: currentPlayer?.role == "ai")
                VStack(alignment: .leading, spacing: 5) {
                    Text("任务目标")
                        .font(.title3.bold())
                    Text(taskGoal(currentPlayer, modeId: game.modeId))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding()
            .background(.white, in: RoundedRectangle(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 8) {
                TaskCardDetailRow(title: "赢法", value: taskWinCondition(currentPlayer, game: game))
                TaskCardDetailRow(title: "可用工具", value: taskTools(currentPlayer, game: game))
                TaskCardDetailRow(title: "禁忌", value: taskBoundary(currentPlayer))
                Label(game.topic.title, systemImage: "quote.bubble.fill")
                Label("其他玩家任务与阵营保持隐藏，投票前只能靠发言判断。", systemImage: "eye.slash.fill")
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.white.opacity(0.78), in: RoundedRectangle(cornerRadius: 12))

            Button(action: acknowledge) {
                PrimaryButtonLabel(title: primaryTitle)
            }
        }
        .padding()
        .gameActionPanelBackground()
    }
}

struct TaskCardDetailRow: View {
    let title: String
    let value: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundStyle(MirageTheme.accent)
                .frame(width: 54, alignment: .leading)
            Text(value)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.black.opacity(0.04), in: RoundedRectangle(cornerRadius: 10))
    }
}

struct StageActionPanel: View {
    let game: MirageGame
    let currentUserId: String?
    @Binding var selectedDiscussionTargetId: String?
    @Binding var selectedVoteTargetId: String?
    @Binding var lastDiscussionTargetId: String?
    @Binding var confirmingVote: Bool
    let vote: () -> Void
    let report: (_ targetUserId: String, _ reason: String, _ block: Bool) -> Void
    let viewReplay: () -> Void
    let replayAgain: (_ modeId: String, _ roomId: String?, _ rematchRoomId: String?) -> Void
    let openAccount: () -> Void

    var body: some View {
        switch game.phase {
        case "DISCUSSION":
            DiscussionActionPanel(
                game: game,
                currentUserId: currentUserId,
                selectedDiscussionTargetId: $selectedDiscussionTargetId
            )
        case "FINAL_STATEMENT":
            FinalStatementInfoPanel(submitted: game.finalStatement?.submitted == true)
        case "VOTING":
            VotingPanel(
                game: game,
                currentUserId: currentUserId,
                selectedVoteTargetId: $selectedVoteTargetId,
                lastDiscussionTargetId: $lastDiscussionTargetId,
                confirmingVote: $confirmingVote,
                submit: vote
            )
        case "REVEAL", "COMPLETED":
            RevealPanel(game: game, currentUserId: currentUserId, report: report, viewReplay: viewReplay, replayAgain: replayAgain, openAccount: openAccount)
        default:
            EmptyView()
        }
    }
}

struct FinalStatementInfoPanel: View {
    let submitted: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("最终陈述", systemImage: "quote.bubble.fill")
                .font(.headline)
                .foregroundStyle(.white)
            Text(submitted ? "你已经补完最后一句，等待其他真人陈述后进入归票。" : "只能补充一句。说明你的判断依据，随后进入归票。")
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.68))
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .gameActionPanelBackground()
    }
}

struct DiscussionActionPanel: View {
    let game: MirageGame
    let currentUserId: String?
    @Binding var selectedDiscussionTargetId: String?

    private var selectedPlayer: GamePlayer? {
        guard let selectedDiscussionTargetId else { return nil }
        return game.players.first { $0.id == selectedDiscussionTargetId }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("盯人", systemImage: "scope")
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
                Text("点座位锁定目标")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.62))
            }
            if let selectedPlayer {
                HStack(alignment: .top, spacing: 10) {
                    PlayerAvatar(initial: String(selectedPlayer.nickname.prefix(1)), marked: true)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(selectedPlayer.nickname)
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(.white)
                        Text("归票时会沿用这个目标，可随时换人。")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.62))
                    }
                    Spacer()
                    Text("盯人目标")
                        .font(.caption2.weight(.black))
                        .foregroundStyle(MirageTheme.ai)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 6)
                        .background(MirageTheme.ai.opacity(0.16), in: Capsule())
                }
                .padding()
                .background(.white.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(MirageTheme.ai.opacity(0.62), lineWidth: 1)
                )
            } else {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "scope")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(MirageTheme.ai)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("先听发言，再点座位")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(.white)
                        Text("读到回避、空泛或前后矛盾的回答时，先盯住最可疑的一位。")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.62))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(.white.opacity(0.10), lineWidth: 1)
                )
            }

            Text("用自己的话发言、主动追细节；可疑发言点“标为线索”。")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.56))
        }
        .padding()
        .gameActionPanelBackground()
    }
}

struct VotingPanel: View {
    let game: MirageGame
    let currentUserId: String?
    @Binding var selectedVoteTargetId: String?
    @Binding var lastDiscussionTargetId: String?
    @Binding var confirmingVote: Bool
    let submit: () -> Void

    private var eligibleTargets: [GamePlayer] {
        game.players.filter { player in
            guard let userId = player.userId else { return true }
            return userId != currentUserId
        }
    }

    private var isM01: Bool {
        game.modeId == "M01"
    }

    private var m01Opponent: GamePlayer? {
        game.players.first { player in
            guard let userId = player.userId else { return true }
            return userId != currentUserId
        }
    }

    private var canSubmit: Bool {
        !votingClosed && (isM01 ? selectedTargetId != nil : selectedPlayer != nil)
    }

    private var selectedPlayer: GamePlayer? {
        guard let targetId = selectedTargetId else { return nil }
        return eligibleTargets.first { $0.id == targetId }
    }

    private var selectedTargetId: String? {
        selectedVoteTargetId ?? game.myVote?.targetPlayerId ?? carriedDiscussionTarget?.id
    }

    private var carriedDiscussionTarget: GamePlayer? {
        guard game.phase == "VOTING",
              selectedVoteTargetId == nil,
              game.myVote == nil,
              let lastDiscussionTargetId
        else { return nil }
        return eligibleTargets.first { $0.id == lastDiscussionTargetId }
    }

    private var votingClosed: Bool {
        phaseExpired(game.phaseEndsAt)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(confirmingVote ? (isM01 ? "确认判断" : "确认归票") : votePanelTitle, systemImage: "checkmark.seal.fill")
                .font(.headline)
                .foregroundStyle(.white)
            if votingClosed {
                VStack(alignment: .leading, spacing: 8) {
                    Text(isM01 ? "判断已结束" : "归票已结束")
                        .font(.subheadline.weight(.bold))
                    Text("正在揭晓身份，稍后会自动进入结果。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    VoteStatusPill(game: game)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.white, in: RoundedRectangle(cornerRadius: 12))
            } else if confirmingVote, isM01, selectedTargetId == "abstain" {
                M01HumanGuessConfirmationCard(
                    submit: submit,
                    cancel: {
                        confirmingVote = false
                    }
                )
            } else if confirmingVote, let selectedPlayer {
                VoteConfirmationCard(
                    player: selectedPlayer,
                    game: game,
                    currentUserId: currentUserId,
                    submit: submit,
                    cancel: {
                        confirmingVote = false
                    }
                )
            } else {
                Text(votePanelPrompt)
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.68))

                VoteStatusPill(game: game)
                if let carriedDiscussionTarget {
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("已沿用盯人目标：\(carriedDiscussionTarget.nickname)")
                                .font(.subheadline.weight(.bold))
                            Text(isM01 ? "可以直接判断，也可以重选。" : "可以直接归票，也可以重选目标。")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button {
                            selectedVoteTargetId = nil
                            lastDiscussionTargetId = nil
                            confirmingVote = false
                        } label: {
                            Text("重选")
                                .font(.caption.weight(.bold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 7)
                                .background(.white, in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                    .padding()
                    .background(MirageTheme.ai.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                }

                if isM01, let opponent = m01Opponent {
                    Button {
                        selectedVoteTargetId = opponent.id
                        confirmingVote = false
                    } label: {
                        HStack(spacing: 10) {
                            PlayerBadge(player: opponent, phase: game.phase, currentUserId: currentUserId)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("判断是 AI")
                                    .font(.subheadline.weight(.bold))
                                Text("\(opponent.nickname) 在伪装真人")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                VoteEvidencePills(items: voteEvidence(for: opponent))
                            }
                            Spacer()
                            VoteChoiceMark(selected: selectedTargetId == opponent.id, current: game.myVote?.targetPlayerId == opponent.id, currentTitle: "当前判断")
                        }
                        .padding()
                        .background(.white, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)

                    Button {
                        selectedVoteTargetId = "abstain"
                        confirmingVote = false
                    } label: {
                        HStack(spacing: 10) {
                            Text("真")
                                .font(.headline.weight(.black))
                                .foregroundStyle(MirageTheme.avatar)
                                .frame(width: 44, height: 44)
                                .background(LinearGradient(colors: [MirageTheme.accent, MirageTheme.ai], startPoint: .topLeading, endPoint: .bottomTrailing), in: Circle())
                            VStack(alignment: .leading, spacing: 4) {
                                Text("判断是真人")
                                    .font(.subheadline.weight(.bold))
                                Text("\(opponent.nickname) 不是 AI，只是在认真回答。")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                VoteEvidencePills(items: ["选择对方不是 AI"])
                            }
                            Spacer()
                            VoteChoiceMark(selected: selectedTargetId == "abstain", current: game.myVote?.targetPlayerId == "abstain", currentTitle: "当前判断")
                        }
                        .padding()
                        .background(.white, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                } else {
                    ForEach(eligibleTargets) { player in
                        Button {
                            selectedVoteTargetId = player.id
                            confirmingVote = false
                        } label: {
                            HStack(spacing: 10) {
                                PlayerBadge(player: player, phase: game.phase, currentUserId: currentUserId)
                                VoteEvidencePills(items: voteEvidence(for: player))
                                Spacer()
                                VoteChoiceMark(selected: selectedTargetId == player.id, current: game.myVote?.targetPlayerId == player.id)
                            }
                            .padding()
                            .background(.white, in: RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                    }
                }

                Button {
                    confirmingVote = true
                } label: {
                    PrimaryButtonLabel(title: canSubmit ? primaryActionTitle : (isM01 ? "先选择判断" : "先选择玩家"))
                }
                .disabled(!canSubmit)
            }
        }
        .padding()
        .gameActionPanelBackground()
    }

    private func voteEvidence(for player: GamePlayer) -> [String] {
        let savedClues = game.messages
            .filter { $0.senderPlayerId == player.id && $0.reactionType == "clue" }
            .prefix(2)
            .map { "标记发言：\(compactText($0.text, limit: 18))" }
        return savedClues.isEmpty ? ["暂无标记发言"] : Array(savedClues)
    }

    private var votePanelTitle: String {
        if game.modeId == "M01" {
            return "判断对方真假"
        }
        return game.modeId == "M04" ? "分票锁定双 AI" : "投票锁定伪装者"
    }

    private var votePanelPrompt: String {
        if game.modeId == "M01" {
            return "根据对话细节判断对方是真人还是 AI；判断正确才算胜利。"
        }
        if game.modeId == "M04" {
            return "把票分到两名 AI 身上，让它们的得票都压过所有真人。"
        }
        return "看你标记的发言和最终陈述，归票结束或全员交票前可修改。"
    }

    private var primaryActionTitle: String {
        if isM01 {
            return game.myVote == nil ? "确认判断" : "修改判断"
        }
        return game.myVote == nil ? "确认归票" : "修改投票"
    }
}

struct VoteChoiceMark: View {
    let selected: Bool
    let current: Bool
    var currentTitle = "当前票"

    var body: some View {
        if current {
            Text(currentTitle)
                .font(.caption2.weight(.black))
                .foregroundStyle(MirageTheme.avatar)
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(MirageTheme.accent, in: Capsule())
        } else {
            Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(selected ? MirageTheme.accent : .secondary)
        }
    }
}

struct VoteStatusPill: View {
    let game: MirageGame

    private var targetName: String? {
        guard let targetPlayerId = game.myVote?.targetPlayerId else { return nil }
        if game.modeId == "M01", targetPlayerId == "abstain" {
            return "对方是真人"
        }
        return game.players.first { $0.id == targetPlayerId }?.nickname
    }

    private var statusTitle: String {
        guard let targetName else { return "还未交票" }
        if game.modeId == "M01" {
            return game.myVote?.targetPlayerId == "abstain" ? "已判断\(targetName)" : "已判断 \(targetName) 是 AI"
        }
        return "已投给 \(targetName)"
    }

    private var statusDescription: String {
        if targetName == nil {
            return "先选目标，提交后进入等待。" + voteProgressSuffix
        }
        if game.modeId == "M01" {
            return "可在揭晓前修改，最后一次提交生效。"
        }
        return "可在归票结束或全员交票前修改，最后一次提交生效。" + voteProgressSuffix
    }

    private var voteProgressSuffix: String {
        guard game.modeId != "M01", let voteState = game.voteState else { return "" }
        if voteState.remaining <= 0 {
            return " 全员已交票，正在揭晓。"
        }
        return " 还差 \(voteState.remaining) 名真人交票，当前 \(voteState.submittedCount)/\(voteState.total)。"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(statusTitle)
                .font(.subheadline.weight(.bold))
            Text(statusDescription)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(MirageTheme.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
    }
}

struct VoteEvidencePills: View {
    let items: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(items, id: \.self) { item in
                Text(item)
                    .font(.caption2.weight(.bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
                    .foregroundStyle(item == "暂无标记发言" ? .secondary : MirageTheme.accent)
            }
        }
    }
}

struct M01HumanGuessConfirmationCard: View {
    let submit: () -> Void
    let cancel: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("本次判断")
                .font(.caption.weight(.bold))
                .foregroundStyle(MirageTheme.accent)
            HStack(spacing: 10) {
                Text("真")
                    .font(.headline.weight(.black))
                    .foregroundStyle(MirageTheme.avatar)
                    .frame(width: 44, height: 44)
                    .background(LinearGradient(colors: [MirageTheme.accent, MirageTheme.ai], startPoint: .topLeading, endPoint: .bottomTrailing), in: Circle())
                VStack(alignment: .leading, spacing: 4) {
                    Text("判断对方是真人")
                        .font(.subheadline.weight(.bold))
                    Text("这是选择“对方不是 AI”，不是弃票。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.white, in: RoundedRectangle(cornerRadius: 12))
            Text("单线接触提交后会立即揭晓。")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
            HStack(spacing: 10) {
                Button(action: submit) {
                    PrimaryButtonLabel(title: "确认提交")
                }
                Button(action: cancel) {
                    Text("返回修改")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .background(.white.opacity(0.78), in: RoundedRectangle(cornerRadius: 12))
    }
}

struct VoteConfirmationCard: View {
    let player: GamePlayer
    let game: MirageGame
    let currentUserId: String?
    let submit: () -> Void
    let cancel: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(game.modeId == "M01" ? "本次判断" : "本次投票")
                .font(.caption.weight(.bold))
                .foregroundStyle(MirageTheme.accent)
            if game.modeId == "M01" {
                Text("判断 \(player.nickname) 是 AI")
                    .font(.headline)
            }
            PlayerBadge(player: player, phase: game.phase, currentUserId: currentUserId)
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.white, in: RoundedRectangle(cornerRadius: 12))
            Text(voteWarning)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
            HStack(spacing: 10) {
                Button(action: submit) {
                    PrimaryButtonLabel(title: "确认提交")
                }
                Button(action: cancel) {
                    Text("返回修改")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .background(.white.opacity(0.78), in: RoundedRectangle(cornerRadius: 12))
    }

    private var voteWarning: String {
        if game.modeId == "M01" {
            return "单线接触提交后会立即揭晓。"
        }
        if game.modeId == "M04" {
            return "双源干扰要分票锁定两名 AI，只集火一名 AI 不算胜利。"
        }
        return "提交后可在归票结束或全员交票前修改。"
    }
}

struct RevealPanel: View {
    @EnvironmentObject private var model: MirageViewModel
    let game: MirageGame
    let currentUserId: String?
    let report: (_ targetUserId: String, _ reason: String, _ block: Bool) -> Void
    let viewReplay: () -> Void
    let replayAgain: (_ modeId: String, _ roomId: String?, _ rematchRoomId: String?) -> Void
    let openAccount: () -> Void

    private var reportablePlayers: [GamePlayer] {
        guard game.phase == "COMPLETED" else { return [] }
        return game.players.filter { player in
            guard let userId = player.userId else { return false }
            return userId != currentUserId
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label(game.phase == "REVEAL" ? "亮身份" : "看复盘", systemImage: "eye.fill")
                .font(.headline)
            Text(game.winner == "human" ? "侦探胜利" : "AI 胜利")
                .font(.title2.bold())
                .foregroundStyle(game.winner == "human" ? MirageTheme.accent : MirageTheme.ai)

            ResultSettlementCard(game: game)

            VStack(spacing: 8) {
                ForEach(game.players) { player in
                    HStack {
                        PlayerBadge(player: player, phase: game.phase, currentUserId: currentUserId)
                        Spacer()
                        Text(roleTitle(player.role))
                            .font(.caption.weight(.bold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(player.role == "ai" ? MirageTheme.ai.opacity(0.18) : Color.gray.opacity(0.12), in: Capsule())
                            .foregroundStyle(player.role == "ai" ? MirageTheme.ai : .secondary)
                    }
                    .padding()
                    .background(.white, in: RoundedRectangle(cornerRadius: 12))
                }
            }

            if let replay = game.replay {
                ReplaySummaryCard(
                    replay: replay,
                    players: game.players,
                    messages: game.messages,
                    currentUserId: currentUserId,
                    modeId: game.modeId
                )
            } else {
                Text("身份已亮，准备看复盘。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.white, in: RoundedRectangle(cornerRadius: 12))
            }

            if game.phase == "REVEAL" {
                Button(action: viewReplay) {
                    PrimaryButtonLabel(title: "看复盘")
                }
            }

            if game.phase == "COMPLETED" {
                if game.replay != nil {
                    AccountProtectionReplayCard(userKind: model.user?.kind, completedGames: model.userSummary?.stats.completedGames ?? 0, openAccount: openAccount)
                    ReplaySharePreviewCard(game: game)
                    ShareLink(item: replayShareText(game: game)) {
                        Label("分享战报", systemImage: "square.and.arrow.up")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                    }
                    .buttonStyle(.bordered)
                }

                Button {
                    replayAgain(game.modeId, game.roomId, game.rematchRoomId)
                } label: {
                    PrimaryButtonLabel(title: replayButtonTitle)
                }
            }

            if !reportablePlayers.isEmpty {
                ReportPlayersSection(reportablePlayers: reportablePlayers, report: report)
            }
        }
        .padding()
        .background(MirageTheme.panel, in: RoundedRectangle(cornerRadius: 16))
    }

    private var replayButtonTitle: String {
        if game.rematchRoomId != nil {
            return "进入再来一局房间"
        }
        return game.roomId == nil ? "同模式再来一局" : "原房间再来一局"
    }
}

struct AccountProtectionReplayCard: View {
    let userKind: String?
    let completedGames: Int
    let openAccount: () -> Void

    var body: some View {
        if completedGames <= 1 {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: userKind == "apple" ? "checkmark.seal.fill" : "person.crop.circle.badge.checkmark")
                        .font(.title2)
                        .foregroundStyle(MirageTheme.accent)
                        .frame(width: 42, height: 42)
                        .background(MirageTheme.accent.opacity(0.14), in: Circle())
                    VStack(alignment: .leading, spacing: 5) {
                        Text(userKind == "apple" ? "Apple 已保护战绩" : "首局战绩已保存")
                            .font(.headline)
                        Text(accountProtectionText)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    Text(userKind == "apple" ? "已绑定" : "账号")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(MirageTheme.accent)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .background(MirageTheme.accent.opacity(0.12), in: Capsule())
                }
                Button("查看账号", action: openAccount)
                    .font(.subheadline.weight(.bold))
                    .frame(maxWidth: .infinity)
                    .buttonStyle(.bordered)
            }
            .padding()
            .background(.white, in: RoundedRectangle(cornerRadius: 12))
        }
    }

    private var accountProtectionText: String {
        if userKind == "apple" {
            return "这局复盘、经验和装扮会跟随 Apple 账号保留。"
        }
        return "当前使用\(accountProviderTitle(userKind))固定账号保存战绩；iOS 上可优先使用 Apple 登录，换设备更稳。"
    }
}

struct ReplaySharePreviewCard: View {
    let game: MirageGame

    private var won: Bool {
        game.replay?.winner == "human"
    }

    private var resultTitle: String {
        if game.modeId == "M01" {
            return won ? "判断正确" : "判断失误"
        }
        return won ? "抓出伪装者" : "伪装者逃脱"
    }

    private var keyLine: String {
        game.replay?.keyMessages.first { !$0.text.isEmpty }?.text ?? "复盘已整理，来试一局。"
    }

    private var landingText: String {
        replayShareURL(game: game)?.absoluteString ?? "打开图灵迷局，从同模式开始。"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("匿名战报卡")
                        .font(.headline)
                    Text("分享前预览，不带昵称、房号或对局编号。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text("可分享")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(MirageTheme.accent)
            }
            SharePreviewRow(label: "模式", value: "\(modeDisplayTitle(game.modeId)) · \(game.topic.title)")
            SharePreviewRow(label: "结果", value: resultTitle)
            SharePreviewRow(label: "线索", value: keyLine)
            Text(landingText)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding()
        .background(.white, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct SharePreviewRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Text(label)
                .font(.caption2.weight(.bold))
                .foregroundStyle(MirageTheme.accent)
                .frame(width: 34, alignment: .leading)
            Text(value)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct ResultSettlementCard: View {
    let game: MirageGame

    private var won: Bool {
        game.winner == "human"
    }

    private var resultTitle: String {
        if game.modeId == "M01" {
            return won ? "判断正确" : "判断失误"
        }
        return won ? "抓出伪装者" : "伪装者逃脱"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("本局结算")
                .font(.caption.weight(.bold))
                .foregroundStyle(MirageTheme.accent)
            Text(resultTitle)
                .font(.title3.bold())
            HStack(spacing: 8) {
                SettlementMetric(title: "阵营结果", value: won ? "胜利" : "失败")
                SettlementMetric(title: "完成局数", value: "+1")
                SettlementMetric(title: "复盘", value: game.replay == nil ? "整理中" : "已整理")
            }
        }
        .padding()
        .background(.white, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct SettlementMetric: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption2.weight(.bold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.bold())
                .foregroundStyle(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color.black.opacity(0.035), in: RoundedRectangle(cornerRadius: 10))
    }
}

struct ReplaySummaryCard: View {
    let replay: GameReplay
    let players: [GamePlayer]
    let messages: [GameMessage]
    let currentUserId: String?
    let modeId: String

    private var visibleAiGoals: [AiGoal] {
        if let aiGoals = replay.aiGoals, !aiGoals.isEmpty {
            return aiGoals
        }
        if let aiPlayerId = replay.aiPlayerId {
            return [AiGoal(playerId: aiPlayerId, goal: replay.aiGoal)]
        }
        return []
    }

    private var ownTaskResult: GameTaskResult? {
        replay.taskResults?.first { result in
            players.first { $0.id == result.playerId }?.userId == currentUserId
        }
    }

    private var savedClues: [GameMessage] {
        messages.filter { $0.reactionType == "clue" }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("复盘")
                .font(.subheadline.weight(.bold))
            Text("胜负原因")
                .font(.caption.weight(.bold))
                .foregroundStyle(MirageTheme.accent)
            Text(replay.explanation)
                .font(.body)
            if let ownTaskResult {
                ReplayTaskResultCard(result: ownTaskResult)
                    .padding(.vertical, 4)
            }
            ReplayVoteBoardCard(replay: replay, players: players, currentUserId: currentUserId, modeId: modeId)
                .padding(.vertical, 4)
            ReplayCalibrationCard(replay: replay, players: players, currentUserId: currentUserId, modeId: modeId)
                .padding(.vertical, 4)
            ReplayIdentityBoardCard(replay: replay)
                .padding(.vertical, 4)
            if !visibleAiGoals.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("AI 目标")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(MirageTheme.ai)
                    ForEach(visibleAiGoals, id: \.playerId) { item in
                        Text("\(playerName(item.playerId))：\(item.goal ?? "隐藏到归票结束")")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
            if !savedClues.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("我标记的发言")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(MirageTheme.ai)
                    ForEach(savedClues) { message in
                        Text("\(playerName(message.senderPlayerId ?? ""))：“\(message.text)”")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
            ForEach(replay.keyMessages) { message in
                ReplayKeyMessageRow(message: message)
            }
        }
        .padding()
        .background(.white, in: RoundedRectangle(cornerRadius: 12))
    }

    private func playerName(_ playerId: String) -> String {
        players.first { $0.id == playerId }?.nickname ?? "玩家"
    }
}

struct ReplayIdentityBoardCard: View {
    let replay: GameReplay

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("身份结果")
                .font(.caption.weight(.bold))
                .foregroundStyle(MirageTheme.accent)
            ForEach(replay.identitySummary, id: \.playerId) { item in
                HStack {
                    Text(item.nickname)
                        .font(.footnote.weight(.semibold))
                    Spacer()
                    Text(roleTitle(item.role))
                        .font(.footnote)
                        .foregroundStyle(item.role == "ai" ? MirageTheme.ai : .secondary)
                }
            }
        }
        .padding(10)
        .background(Color.black.opacity(0.035), in: RoundedRectangle(cornerRadius: 10))
    }
}

struct ReplayCalibrationCard: View {
    let replay: GameReplay
    let players: [GamePlayer]
    let currentUserId: String?
    let modeId: String

    private var myVote: GameVote? {
        replay.voteSummary.first { $0.userId == currentUserId }
    }

    private var aiPlayerIds: Set<String> {
        if let aiIds = replay.aiPlayerIds, !aiIds.isEmpty {
            return Set(aiIds)
        }
        let identityIds = replay.identitySummary.filter { $0.role == "ai" }.map(\.playerId)
        if !identityIds.isEmpty {
            return Set(identityIds)
        }
        return Set(players.filter { $0.role == "ai" }.map(\.id))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("复盘校准")
                .font(.caption.weight(.bold))
                .foregroundStyle(MirageTheme.accent)
            Text(voteCalibrationTitle)
                .font(.subheadline.weight(.semibold))
            Text(voteCalibrationBody)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(MirageTheme.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }

    private var voteHit: Bool? {
        guard let myVote else { return nil }
        if modeId == "M01", myVote.targetPlayerId == "abstain" {
            return aiPlayerIds.isEmpty
        }
        return aiPlayerIds.contains(myVote.targetPlayerId)
    }

    private var voteCalibrationTitle: String {
        guard myVote != nil else { return "没有完成最终判断" }
        return voteHit == true ? "判断命中" : "判断失准"
    }

    private var voteCalibrationBody: String {
        guard myVote != nil else {
            return "这局没有有效投票，复盘只能保留发言和标记记录。"
        }
        if voteHit == true {
            return "你的最终判断和真实身份一致。"
        }
        return "这次最终判断没有命中；下局多问具体细节再下判断。"
    }
}

struct ReplayTaskResultCard: View {
    let result: GameTaskResult

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("我的任务结果")
                .font(.caption.weight(.bold))
                .foregroundStyle(MirageTheme.accent)
            Text("\(result.completed ? "任务完成" : "任务失败") · \(result.title)")
                .font(.subheadline.weight(.semibold))
            Text(result.summary)
                .font(.footnote)
                .foregroundStyle(.secondary)
            Text(result.goal)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(MirageTheme.accent.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
    }
}

struct ReplayVoteBoardCard: View {
    let replay: GameReplay
    let players: [GamePlayer]
    let currentUserId: String?
    let modeId: String

    private var myVote: GameVote? {
        replay.voteSummary.first { vote in
            vote.userId == currentUserId
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text("我的判断")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(MirageTheme.accent)
                Text(voteTargetLabel(myVote))
                    .font(.subheadline.weight(.bold))
            }
            if !replay.voteSummary.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("投票板")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(MirageTheme.accent)
                    ForEach(replay.voteSummary) { vote in
                        HStack(alignment: .top, spacing: 8) {
                            Text(voterName(vote))
                                .font(.footnote.weight(.semibold))
                            Spacer(minLength: 8)
                            Text(voteTargetLabel(vote))
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.trailing)
                        }
                    }
                }
            }
        }
        .padding(10)
        .background(Color.black.opacity(0.035), in: RoundedRectangle(cornerRadius: 10))
    }

    private func voteTargetLabel(_ vote: GameVote?) -> String {
        guard let vote else { return "未完成判断" }
        if modeId == "M01" {
            if vote.targetPlayerId == "abstain" { return "判断对方是真人" }
            return "判断 \(targetName(vote.targetPlayerId)) 是 AI"
        }
        if vote.targetPlayerId == "abstain" { return "弃票" }
        return "投给 \(targetName(vote.targetPlayerId))"
    }

    private func targetName(_ playerId: String) -> String {
        players.first { $0.id == playerId }?.nickname ?? "已选目标"
    }

    private func voterName(_ vote: GameVote) -> String {
        players.first { $0.id == vote.voterPlayerId }?.nickname ?? "玩家"
    }
}

struct ReplayKeyMessageRow: View {
    let message: ReplayMessage

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("“\(message.text)”")
                .font(.footnote)
                .foregroundStyle(.secondary)
            if let strategyTag = message.strategyTag {
                Text(strategyLabel(strategyTag))
                    .font(.caption)
                    .foregroundStyle(MirageTheme.ai)
            }
        }
        .padding(.top, 4)
    }
}

struct ReportPlayersSection: View {
    @EnvironmentObject private var model: MirageViewModel
    let reportablePlayers: [GamePlayer]
    let report: (_ targetUserId: String, _ reason: String, _ block: Bool) -> Void
    @State private var pendingReport: PendingReport?
    @State private var pendingBlock: PendingBlock?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("局后处理")
                .font(.headline)
            Text("有人扰局？收局后处理。")
                .font(.footnote)
                .foregroundStyle(.secondary)
            ForEach(reportablePlayers) { player in
                HStack(spacing: 10) {
                    PlayerBadge(player: player, phase: "COMPLETED", currentUserId: nil)
                    Spacer()
                    if let targetUserId = player.userId {
                        Button("举报") {
                            pendingReport = PendingReport(targetUserId: targetUserId, nickname: player.nickname, block: false)
                        }
                        .font(.caption.weight(.semibold))
                        Button("拉黑", role: .destructive) {
                            pendingBlock = PendingBlock(targetUserId: targetUserId, nickname: player.nickname)
                        }
                        .font(.caption.weight(.semibold))
                        Button("举报并拉黑", role: .destructive) {
                            pendingReport = PendingReport(targetUserId: targetUserId, nickname: player.nickname, block: true)
                        }
                        .font(.caption.weight(.semibold))
                    }
                }
                .padding()
                .background(.white, in: RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(.top, 4)
        .confirmationDialog(
            pendingReportTitle,
            isPresented: Binding(
                get: { pendingReport != nil },
                set: { if !$0 { pendingReport = nil } }
            ),
            titleVisibility: .visible
        ) {
            ForEach(reportReasonOptions) { option in
                Button(option.title) {
                    guard let pendingReport else { return }
                    report(pendingReport.targetUserId, option.reason, pendingReport.block)
                    self.pendingReport = nil
                }
            }
            Button("取消", role: .cancel) {
                pendingReport = nil
            }
        } message: {
            Text("选择一个理由，运营会查看本局上下文。")
        }
        .confirmationDialog(
            pendingBlockTitle,
            isPresented: Binding(
                get: { pendingBlock != nil },
                set: { if !$0 { pendingBlock = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("拉黑", role: .destructive) {
                guard let pendingBlock else { return }
                Task { await model.blockUser(targetUserId: pendingBlock.targetUserId, nickname: pendingBlock.nickname) }
                self.pendingBlock = nil
            }
            Button("取消", role: .cancel) {
                pendingBlock = nil
            }
        } message: {
            Text("之后不会再和该玩家同桌。")
        }
    }

    private var pendingReportTitle: String {
        guard let pendingReport else { return "选择举报理由" }
        return (pendingReport.block ? "举报并拉黑 " : "举报 ") + pendingReport.nickname
    }

    private var pendingBlockTitle: String {
        guard let pendingBlock else { return "拉黑玩家" }
        return "拉黑 " + pendingBlock.nickname
    }
}

struct PendingReport {
    let targetUserId: String
    let nickname: String
    let block: Bool
}

struct PendingBlock {
    let targetUserId: String
    let nickname: String
}

struct ReportReasonOption: Identifiable {
    let id: String
    let reason: String
    let title: String
}

let reportReasonOptions = [
    ReportReasonOption(id: "disruptive", reason: "post_game_disruptive_play", title: "扰局发言"),
    ReportReasonOption(id: "harassment", reason: "post_game_harassment", title: "攻击骚扰"),
    ReportReasonOption(id: "threat", reason: "post_game_threat_or_self_harm", title: "威胁/自伤"),
    ReportReasonOption(id: "spam", reason: "post_game_spam_or_scam", title: "垃圾广告"),
    ReportReasonOption(id: "other", reason: "post_game_player_report", title: "其他问题")
]

struct BottomPhaseBar: View {
    let phase: String
    let taskCardPending: Bool
    let finalStatementSubmitted: Bool
    @Binding var draft: String
    let send: () -> Void

    var body: some View {
        if phase == "DISCUSSION" && !taskCardPending {
            Composer(draft: $draft, send: send)
        } else if phase == "FINAL_STATEMENT" && !finalStatementSubmitted {
            Composer(draft: $draft, send: send, placeholder: "最后陈述...")
        } else {
            HStack {
                Image(systemName: phase == "VOTING" ? "checkmark.seal.fill" : "lock.fill")
                Text(barText)
                Spacer()
            }
            .font(.footnote.weight(.semibold))
            .foregroundStyle(.white.opacity(0.68))
            .padding(14)
            .background(.white.opacity(0.10))
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(.white.opacity(0.10))
                    .frame(height: 1)
            }
        }
    }

    private var barText: String {
        if taskCardPending { return "先确认任务卡，再开始发言" }
        if phase == "FINAL_STATEMENT" && finalStatementSubmitted { return "已提交最终陈述，等待归票" }
        if phase == "VOTING" { return "请在上方完成投票" }
        return "本阶段不能发言"
    }
}

struct Composer: View {
    @Binding var draft: String
    let send: () -> Void
    var placeholder = "本轮发言..."

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                TextField(placeholder, text: $draft)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 12)
                    .frame(minHeight: 42)
                    .foregroundStyle(.white)
                    .tint(MirageTheme.accent)
                    .background(.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(.white.opacity(0.10), lineWidth: 1)
                    )
                Button(action: send) {
                    Image(systemName: "paperplane.fill")
                        .frame(width: 42, height: 42)
                        .background(MirageTheme.accent, in: Circle())
                        .foregroundStyle(.white)
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(12)
        .background(.white.opacity(0.10))
        .overlay(alignment: .top) {
            Rectangle()
                .fill(.white.opacity(0.10))
                .frame(height: 1)
        }
    }
}

extension View {
    func gameActionPanelBackground(cornerRadius: CGFloat = 16) -> some View {
        self
            .background(.white.opacity(0.10), in: RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(.white.opacity(0.10), lineWidth: 1)
            )
    }
}

enum MirageTheme {
    static let gameBackground = LinearGradient(
        colors: [Color(red: 0.06, green: 0.08, blue: 0.13), Color(red: 0.11, green: 0.10, blue: 0.13)],
        startPoint: .top,
        endPoint: .bottom
    )
    static let background = Color(red: 0.97, green: 0.95, blue: 0.90)
    static let panel = Color(red: 1.00, green: 0.92, blue: 0.76)
    static let accent = Color(red: 0.93, green: 0.58, blue: 0.02)
    static let ai = Color(red: 0.02, green: 0.67, blue: 0.78)
    static let avatar = Color(red: 0.16, green: 0.18, blue: 0.22)
}

func phaseTitle(_ phase: String) -> String {
    switch phase {
    case "DISCUSSION":
        "开聊中"
    case "FINAL_STATEMENT":
        "最终陈述"
    case "VOTING":
        "归票中"
    case "REVEAL":
        "亮身份"
    case "COMPLETED":
        "复盘"
    default:
        phase
    }
}

func phaseShortTitle(_ phase: String) -> String {
    switch phase {
    case "TASK":
        "任务"
    case "DISCUSSION":
        "讨论"
    case "FINAL_STATEMENT":
        "陈述"
    case "VOTING":
        "投票"
    case "REVEAL":
        "揭晓"
    case "COMPLETED":
        "复盘"
    default:
        phase
    }
}

func flowStepTitle(_ step: String) -> String {
    switch step {
    case "讨论发言":
        "开聊"
    case "投票归票":
        "归票"
    case "最终陈述":
        "陈述"
    case "身份揭晓":
        "揭晓"
    case "成员准备":
        "准备"
    case "创建房间":
        "开房"
    default:
        step
    }
}

func roleTitle(_ role: String) -> String {
    switch role {
    case "human":
        "侦探"
    case "human_undercover":
        "人类卧底"
    case "fake_ai":
        "伪 AI 真人"
    case "ai":
        "AI"
    case "hidden":
        "隐藏"
    default:
        role
    }
}

func accountProviderTitle(_ provider: String?) -> String {
    switch provider {
    case "apple":
        "Apple "
    case "wechat":
        "微信 "
    case "google":
        "Google "
    default:
        ""
    }
}

func taskCardTitle(_ role: String) -> String {
    switch role {
    case "human":
        "侦探任务"
    case "human_undercover":
        "阵营任务"
    case "fake_ai":
        "诱饵任务"
    case "ai":
        "伪装任务"
    default:
        "本局任务"
    }
}

func taskGoal(_ player: GamePlayer?, modeId: String? = nil) -> String {
    if let hiddenTask = player?.hiddenTask, !hiddenTask.isEmpty {
        return hiddenTask
    }
    let role = player?.role ?? "hidden"
    switch role {
    case "human":
        if modeId == "M01" {
            return "听发言、抓细节，归票时判断对方是真人还是 AI。"
        }
        return "听发言、抓破绽，归票时找出伪装者。"
    case "human_undercover":
        return "保护你的 AI 同盟，别让真正 AI 成为唯一最高票。"
    case "fake_ai":
        return "故意露出 AI 感，吸走怀疑，保护真正 AI。"
    case "ai":
        return "保持自然发言，尽量撑过投票。"
    default:
        return "先观察发言，别暴露判断。"
    }
}

func taskWinCondition(_ player: GamePlayer?, game: MirageGame) -> String {
    let role = player?.role ?? "hidden"
    if game.modeId == "M01" && role == "human" {
        return "归票时判断对方是真人或 AI，判断正确即完成侦探任务。"
    }
    if game.modeId == "M04" && role == "human" {
        return "把票分到两名 AI 身上，让它们的得票都压过所有真人。"
    }
    switch role {
    case "human":
        return "让真正 AI 成为唯一最高票；投错真人、平票或弃权都会放走伪装者。"
    case "human_undercover":
        return "让真正 AI 不成为唯一最高票；你被投出也算 AI 同盟达成目标。"
    case "fake_ai":
        return "吸走怀疑，让真正 AI 不成为唯一最高票。"
    case "ai":
        return "避免自己成为唯一最高票；利用发言和他人怀疑撑过归票。"
    default:
        return "看你有没有完成本局任务。"
    }
}

func taskTools(_ player: GamePlayer?, game: MirageGame) -> String {
    ["自由发问", "标记线索", "最终陈述", game.modeId == "M01" ? "真假判断" : "归票"].joined(separator: " / ")
}

func taskBoundary(_ player: GamePlayer?) -> String {
    switch player?.role ?? "hidden" {
    case "human_undercover":
        return "不能明说同盟身份；技能只制造公开掩护线索，不直接改票。"
    case "fake_ai":
        return "不能把自己当成真正 AI；你的目标是制造误判，不是直接改票。"
    case "ai":
        return "不能看到真人私有任务；只能靠发言影响判断。"
    default:
        return "不要把语气像 AI 当成答案；投票前只能靠发言、证据和表态判断。"
    }
}

func visibleRoleTitle(_ player: GamePlayer, phase: String, isSelf: Bool) -> String {
    if phase == "REVEAL" || phase == "COMPLETED" {
        return roleTitle(player.role)
    }
    if isSelf {
        return player.role == "human" ? "侦探" : roleTitle(player.role)
    }
    return "待判断"
}

func roomStatusTitle(_ status: String) -> String {
    switch status {
    case "LOBBY":
        "等待准备"
    case "IN_GAME":
        "对局中"
    case "CLOSED":
        "已关闭"
    default:
        status
    }
}

func modeDisplayTitle(_ modeId: String) -> String {
    switch modeId {
    case "M01":
        "单线接触"
    case "M02":
        "三角定位"
    case "M03":
        "开放频道"
    case "M04":
        "双源干扰"
    case "M06":
        "引路人"
    case "M08":
        "拟声陷阱"
    default:
        modeId
    }
}

func topicRiskTitle(_ risk: String) -> String {
    switch risk {
    case "low":
        "轻松话题"
    case "high":
        "谨慎发言"
    default:
        "标准话题"
    }
}

func playerKindTitle(_ kind: String) -> String {
    switch kind {
    case "human":
        "真人玩家"
    case "ai":
        "AI 玩家"
    case "unknown":
        "身份未知"
    default:
        kind
    }
}

func topicHint(for phase: String, modeId: String? = nil) -> String {
    switch phase {
    case "DISCUSSION":
        return "围绕话题发言，抓回避、空话和前后不一致。"
    case "FINAL_STATEMENT":
        return "每名真人只能补一句最后判断，随后进入归票。"
    case "VOTING":
        if modeId == "M01" {
            return "讨论结束，判断对方是真人还是 AI。提交后会立即揭晓。"
        }
        return "讨论结束，锁定最可疑的座位。归票结束或全员交票前可修改。"
    case "REVEAL":
        return "身份已亮，准备看复盘。"
    case "COMPLETED":
        return "复盘已整理，回看关键发言后可以再开一局。"
    default:
        return "按当前阶段行动。"
    }
}

func replayShareText(game: MirageGame) -> String {
    let won = game.replay?.winner == "human"
    let resultTitle = game.modeId == "M01" ? (won ? "判断正确" : "判断失误") : (won ? "抓出伪装者" : "伪装者逃脱")
    let keyLine = game.replay?.keyMessages.first { !$0.text.isEmpty }?.text
    let landingURL = replayShareURL(game: game)?.absoluteString
    let lines: [String?] = [
        "图灵迷局战报",
        "模式：\(modeDisplayTitle(game.modeId))",
        "话题：\(game.topic.title)",
        "结果：\(resultTitle)",
        keyLine.map { "关键线索：\($0)" },
        landingURL.map { "来一局：\($0)" } ?? "来一局：打开图灵迷局，从同模式开始。"
    ]
    return lines.compactMap { $0 }.joined(separator: "\n")
}

func replayShareURL(game: MirageGame) -> URL? {
    let rawBaseURL = (Bundle.main.object(forInfoDictionaryKey: "MirageAPIBaseURL") as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines)
    guard let rawBaseURL, var components = URLComponents(string: rawBaseURL) else {
        return nil
    }
    components.path = "/"
    components.queryItems = [
        URLQueryItem(name: "mode", value: game.modeId),
        URLQueryItem(name: "topic", value: game.topic.id)
    ]
    return components.url
}

func compactText(_ value: String, limit: Int) -> String {
    if value.count <= limit { return value }
    return String(value.prefix(max(0, limit - 1))) + "…"
}

func percentText(_ value: Double?) -> String {
    guard let value else { return "0%" }
    return "\(Int((value * 100).rounded()))%"
}

func strategyLabel(_ tag: String) -> String {
    switch tag {
    case "balanced_opinion":
        "表达太均衡"
    case "soft_deflection":
        "回答较笼统，缺少具体细节"
    case "partial_agreement":
        "部分认同后转移重点"
    case "goal_shift":
        "总往规则上绕"
    case "llm_mock":
        "像模板回答"
    default:
        tag
    }
}

func shortCode(_ value: String) -> String {
    String(value.prefix(6)).uppercased()
}

func timeLabel(_ value: String) -> String {
    let formatter = ISO8601DateFormatter()
    guard let date = formatter.date(from: value) else { return "刚刚" }
    let output = DateFormatter()
    output.dateFormat = "HH:mm"
    return output.string(from: date)
}

func waitingElapsedText(now: Date = Date(), startedAt value: String?) -> String {
    let seconds = waitingElapsedSeconds(now: now, startedAt: value)
    if seconds >= 60 {
        return "\(seconds / 60) 分 \(String(format: "%02d", seconds % 60)) 秒"
    }
    return "\(seconds) 秒"
}

func waitingFallbackText(now: Date = Date(), startedAt value: String?) -> String {
    if waitingElapsedSeconds(now: now, startedAt: value) >= 45 {
        return "已经等了一会儿，可以先改玩单线接触或开好友房。"
    }
    return "超过 45 秒还没凑齐时，可以切到单线接触或开好友房。"
}

func friendRoomFallbackText(now: Date = Date(), startedAt value: String?, humanCount: Int, requiredHumanCount: Int) -> String {
    if humanCount >= requiredHumanCount {
        return "真人已到齐，准备后由房主开始。"
    }
    let missing = max(0, requiredHumanCount - humanCount)
    if waitingElapsedSeconds(now: now, startedAt: value) >= 90 {
        return "还差 \(missing) 名真人。等太久时可以先玩单线接触，或复制房号继续拉人。"
    }
    return "还差 \(missing) 名真人。先复制房号拉好友，超过 90 秒可改玩单线接触。"
}

func waitingElapsedSeconds(now: Date = Date(), startedAt value: String?) -> Int {
    guard let value else { return 0 }
    let formatter = ISO8601DateFormatter()
    guard let startedAt = formatter.date(from: value) else { return 0 }
    return max(0, Int(now.timeIntervalSince(startedAt)))
}

func remainingTimeText(_ value: String?) -> String {
    guard let value else { return "--:--" }
    let formatter = ISO8601DateFormatter()
    guard let date = formatter.date(from: value) else { return "--:--" }
    let seconds = max(0, Int(date.timeIntervalSinceNow))
    return String(format: "%02d:%02d", seconds / 60, seconds % 60)
}

func phaseExpired(_ value: String?) -> Bool {
    guard let value else { return false }
    let formatter = ISO8601DateFormatter()
    guard let date = formatter.date(from: value) else { return false }
    return date <= Date()
}
