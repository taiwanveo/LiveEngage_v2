/** 系統通知 Modal：成功／失敗／提示，點擊遮罩或關閉鈕可關閉。 */

import * as React from "react";
import { useCallback, useState } from "react";
import { Modal } from "./Modal";

export type NoticeTone = "success" | "error" | "info";

export interface SystemNotice {
  title: string;
  message: string;
  tone: NoticeTone;
}

const TONE_CLASS: Record<NoticeTone, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-foreground",
};

export function SystemNoticeModal({
  notice,
  onClose,
}: {
  notice: SystemNotice;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <Modal open onClose={onClose} title={notice.title} size="sm">
      <p className={`text-sm ${TONE_CLASS[notice.tone]}`}>{notice.message}</p>
    </Modal>
  );
}

export function useSystemNotice(): {
  showError: (message: string, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  closeNotice: () => void;
  systemNoticeModal: React.JSX.Element | null;
} {
  const [notice, setNotice] = useState<SystemNotice | null>(null);

  const closeNotice = useCallback(() => setNotice(null), []);

  const showError = useCallback((message: string, title = "操作失敗") => {
    setNotice({ title, message, tone: "error" });
  }, []);

  const showSuccess = useCallback((message: string, title = "操作成功") => {
    setNotice({ title, message, tone: "success" });
  }, []);

  const showInfo = useCallback((message: string, title = "提示") => {
    setNotice({ title, message, tone: "info" });
  }, []);

  const systemNoticeModal = notice ? (
    <SystemNoticeModal notice={notice} onClose={closeNotice} />
  ) : null;

  return { showError, showSuccess, showInfo, closeNotice, systemNoticeModal };
}
