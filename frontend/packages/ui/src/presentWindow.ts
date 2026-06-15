/** 投影頁一律另開新視窗（主持人筆電保留控場畫面）。 */

export function openPresentWindow(href: string): void {
  window.open(href, "_blank", "noopener,noreferrer");
}
