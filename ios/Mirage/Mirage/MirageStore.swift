import Foundation
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

enum MirageRoute {
    case bootstrapping
    case onboarding
    case home
    case waiting
    case friendRoom
    case game
}

@MainActor
final class MirageViewModel: ObservableObject {
    @Published var route: MirageRoute = .onboarding
    @Published var user: MirageUser?
    @Published var modes: [GameMode] = []
    @Published var worldSetting: WorldSetting?
    @Published var topics: [GameTopic] = []
    @Published var room: MirageRoom?
    @Published var game: MirageGame?
    @Published var userSummary: UserSummary?
    @Published var gameHistory: [UserGameHistoryItem] = []
    @Published var leaderboard: LeaderboardSummary?
    @Published var commerceCatalog: CommerceCatalog?
    @Published var preferredHomeTab: String?
    @Published var matchmakingTicketId: String?
    @Published var waitingModeId: String?
    @Published var waitingTopicId: String?
    @Published var waitingStartedAt: String?
    @Published var copiedInviteCode: String?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var lastReportStatus: String?
    @Published var lastRewardStatus: String?

    private let legalBaseURL: URL
    private let api: MirageAPIClient
    private let configurationError: String?

    init() {
        let resolvedBaseURL = Self.resolveBaseURL()
        let baseURL = resolvedBaseURL.url
        self.legalBaseURL = baseURL
        let token = KeychainTokenStore.readToken()
        self.api = MirageAPIClient(baseURL: baseURL, token: token)
        self.configurationError = resolvedBaseURL.errorMessage
        self.errorMessage = resolvedBaseURL.errorMessage
        if resolvedBaseURL.errorMessage != nil {
            return
        }
        if token != nil {
            route = .bootstrapping
            Task { await bootstrapSession() }
        }
    }

    var isBanned: Bool {
        user?.bannedAt != nil
    }

    var banReason: String? {
        user?.banReason
    }

    func signInGuest(nickname: String, ageConfirmed: Bool, communityConfirmed: Bool) async {
        await run {
            let auth = try await api.signInAsGuest(
                nickname: nickname.isEmpty ? "玩家" : nickname,
                ageConfirmed: ageConfirmed,
                communityConfirmed: communityConfirmed
            )
            try await finishAuth(auth)
        }
    }

    func signInApple(
        identityToken: String,
        authorizationCode: String?,
        nickname: String?,
        ageConfirmed: Bool,
        communityConfirmed: Bool
    ) async {
        await run {
            let auth = try await api.signInWithApple(
                identityToken: identityToken,
                authorizationCode: authorizationCode,
                nickname: nickname,
                ageConfirmed: ageConfirmed,
                communityConfirmed: communityConfirmed
            )
            try await finishAuth(auth)
        }
    }

    func signInGoogle(identityToken: String, nickname: String?, ageConfirmed: Bool, communityConfirmed: Bool) async {
        await run {
            let auth = try await api.signInWithGoogle(
                identityToken: identityToken,
                nickname: nickname,
                ageConfirmed: ageConfirmed,
                communityConfirmed: communityConfirmed
            )
            try await finishAuth(auth)
        }
    }

    func signInWeChat(code: String, nickname: String?, ageConfirmed: Bool, communityConfirmed: Bool) async {
        await run {
            let auth = try await api.signInWithWeChat(
                code: code,
                nickname: nickname,
                ageConfirmed: ageConfirmed,
                communityConfirmed: communityConfirmed
            )
            try await finishAuth(auth)
        }
    }

    func loadModes() async {
        await run(showLoading: false) {
            async let fetchedModes = api.fetchModes()
            async let fetchedTopics = api.fetchTopics()
            let modeList = try await fetchedModes
            modes = modeList.modes
            worldSetting = modeList.worldSetting
            topics = try await fetchedTopics
        }
    }

    func loadUserSummary() async {
        await run(showLoading: false) {
            userSummary = try await api.fetchUserSummary()
        }
    }

    func loadHomeData() async {
        await run(showLoading: false) {
            async let fetchedSummary = api.fetchUserSummary()
            async let fetchedGames = api.fetchUserGames()
            async let fetchedLeaderboard = api.fetchLeaderboard()
            async let fetchedCommerceCatalog = api.fetchCommerceCatalog()
            userSummary = try await fetchedSummary
            gameHistory = try await fetchedGames
            leaderboard = try await fetchedLeaderboard
            commerceCatalog = try await fetchedCommerceCatalog
        }
    }

    func resumeFromForeground() async {
        guard user != nil || route == .bootstrapping else { return }
        await run(showLoading: false) {
            user = try await api.fetchMe()
            if modes.isEmpty || topics.isEmpty {
                async let fetchedModes = api.fetchModes()
                async let fetchedTopics = api.fetchTopics()
                let modeList = try await fetchedModes
                modes = modeList.modes
                worldSetting = modeList.worldSetting
                topics = try await fetchedTopics
            }

            if isBanned {
                game = nil
                room = nil
                copiedInviteCode = nil
                clearWaitingContext()
                async let fetchedSummary = api.fetchUserSummary()
                async let fetchedGames = api.fetchUserGames()
                userSummary = try await fetchedSummary
                gameHistory = try await fetchedGames
                route = .home
                return
            }

            switch route {
            case .home:
                async let fetchedSummary = api.fetchUserSummary()
                async let fetchedGames = api.fetchUserGames()
                async let fetchedLeaderboard = api.fetchLeaderboard()
                async let fetchedCommerceCatalog = api.fetchCommerceCatalog()
                userSummary = try await fetchedSummary
                gameHistory = try await fetchedGames
                leaderboard = try await fetchedLeaderboard
                commerceCatalog = try await fetchedCommerceCatalog
            case .waiting:
                if let ticketId = matchmakingTicketId {
                    let response = try await api.fetchMatchmakingStatus(ticketId: ticketId)
                    if let nextGame = response.game {
                        game = nextGame
                        clearWaitingContext()
                        route = .game
                    }
                }
            case .friendRoom:
                if let roomId = room?.id {
                    let latestRoom = try await api.fetchRoom(roomId: roomId)
                    room = latestRoom
                    if let gameId = latestRoom.gameId {
                        game = try await api.fetchGame(gameId: gameId)
                        route = .game
                    }
                }
            case .game:
                if let gameId = game?.id {
                    game = try await api.fetchGame(gameId: gameId)
                    if game?.phase == "COMPLETED" {
                        async let fetchedSummary = api.fetchUserSummary()
                        async let fetchedGames = api.fetchUserGames()
                        async let fetchedLeaderboard = api.fetchLeaderboard()
                        userSummary = try await fetchedSummary
                        gameHistory = try await fetchedGames
                        leaderboard = try await fetchedLeaderboard
                    }
                }
            case .bootstrapping, .onboarding:
                break
            }
        }
    }

    func claimMissionReward(missionId: String) async {
        let rewardText = rewardClaimText(missionId: missionId)
        let previousProgression = userSummary?.progression
        await run(showLoading: false) {
            let nextSummary = try await api.claimMissionReward(missionId: missionId)
            userSummary = nextSummary
            leaderboard = try await api.fetchLeaderboard()
            showRewardStatus(rewardResultText(previous: previousProgression, next: nextSummary.progression, fallback: rewardText))
        }
    }

    func claimAllMissionRewards() async {
        let rewardText = allMissionRewardClaimText()
        let previousProgression = userSummary?.progression
        await run(showLoading: false) {
            let nextSummary = try await api.claimAllMissionRewards()
            userSummary = nextSummary
            leaderboard = try await api.fetchLeaderboard()
            showRewardStatus(rewardResultText(previous: previousProgression, next: nextSummary.progression, fallback: rewardText))
        }
    }

    func unlockCosmetic(itemId: String) async {
        await run(showLoading: false) {
            let nextSummary = try await api.unlockCosmetic(itemId: itemId)
            userSummary = nextSummary
            let itemName = nextSummary.cosmetics?.items.first(where: { $0.id == itemId })?.name ?? "装扮"
            showRewardStatus("已解锁并装备：\(itemName)")
        }
    }

    func equipCosmetic(itemId: String) async {
        await run(showLoading: false) {
            let nextSummary = try await api.equipCosmetic(itemId: itemId)
            userSummary = nextSummary
            let itemName = nextSummary.cosmetics?.items.first(where: { $0.id == itemId })?.name ?? "装扮"
            showRewardStatus("已装备：\(itemName)")
        }
    }

    // 所有模式统一走快速开始：单人点开即玩，缺的席位由 AI/脚本补位，不进匹配等待。
    func startMode(_ modeId: String, topicId: String? = nil) async {
        guard canStartPlay() else { return }
        await run {
            let resolvedTopicId = topicId ?? defaultTopicId(for: modeId)
            let response = try await api.quickStart(modeId: modeId, topicId: resolvedTopicId)
            if let nextGame = response.game {
                game = nextGame
                clearWaitingContext()
                route = .game
            }
        }
    }

    func createFriendRoom(modeId: String = "M03", topicId: String? = nil) async {
        guard canStartPlay() else { return }
        await run {
            room = try await api.createRoom(modeId: modeId, topicId: topicId ?? defaultTopicId(for: modeId))
            copiedInviteCode = nil
            route = .friendRoom
        }
    }

    func replayAgain(modeId: String, roomId: String?, rematchRoomId: String?) async {
        guard canStartPlay() else { return }
        // 所有模式统一走快速开始再来一局；好友房联机暂不开发。
        await startMode(modeId)
    }

    func joinFriendRoom(inviteCode: String) async {
        guard canStartPlay() else { return }
        let normalizedInviteCode = Self.normalizedInviteCode(inviteCode)
        guard normalizedInviteCode.count == 6 else {
            errorMessage = "请输入 6 位房号。"
            return
        }
        await run {
            room = try await api.joinRoom(inviteCode: normalizedInviteCode)
            copiedInviteCode = nil
            route = .friendRoom
        }
    }

    func refreshRoom() async {
        guard let room else { return }
        await run(showLoading: false) {
            let latestRoom = try await api.fetchRoom(roomId: room.id)
            self.room = latestRoom
            if let gameId = latestRoom.gameId {
                self.game = try await api.fetchGame(gameId: gameId)
                self.route = .game
            }
        }
    }

    func pollFriendRoom() async {
        guard let roomId = room?.id else { return }
        while route == .friendRoom && room?.id == roomId && !Task.isCancelled {
            await refreshRoom()
            guard route == .friendRoom && room?.id == roomId && !Task.isCancelled else { break }
            try? await Task.sleep(nanoseconds: 3_000_000_000)
        }
    }

    func pollMatchmaking() async {
        guard let ticketId = matchmakingTicketId else { return }
        while route == .waiting && matchmakingTicketId == ticketId && !Task.isCancelled {
            await run(showLoading: false) {
                let response = try await api.fetchMatchmakingStatus(ticketId: ticketId)
                if let nextGame = response.game {
                    game = nextGame
                    clearWaitingContext()
                    route = .game
                }
            }
            guard route == .waiting && matchmakingTicketId == ticketId && !Task.isCancelled else { break }
            try? await Task.sleep(nanoseconds: 3_000_000_000)
        }
    }

    func cancelMatchmakingAndGoHome() async {
        guard let ticketId = matchmakingTicketId else {
            goHome()
            return
        }
        await run {
            let response = try await api.cancelMatchmaking(ticketId: ticketId)
            if let nextGame = response.game {
                game = nextGame
                clearWaitingContext()
                route = .game
            } else {
                goHome()
            }
        }
    }

    func switchWaitingToQuickStart() async {
        guard canStartPlay() else { return }
        let canSwitch = await cancelWaitingTicketForAlternative()
        if canSwitch {
            await startMode("M01")
        }
    }

    func switchWaitingToFriendRoom() async {
        guard canStartPlay() else { return }
        let canSwitch = await cancelWaitingTicketForAlternative()
        if canSwitch {
            await createFriendRoom(modeId: "M03")
        }
    }

    func setReady(_ ready: Bool) async {
        guard let room else { return }
        await run {
            self.room = try await api.setReady(roomId: room.id, ready: ready)
        }
    }

    func setRoomTopic(topicId: String) async {
        guard let room else { return }
        await run {
            self.room = try await api.setRoomTopic(roomId: room.id, topicId: topicId)
        }
    }

    func startRoom() async {
        guard let room else { return }
        guard room.status == "LOBBY" else {
            errorMessage = "房间当前不能开局。"
            return
        }
        guard room.hostUserId == user?.id else {
            errorMessage = "只有房主可以开始。"
            return
        }
        guard room.players.filter({ $0.kind == "human" }).count >= requiredHumanCount(for: room) else {
            errorMessage = "真人玩家不足，先邀请朋友加入。"
            return
        }
        guard room.players.filter({ $0.kind == "human" }).allSatisfy({ $0.ready }) else {
            errorMessage = "还有成员未准备。"
            return
        }
        await run {
            let response = try await api.startRoom(roomId: room.id)
            self.room = response.room
            self.game = response.game
            self.route = .game
        }
    }

    func copyInviteCode() {
        guard let inviteCode = room?.inviteCode else { return }
        #if canImport(UIKit)
        UIPasteboard.general.string = inviteCode
        copiedInviteCode = inviteCode
        #else
        copiedInviteCode = inviteCode
        #endif
    }

    func leaveFriendRoomAndGoHome() async {
        guard let room else {
            goHome()
            return
        }
        await run {
            _ = try await api.leaveRoom(roomId: room.id)
            goHome()
        }
    }

    func refreshGame() async {
        guard let game else { return }
        await run(showLoading: false) {
            self.game = try await api.fetchGame(gameId: game.id)
            if self.game?.phase == "COMPLETED" {
                self.userSummary = try await api.fetchUserSummary()
                self.gameHistory = try await api.fetchUserGames()
                self.leaderboard = try await api.fetchLeaderboard()
            }
        }
    }

    func openGameFromHistory(_ gameId: String) async {
        await run {
            game = try await api.fetchGame(gameId: gameId)
            route = .game
        }
    }

    func viewReplay() async {
        guard let game else { return }
        await run {
            self.game = try await api.viewReplay(gameId: game.id)
            self.userSummary = try await api.fetchUserSummary()
            self.gameHistory = try await api.fetchUserGames()
            self.leaderboard = try await api.fetchLeaderboard()
        }
    }

    func acknowledgeTaskCard() async {
        guard let game else { return }
        await run(showLoading: false) {
            self.game = try await api.acknowledgeTaskCard(gameId: game.id)
        }
    }

    func sendMessage(_ text: String) async {
        guard let game else { return }
        await run(showLoading: false) {
            self.game = try await api.sendMessage(gameId: game.id, text: text)
        }
    }

    func toggleMessageClue(messageId: String) async {
        guard let game else { return }
        await run(showLoading: false) {
            self.game = try await api.toggleMessageClue(gameId: game.id, messageId: messageId)
        }
    }

    func vote(targetPlayerId: String) async {
        guard let game else { return }
        await run {
            self.game = try await api.vote(gameId: game.id, targetPlayerId: targetPlayerId)
        }
    }

    func report(messageId: String?, targetUserId: String?, reason: String = "post_game_player_report", block: Bool) async {
        await run(showLoading: false) {
            let report = try await api.report(
                gameId: game?.id,
                roomId: room?.id,
                messageId: messageId,
                targetUserId: targetUserId,
                reason: reason,
                block: block
            )
            lastReportStatus = "举报已提交：\(report.status)"
        }
    }

    func blockUser(targetUserId: String, nickname: String) async {
        await run(showLoading: false) {
            _ = try await api.blockUser(targetUserId: targetUserId)
            lastReportStatus = "已拉黑 \(nickname)"
            await loadHomeData()
        }
    }

    func deleteAccount() async {
        await run {
            _ = try await api.deleteAccount()
            await clearLocalSession()
        }
    }

    func goHome(tab: String? = nil) {
        game = nil
        room = nil
        copiedInviteCode = nil
        clearWaitingContext()
        preferredHomeTab = tab
        route = .home
        if user != nil {
            Task { await loadHomeData() }
        }
    }

    func legalURL(_ path: String) -> URL {
        URL(string: path, relativeTo: legalBaseURL)!
    }

    private func canStartPlay() -> Bool {
        if isBanned {
            errorMessage = "账号已被限制，无法继续进入游戏。可在设置中查看规则、联系客服或删除账号。"
            return false
        }
        return true
    }

    private func requiredHumanCount(for room: MirageRoom) -> Int {
        if let mode = modes.first(where: { $0.id == room.modeId }) {
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

    private func isFriendRoomMode(_ modeId: String) -> Bool {
        if let mode = modes.first(where: { $0.id == modeId }) {
            return mode.matchType == "friend_room"
        }
        return ["M03", "M04", "M06", "M08"].contains(modeId)
    }

    private func rewardClaimText(missionId: String) -> String {
        guard let mission = userSummary?.missions.items?.first(where: { $0.id == missionId }) else {
            return "任务奖励已领取"
        }
        return "领取成功：推理星 +\(mission.reward.clueStars) · 经验 +\(mission.reward.xp)"
    }

    private func allMissionRewardClaimText() -> String {
        let missions = userSummary?.missions.items?.filter { $0.claimable && !$0.claimed } ?? []
        let clueStars = missions.reduce(0) { $0 + $1.reward.clueStars }
        let xp = missions.reduce(0) { $0 + $1.reward.xp }
        if clueStars == 0 && xp == 0 {
            return "暂无可领取奖励"
        }
        return "领取成功：推理星 +\(clueStars) · 经验 +\(xp)"
    }

    private func rewardResultText(previous: UserProgressionSummary?, next: UserProgressionSummary?, fallback: String) -> String {
        guard let next else { return fallback }
        let previousLevel = previous?.level ?? next.level
        let previousTitle = previous?.title ?? next.title
        if next.level > previousLevel || next.title != previousTitle {
            return "称号升级：Lv.\(next.level) \(next.title)"
        }
        return fallback
    }

    private func showRewardStatus(_ message: String) {
        lastRewardStatus = message
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            await MainActor.run {
                if self?.lastRewardStatus == message {
                    self?.lastRewardStatus = nil
                }
            }
        }
    }

    private static func normalizedInviteCode(_ value: String) -> String {
        let filtered = value.uppercased().replacingOccurrences(of: "[^A-Z0-9]", with: "", options: .regularExpression)
        return String(filtered.prefix(6))
    }

    func topicsForMode(_ modeId: String) -> [GameTopic] {
        topics.filter { topic in
            if topic.enabled == false { return false }
            guard let modeIds = topic.modeIds, !modeIds.isEmpty else { return true }
            return modeIds.contains(modeId)
        }
    }

    func topicTitle(for topicId: String?) -> String {
        guard let topicId, let topic = topics.first(where: { $0.id == topicId }) else {
            return "围绕主题聊天，找出隐藏的 AI。"
        }
        return topic.title
    }

    private func defaultTopicId(for modeId: String) -> String? {
        topicsForMode(modeId).first?.id
    }

    private func cancelWaitingTicketForAlternative() async -> Bool {
        guard let ticketId = matchmakingTicketId else {
            return true
        }
        var canSwitch = false
        await run {
            let response = try await api.cancelMatchmaking(ticketId: ticketId)
            if let nextGame = response.game {
                game = nextGame
                clearWaitingContext()
                route = .game
                canSwitch = false
            } else {
                clearWaitingContext()
                canSwitch = true
            }
        }
        return canSwitch && route != .game
    }

    private static func resolveBaseURL() -> (url: URL, errorMessage: String?) {
        let rawBaseURL = (Bundle.main.object(forInfoDictionaryKey: "MirageAPIBaseURL") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)

        #if DEBUG
        let fallbackURL = URL(string: "http://127.0.0.1:8787")!
        guard let rawBaseURL, !rawBaseURL.isEmpty else {
            return (fallbackURL, nil)
        }
        guard let url = URL(string: rawBaseURL) else {
            return (fallbackURL, "API 地址无效，已回退到本地开发服务。")
        }
        return (url, nil)
        #else
        let safeFallbackURL = URL(string: "https://invalid.mirage.local")!
        guard let rawBaseURL, !rawBaseURL.isEmpty, let url = URL(string: rawBaseURL) else {
            return (safeFallbackURL, "生产 API 地址未配置。")
        }
        let host = url.host?.lowercased()
        if url.scheme?.lowercased() != "https" || host == "localhost" || host == "127.0.0.1" {
            return (safeFallbackURL, "生产 API 地址必须使用 HTTPS 公网域名。")
        }
        return (url, nil)
        #endif
    }

    private func bootstrapSession() async {
        isLoading = true
        errorMessage = nil
        do {
            user = try await api.fetchMe()
            async let fetchedModes = api.fetchModes()
            async let fetchedTopics = api.fetchTopics()
            let modeList = try await fetchedModes
            modes = modeList.modes
            worldSetting = modeList.worldSetting
            topics = try await fetchedTopics
            async let fetchedSummary = api.fetchUserSummary()
            async let fetchedGames = api.fetchUserGames()
            async let fetchedLeaderboard = api.fetchLeaderboard()
            async let fetchedCommerceCatalog = api.fetchCommerceCatalog()
            userSummary = try await fetchedSummary
            gameHistory = try await fetchedGames
            leaderboard = try await fetchedLeaderboard
            commerceCatalog = try await fetchedCommerceCatalog
            route = .home
        } catch {
            await clearLocalSession()
            errorMessage = "登录已过期，请重新进入。"
        }
        isLoading = false
    }

    private func finishAuth(_ auth: AuthResponse) async throws {
        try KeychainTokenStore.saveToken(auth.token)
        user = auth.user
        await api.setToken(auth.token)
        route = .home
        await loadModes()
        await loadHomeData()
    }

    private func clearLocalSession() async {
        KeychainTokenStore.deleteToken()
        await api.setToken(nil)
        user = nil
        game = nil
        room = nil
        copiedInviteCode = nil
        userSummary = nil
        gameHistory = []
        leaderboard = nil
        topics = []
        clearWaitingContext()
        lastReportStatus = nil
        lastRewardStatus = nil
        route = .onboarding
    }

    private func run(showLoading: Bool = true, operation: () async throws -> Void) async {
        if let configurationError {
            errorMessage = configurationError
            return
        }
        if showLoading { isLoading = true }
        errorMessage = nil
        do {
            try await operation()
        } catch {
            await handleRunError(error)
        }
        if showLoading { isLoading = false }
    }

    private func handleRunError(_ error: Error) async {
        guard case let MirageAPIError.server(code) = error else {
            errorMessage = error.localizedDescription
            return
        }

        switch code {
        case "unauthorized", "user_not_found":
            await clearLocalSession()
            errorMessage = "登录已过期，请重新进入。"
        case "user_banned":
            await refreshBannedSession()
        default:
            errorMessage = Self.playerErrorMessage(for: code)
        }
    }

    private static func playerErrorMessage(for code: String) -> String {
        switch code {
        case "message_blocked:privacy_or_contact_info":
            return "这条内容不能发送。不要分享联系方式、地址、学校或支付信息。"
        case "message_blocked:harassment":
            return "这条内容不能发送。请围绕推理发言，不要攻击其他玩家。"
        case "message_blocked:violent_threat":
            return "这条内容不能发送。暴力威胁会被拦截并记录。"
        case "message_blocked:self_harm_risk":
            return "这条内容不能发送。如果你或他人正处于危险，请立即联系当地紧急服务或可信赖的人。"
        case "message_blocked:adult_content":
            return "这条内容不能发送。游戏房间不允许成人或性骚扰内容。"
        case "message_blocked:scam_or_spam":
            return "这条内容不能发送。不要发布广告、引流、交易或诈骗信息。"
        default:
            return code
        }
    }

    private func refreshBannedSession() async {
        do {
            user = try await api.fetchMe()
            game = nil
            room = nil
            userSummary = try await api.fetchUserSummary()
            gameHistory = try await api.fetchUserGames()
            copiedInviteCode = nil
            clearWaitingContext()
            lastReportStatus = nil
            lastRewardStatus = nil
            route = .home
            errorMessage = "账号已被限制，无法继续游戏。可在设置中查看规则、联系客服或删除账号。"
        } catch {
            await clearLocalSession()
            errorMessage = "登录已过期，请重新进入。"
        }
    }

    private func clearWaitingContext() {
        matchmakingTicketId = nil
        waitingModeId = nil
        waitingTopicId = nil
        waitingStartedAt = nil
    }
}
