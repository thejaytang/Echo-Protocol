import Foundation

struct APIEnvelope<T: Decodable>: Decodable {
    let value: T

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        value = try container.decode(T.self)
    }
}

struct AuthResponse: Decodable {
    let user: MirageUser
    let token: String
}

struct MeResponse: Decodable {
    let user: MirageUser
}

struct UserSummaryResponse: Decodable {
    let summary: UserSummary
}

struct UserGameHistoryResponse: Decodable {
    let games: [UserGameHistoryItem]
}

struct LeaderboardResponse: Decodable {
    let leaderboard: LeaderboardSummary
}

struct CommerceCatalogResponse: Decodable {
    let catalog: CommerceCatalog
}

struct MirageUser: Codable, Identifiable, Equatable {
    let id: String
    let nickname: String
    let kind: String
    let avatarKey: String?
    let deletedAt: String?
    let bannedAt: String?
    let banReason: String?
    let ageConfirmed: Bool
    let communityConfirmed: Bool
}

struct ModeListResponse: Decodable {
    let worldSetting: WorldSetting?
    let modes: [GameMode]
}

struct WorldSetting: Codable, Equatable {
    let title: String
    let tagline: String
    let background: String
}

struct TopicListResponse: Decodable {
    let topics: [GameTopic]
}

struct GameMode: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let playerCount: Int
    let aiCount: Int
    let minHumanCount: Int
    let discussionSeconds: Int
    let finalStatementSeconds: Int?
    let votingSeconds: Int
    let voteType: String
    let intro: String
    let matchType: String?
    let difficulty: Int?
    let tagline: String?
    let goal: String?
    let flow: [String]?
    let rules: [String]?
    let safety: String?
}

struct UserSummary: Codable, Equatable {
    let wallet: UserWalletSummary?
    let progression: UserProgressionSummary?
    let cosmetics: UserCosmeticSummary?
    let stats: UserSummaryStats
    let recent: RecentGameSummary?
    let missions: UserMissionSummary
    let safety: UserSafetySummary
}

struct UserWalletSummary: Codable, Equatable {
    let clueStars: Int
    let xp: Int
}

struct UserProgressionSummary: Codable, Equatable {
    let level: Int
    let title: String
    let xp: Int
    let currentLevelXp: Int
    let nextLevelXp: Int
    let progress: Double
    let nextTitle: String
}

struct UserCosmeticSummary: Codable, Equatable {
    let equippedId: String
    let equipped: UserCosmeticItem
    let items: [UserCosmeticItem]
}

struct UserCosmeticItem: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let description: String
    let cost: Int
    let rarity: String
    let accent: String
    let owned: Bool
    let equipped: Bool
    let affordable: Bool
}

struct UserSummaryStats: Codable, Equatable {
    let completedGames: Int
    let activeGames: Int
    let wins: Int
    let winRate: Double?
    let replayReady: Int
    let replayReadyRate: Double?
}

struct RecentGameSummary: Codable, Equatable {
    let gameId: String
    let modeId: String
    let topicTitle: String
    let winner: String?
    let completedAt: String
    let replayReady: Bool
}

struct UserMissionSummary: Codable, Equatable {
    let dateKey: String?
    let quickStartCompletedToday: Bool
    let replayReadyToday: Bool
    let winCompletedToday: Bool
    let items: [UserMissionItem]?
}

struct UserMissionItem: Codable, Identifiable, Equatable {
    let id: String
    let title: String
    let description: String
    let reward: MissionReward
    let progress: Int
    let target: Int
    let completed: Bool
    let claimed: Bool
    let claimable: Bool
}

struct MissionReward: Codable, Equatable {
    let clueStars: Int
    let xp: Int
}

struct UserSafetySummary: Codable, Equatable {
    let reportsSubmitted: Int
    let blocks: Int
    let banned: Bool
}

struct UserGameHistoryItem: Codable, Identifiable, Equatable {
    var id: String { gameId }
    let gameId: String
    let roomId: String?
    let modeId: String
    let topicTitle: String
    let phase: String
    let winner: String?
    let updatedAt: String
    let replayReady: Bool
    let playerCount: Int
    let humanCount: Int
    let aiCount: Int
    let myRole: String
    let voted: Bool
}

struct LeaderboardSummary: Codable, Equatable {
    let season: LeaderboardSeason
    let top: [LeaderboardRow]
    let aroundMe: [LeaderboardRow]
    let myRank: LeaderboardRow?
    let totalPlayers: Int
    let updatedAt: String
}

struct LeaderboardSeason: Codable, Equatable {
    let id: String
    let title: String
    let rule: String
}

struct LeaderboardRow: Codable, Identifiable, Equatable {
    var id: String { userId }
    let userId: String
    let nickname: String
    let level: Int
    let title: String
    let xp: Int
    let clueStars: Int
    let score: Int
    let completedGames: Int
    let wins: Int
    let winRate: Double?
    let replayReady: Int
    let isCurrentUser: Bool
    let rank: Int
}

struct CommerceCatalog: Codable, Equatable {
    let version: String
    let paymentsEnabled: Bool
    let purchaseProvider: String
    let headline: String
    let summary: String
    let fairnessGuards: [String]
    let offers: [CommerceOffer]
}

struct CommerceOffer: Codable, Identifiable, Equatable {
    let id: String
    let title: String
    let category: String
    let phase: String
    let status: String
    let priceLabel: String
    let value: String
    let fairness: String
}

struct MatchmakingResponse: Decodable {
    let status: String
    let modeId: String?
    let topicId: String?
    let ticketId: String?
    let createdAt: String?
    let game: MirageGame?
}

struct RoomResponse: Decodable {
    let room: MirageRoom
}

struct RoomStartResponse: Decodable {
    let room: MirageRoom
    let game: MirageGame
}

struct GameResponse: Decodable {
    let game: MirageGame
}

struct ReportResponse: Decodable {
    let report: MirageReport
}

struct BlockResponse: Decodable {
    let block: MirageBlock
}

struct MirageRoom: Codable, Identifiable, Equatable {
    let id: String
    let inviteCode: String
    let modeId: String
    let topicId: String?
    let hostUserId: String?
    let allowAiFill: Bool
    let status: String
    let players: [GamePlayer]
    let createdAt: String
    let gameId: String?
}

struct MirageGame: Codable, Identifiable, Equatable {
    let id: String
    let roomId: String?
    let rematchRoomId: String?
    let modeId: String
    let topic: GameTopic
    let phase: String
    let phaseEndsAt: String?
    let winner: String?
    let players: [GamePlayer]
    let messages: [GameMessage]
    let votes: [GameVote]
    let myVote: GameVote?
    let taskCard: TaskCardState?
    let voteState: VoteState?
    let finalStatement: FinalStatementState?
    let replay: GameReplay?
}

struct TaskCardState: Codable, Equatable {
    let acknowledged: Bool
    let acknowledgedCount: Int
    let total: Int
}

struct VoteState: Codable, Equatable {
    let submitted: Bool
    let submittedCount: Int
    let remaining: Int
    let total: Int
}

struct FinalStatementState: Codable, Equatable {
    let submitted: Bool
    let remaining: Int
}

struct GameTopic: Codable, Identifiable, Equatable {
    let id: String
    let title: String
    let category: String
    let risk: String
    let modeIds: [String]?
    let enabled: Bool?
}

struct GamePlayer: Codable, Identifiable, Equatable {
    let id: String
    let userId: String?
    let nickname: String
    let kind: String
    let role: String
    let hiddenTask: String?
    let ready: Bool
}

struct GameMessage: Codable, Identifiable, Equatable {
    let id: String
    let senderKind: String
    let senderPlayerId: String?
    let text: String
    let createdAt: String
    let status: String
    let strategyTag: String?
    let reactionType: String?
}

struct GameVote: Codable, Identifiable, Equatable {
    let id: String
    let userId: String
    let voterPlayerId: String
    let targetPlayerId: String
    let createdAt: String
}

struct GameReplay: Codable, Equatable {
    let id: String
    let gameId: String
    let status: String
    let winner: String?
    let aiPlayerId: String?
    let aiGoal: String?
    let aiPlayerIds: [String]?
    let aiGoals: [AiGoal]?
    let identitySummary: [IdentitySummary]
    let voteSummary: [GameVote]
    let taskResults: [GameTaskResult]?
    let keyMessages: [ReplayMessage]
    let explanation: String
}

struct GameTaskResult: Codable, Equatable {
    let playerId: String
    let userId: String?
    let role: String
    let title: String
    let goal: String
    let completed: Bool
    let status: String
    let summary: String
}

struct AiGoal: Codable, Equatable {
    let playerId: String
    let goal: String?
}

struct IdentitySummary: Codable, Equatable {
    let playerId: String
    let nickname: String
    let role: String
}

struct ReplayMessage: Codable, Identifiable, Equatable {
    var id: String { messageId }
    let messageId: String
    let senderPlayerId: String?
    let text: String
    let strategyTag: String?
}

struct MirageReport: Codable, Identifiable, Equatable {
    let id: String
    let reporterUserId: String
    let targetUserId: String?
    let roomId: String?
    let gameId: String?
    let messageId: String?
    let reason: String
    let status: String
    let action: String?
}

struct MirageBlock: Codable, Identifiable, Equatable {
    let id: String
    let sourceUserId: String
    let targetUserId: String
    let createdAt: String
}

struct EmptyResponse: Decodable {}
