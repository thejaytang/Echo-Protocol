import Foundation

enum MirageAPIError: LocalizedError {
    case invalidBaseURL
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidBaseURL:
            "API 地址无效。"
        case .invalidResponse:
            "服务端响应无效。"
        case .server(let message):
            message
        }
    }
}

actor MirageAPIClient {
    private let baseURL: URL
    private var token: String?
    private let session: URLSession

    init(baseURL: URL, token: String? = nil, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.token = token
        self.session = session
    }

    func setToken(_ token: String?) {
        self.token = token
    }

    func signInAsGuest(nickname: String, ageConfirmed: Bool, communityConfirmed: Bool) async throws -> AuthResponse {
        try await request(
            "POST",
            "/auth/guest",
            body: NicknameBody(nickname: nickname, ageConfirmed: ageConfirmed, communityConfirmed: communityConfirmed)
        )
    }

    func signInWithApple(
        identityToken: String,
        authorizationCode: String?,
        nickname: String?,
        ageConfirmed: Bool,
        communityConfirmed: Bool
    ) async throws -> AuthResponse {
        try await request(
            "POST",
            "/auth/apple",
            body: AppleAuthBody(
                identityToken: identityToken,
                authorizationCode: authorizationCode,
                nickname: nickname,
                ageConfirmed: ageConfirmed,
                communityConfirmed: communityConfirmed
            )
        )
    }

    func signInWithGoogle(
        identityToken: String,
        nickname: String?,
        ageConfirmed: Bool,
        communityConfirmed: Bool
    ) async throws -> AuthResponse {
        try await request(
            "POST",
            "/auth/google",
            body: GoogleAuthBody(
                identityToken: identityToken,
                nickname: nickname,
                ageConfirmed: ageConfirmed,
                communityConfirmed: communityConfirmed
            )
        )
    }

    func signInWithWeChat(
        code: String,
        nickname: String?,
        ageConfirmed: Bool,
        communityConfirmed: Bool
    ) async throws -> AuthResponse {
        try await request(
            "POST",
            "/auth/wechat",
            body: WeChatAuthBody(
                code: code,
                nickname: nickname,
                ageConfirmed: ageConfirmed,
                communityConfirmed: communityConfirmed
            )
        )
    }

    func deleteAccount() async throws -> AuthResponse.UserDeletion {
        try await request("DELETE", "/account", body: Optional<String>.none)
    }

    func fetchMe() async throws -> MirageUser {
        let response: MeResponse = try await request("GET", "/me", body: Optional<String>.none)
        return response.user
    }

    func fetchUserSummary() async throws -> UserSummary {
        let response: UserSummaryResponse = try await request("GET", "/me/summary", body: Optional<String>.none)
        return response.summary
    }

    func fetchUserGames() async throws -> [UserGameHistoryItem] {
        let response: UserGameHistoryResponse = try await request("GET", "/me/games", body: Optional<String>.none)
        return response.games
    }

    func fetchLeaderboard() async throws -> LeaderboardSummary {
        let response: LeaderboardResponse = try await request("GET", "/leaderboard", body: Optional<String>.none)
        return response.leaderboard
    }

    func fetchCommerceCatalog() async throws -> CommerceCatalog {
        let response: CommerceCatalogResponse = try await request("GET", "/commerce/catalog", body: Optional<String>.none)
        return response.catalog
    }

    func claimMissionReward(missionId: String) async throws -> UserSummary {
        let response: UserSummaryResponse = try await request("POST", "/me/missions/\(missionId)/claim", body: Optional<String>.none)
        return response.summary
    }

    func claimAllMissionRewards() async throws -> UserSummary {
        let response: UserSummaryResponse = try await request("POST", "/me/missions/claim-all", body: Optional<String>.none)
        return response.summary
    }

    func unlockCosmetic(itemId: String) async throws -> UserSummary {
        let response: UserSummaryResponse = try await request("POST", "/me/cosmetics/\(itemId)/unlock", body: Optional<String>.none)
        return response.summary
    }

    func equipCosmetic(itemId: String) async throws -> UserSummary {
        let response: UserSummaryResponse = try await request("POST", "/me/cosmetics/\(itemId)/equip", body: Optional<String>.none)
        return response.summary
    }

    func fetchModes() async throws -> ModeListResponse {
        try await request("GET", "/modes", body: Optional<String>.none)
    }

    func fetchTopics() async throws -> [GameTopic] {
        let response: TopicListResponse = try await request("GET", "/topics", body: Optional<String>.none)
        return response.topics
    }

    func startMatchmaking(modeId: String, topicId: String?) async throws -> MatchmakingResponse {
        try await request("POST", "/matchmaking/start", body: ModeBody(modeId: modeId, topicId: topicId))
    }

    func quickStart(modeId: String, topicId: String?) async throws -> MatchmakingResponse {
        try await request("POST", "/quick-start", body: ModeBody(modeId: modeId, topicId: topicId))
    }

    func fetchMatchmakingStatus(ticketId: String) async throws -> MatchmakingResponse {
        try await request("GET", "/matchmaking/\(ticketId)", body: Optional<String>.none)
    }

    func cancelMatchmaking(ticketId: String) async throws -> MatchmakingResponse {
        try await request("DELETE", "/matchmaking/\(ticketId)", body: Optional<String>.none)
    }

    func createRoom(modeId: String, topicId: String?) async throws -> MirageRoom {
        let response: RoomResponse = try await request("POST", "/rooms", body: CreateRoomBody(modeId: modeId, topicId: topicId, allowAiFill: true))
        return response.room
    }

    func joinRoom(inviteCode: String) async throws -> MirageRoom {
        let response: RoomResponse = try await request("POST", "/rooms/join", body: InviteBody(inviteCode: inviteCode))
        return response.room
    }

    func fetchRoom(roomId: String) async throws -> MirageRoom {
        let response: RoomResponse = try await request("GET", "/rooms/\(roomId)", body: Optional<String>.none)
        return response.room
    }

    func leaveRoom(roomId: String) async throws -> MirageRoom {
        let response: RoomResponse = try await request("DELETE", "/rooms/\(roomId)", body: Optional<String>.none)
        return response.room
    }

    func setReady(roomId: String, ready: Bool) async throws -> MirageRoom {
        let response: RoomResponse = try await request("POST", "/rooms/\(roomId)/ready", body: ReadyBody(ready: ready))
        return response.room
    }

    func setRoomTopic(roomId: String, topicId: String) async throws -> MirageRoom {
        let response: RoomResponse = try await request("POST", "/rooms/\(roomId)/topic", body: TopicBody(topicId: topicId))
        return response.room
    }

    func startRoom(roomId: String) async throws -> RoomStartResponse {
        try await request("POST", "/rooms/\(roomId)/start", body: Optional<String>.none)
    }

    func rematchRoom(roomId: String) async throws -> MirageRoom {
        let response: RoomResponse = try await request("POST", "/rooms/\(roomId)/rematch", body: Optional<String>.none)
        return response.room
    }

    func fetchGame(gameId: String) async throws -> MirageGame {
        let response: GameResponse = try await request("GET", "/games/\(gameId)", body: Optional<String>.none)
        return response.game
    }

    func viewReplay(gameId: String) async throws -> MirageGame {
        let response: GameResponse = try await request("POST", "/games/\(gameId)/replay", body: Optional<String>.none)
        return response.game
    }

    func acknowledgeTaskCard(gameId: String) async throws -> MirageGame {
        let response: GameResponse = try await request("POST", "/games/\(gameId)/task-card", body: Optional<String>.none)
        return response.game
    }

    func sendMessage(gameId: String, text: String) async throws -> MirageGame {
        let response: GameResponse = try await request("POST", "/games/\(gameId)/messages", body: MessageBody(text: text))
        return response.game
    }

    func toggleMessageClue(gameId: String, messageId: String) async throws -> MirageGame {
        let response: GameResponse = try await request("POST", "/games/\(gameId)/reactions", body: ReactionBody(messageId: messageId, type: "clue"))
        return response.game
    }

    func vote(gameId: String, targetPlayerId: String) async throws -> MirageGame {
        let response: GameResponse = try await request("POST", "/games/\(gameId)/votes", body: VoteBody(targetPlayerId: targetPlayerId))
        return response.game
    }

    func report(gameId: String?, roomId: String?, messageId: String?, targetUserId: String?, reason: String, block: Bool) async throws -> MirageReport {
        let response: ReportResponse = try await request(
            "POST",
            "/reports",
            body: ReportBody(gameId: gameId, roomId: roomId, messageId: messageId, targetUserId: targetUserId, reason: reason, block: block)
        )
        return response.report
    }

    func blockUser(targetUserId: String) async throws -> MirageBlock {
        let response: BlockResponse = try await request("POST", "/blocks", body: BlockBody(targetUserId: targetUserId))
        return response.block
    }

    private func request<T: Decodable, Body: Encodable>(_ method: String, _ path: String, body: Body?) async throws -> T {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw MirageAPIError.invalidBaseURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw MirageAPIError.invalidResponse
        }
        if (200..<300).contains(http.statusCode) {
            if T.self == EmptyResponse.self, data.isEmpty {
                return EmptyResponse() as! T
            }
            return try JSONDecoder().decode(T.self, from: data)
        }
        if let error = try? JSONDecoder().decode(ServerError.self, from: data) {
            throw MirageAPIError.server(error.error)
        }
        throw MirageAPIError.server("HTTP \(http.statusCode)")
    }
}

private struct ServerError: Decodable {
    let error: String
}

private struct NicknameBody: Encodable {
    let nickname: String
    let ageConfirmed: Bool
    let communityConfirmed: Bool
}

private struct AppleAuthBody: Encodable {
    let identityToken: String
    let authorizationCode: String?
    let nickname: String?
    let ageConfirmed: Bool
    let communityConfirmed: Bool
}

private struct GoogleAuthBody: Encodable {
    let identityToken: String
    let nickname: String?
    let ageConfirmed: Bool
    let communityConfirmed: Bool
}

private struct WeChatAuthBody: Encodable {
    let code: String
    let nickname: String?
    let ageConfirmed: Bool
    let communityConfirmed: Bool
}

private struct ModeBody: Encodable {
    let modeId: String
    let topicId: String?
}

private struct CreateRoomBody: Encodable {
    let modeId: String
    let topicId: String?
    let allowAiFill: Bool
}

private struct TopicBody: Encodable {
    let topicId: String
}

private struct InviteBody: Encodable {
    let inviteCode: String
}

private struct ReadyBody: Encodable {
    let ready: Bool
}

private struct MessageBody: Encodable {
    let text: String
}

private struct ReactionBody: Encodable {
    let messageId: String
    let type: String
}

private struct VoteBody: Encodable {
    let targetPlayerId: String
}

private struct ReportBody: Encodable {
    let gameId: String?
    let roomId: String?
    let messageId: String?
    let targetUserId: String?
    let reason: String
    let block: Bool
}

private struct BlockBody: Encodable {
    let targetUserId: String
}

extension AuthResponse {
    struct UserDeletion: Decodable {
        let user: MirageUser
    }
}
