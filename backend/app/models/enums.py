"""領域列舉型別（對應 SDS §7.2 DDL 的 PostgreSQL ENUM）。"""

from __future__ import annotations

from enum import StrEnum


class UserRole(StrEnum):
    """users.role"""

    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
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
