/** Participant token 與 session 上下文（localStorage）。 */

const TOKEN_KEY = "le.participant.token";
const SESSION_KEY = "le.participant.session";
const ROOM_KEY = "le.participant.room";
const CODE_KEY = "le.participant.code";
const NAME_KEY = "le.participant.display_name";

export interface ParticipantContext {
  participantToken: string;
  sessionId: string;
  roomId: string;
  sessionCode: string | null;
  displayName: string | null;
}

export function getParticipantToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getParticipantContext(): ParticipantContext | null {
  const participantToken = getParticipantToken();
  const sessionId = localStorage.getItem(SESSION_KEY);
  const roomId = localStorage.getItem(ROOM_KEY);
  if (!participantToken || !sessionId || !roomId) return null;
  return {
    participantToken,
    sessionId,
    roomId,
    sessionCode: localStorage.getItem(CODE_KEY),
    displayName: localStorage.getItem(NAME_KEY),
  };
}

export function setParticipantSession(payload: {
  participantToken: string;
  sessionId: string;
  roomId: string;
  sessionCode?: string;
  displayName?: string | null;
}): void {
  localStorage.setItem(TOKEN_KEY, payload.participantToken);
  localStorage.setItem(SESSION_KEY, payload.sessionId);
  localStorage.setItem(ROOM_KEY, payload.roomId);
  if (payload.sessionCode) {
    localStorage.setItem(CODE_KEY, payload.sessionCode);
  }
  if (payload.displayName) {
    localStorage.setItem(NAME_KEY, payload.displayName);
  } else {
    localStorage.removeItem(NAME_KEY);
  }
}

export function clearParticipantSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ROOM_KEY);
  localStorage.removeItem(CODE_KEY);
  localStorage.removeItem(NAME_KEY);
}
