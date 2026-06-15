"""領域列舉型別（對應 SDS §7.2 DDL 的 PostgreSQL ENUM）。"""

from __future__ import annotations

from enum import StrEnum


class UserRole(StrEnum):
    """users.role

    - ``host``：主持人（原 ``member``，JWT 可能仍帶 legacy ``member``）
    - ``cohost``：助理主持人（可控場，不可編輯／刪除 Poll／Quiz 結構）
    - ``guest``：已廢止邀請，僅保留 DB 相容
    """

    OWNER = "owner"
    ADMIN = "admin"
    HOST = "host"
    MEMBER = "member"  # legacy；讀取時 normalize 為 HOST
    COHOST = "cohost"
    GUEST = "guest"


class SessionStatus(StrEnum):
    """sessions.status — 狀態機 draft→live→ended→archived。"""

    DRAFT = "draft"
    LIVE = "live"
    ENDED = "ended"
    ARCHIVED = "archived"


class SessionVisibility(StrEnum):
    """sessions.visibility"""

    PUBLIC = "public"
    HIDDEN = "hidden"
    PASSCODE = "passcode"
    SSO = "sso"
    RESTRICTED = "restricted"


class AuthMethod(StrEnum):
    """participants.auth_method"""

    NONE = "none"
    PASSCODE = "passcode"
    EMAIL = "email"
    SSO = "sso"


class InteractionType(StrEnum):
    """interactions.type — 九種互動項目。"""

    QA = "qa"
    MULTIPLE_CHOICE = "multiple_choice"
    WORD_CLOUD = "word_cloud"
    OPEN_TEXT = "open_text"
    RATING = "rating"
    RANKING = "ranking"
    QUIZ = "quiz"
    SURVEY = "survey"
    IDEAS = "ideas"


class InteractionStatus(StrEnum):
    """interactions.status — 控場狀態機 idle→active→locked⇄active→stopped。"""

    IDLE = "idle"
    ACTIVE = "active"
    LOCKED = "locked"
    STOPPED = "stopped"


class QuestionStatus(StrEnum):
    """questions.status — Q&A 狀態機（FE-004-FR9）。

    pending → approved | dismissed；approved → answered | archived；
    dismissed 為終態（Host 可還原至 pending）。
    """

    PENDING = "pending"
    APPROVED = "approved"
    DISMISSED = "dismissed"
    ANSWERED = "answered"
    ARCHIVED = "archived"


class ReplyAuthorType(StrEnum):
    """question_replies.author_type"""

    HOST = "host"
    PARTICIPANT = "participant"


class ExportFormat(StrEnum):
    """export_jobs.format"""

    CSV = "csv"
    XLSX = "xlsx"


class ExportStatus(StrEnum):
    """export_jobs.status"""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


class QuizQuestionState(StrEnum):
    """quiz_questions.state"""

    PENDING = "pending"
    ACTIVE = "active"
    REVEALED = "revealed"
    CLOSED = "closed"


class CohostStatus(StrEnum):
    """cohosts.status"""

    PENDING = "pending"
    ACCEPTED = "accepted"
    REVOKED = "revoked"


class AiFeature(StrEnum):
    """ai_request_logs.feature"""

    GENERATE_POLLS = "generate_polls"
    REWRITE = "rewrite"
    QUESTION_ASSIST = "question_assist"
    CATEGORIZE_IDEAS = "categorize_ideas"
    GENERATE_QUIZ = "generate_quiz"
