/** Present 獨立 app 投影 URL（生產預設 Zeabur，本機可設 VITE_PRESENT_BASE）。 */

export function presentAppUrl(roomId: string, pollId: string): string {
  const meta = import.meta as ImportMeta & { env?: { VITE_PRESENT_BASE?: string } };
  const base = (meta.env?.VITE_PRESENT_BASE ?? "https://le-present.zeabur.app").replace(
    /\/$/,
    ""
  );
  return `${base}/#/rooms/${roomId}/polls/${pollId}/present`;
}
