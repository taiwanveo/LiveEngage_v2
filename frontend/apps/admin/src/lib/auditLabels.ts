/** 稽核記錄動作／目標類型的中文標籤（篩選與列表顯示）。 */

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // 組織與成員
  update_organization: "更新組織資料",
  update_branding: "更新品牌設定",
  invite_member: "邀請成員",
  update_member: "更新成員",
  update_member_role: "更新成員角色",
  remove_member: "移除成員",
  admin_update_session_status: "更新活動狀態",
  create_export: "建立匯出",
  // 整合
  "integration.webhook.create": "建立 Webhook",
  "integration.webhook.delete": "刪除 Webhook",
  // 協同主持
  "cohost.invite": "邀請協同主持",
  "cohost.update_permissions": "更新協同主持權限",
  "cohost.revoke": "撤銷協同主持",
  // Poll
  "poll.start": "啟動 Poll",
  "poll.stop": "停止 Poll",
  "poll.lock": "鎖定 Poll",
  "poll.unlock": "解鎖 Poll",
  "poll.reveal": "公開 Poll 結果",
  "poll.hide": "隱藏 Poll 結果",
  "poll.reset": "重設 Poll",
  // Quiz
  "quiz.add_question": "新增 Quiz 題目",
  "quiz.start_question": "開始 Quiz 題目",
  "quiz.reveal": "公布 Quiz 答案",
  "quiz.next": "Quiz 下一題",
  "quiz.close": "關閉 Quiz 題目",
  // Q&A
  "question.approve": "核准問題",
  "question.dismiss": "駁回問題",
  "question.archive": "封存問題",
  "question.restore": "還原問題",
  "question.answer": "標為已答",
  "question.unanswer": "取消已答",
  "question.unapprove": "取消核准",
  "question.highlight": "標記問題",
  "question.unhighlight": "取消標記",
  "question.reply": "回覆問題",
  // 點子牆／問卷
  "ideas.hide": "隱藏點子",
  "survey.add_question": "新增問卷題目",
};

export const AUDIT_TARGET_TYPE_LABELS: Record<string, string> = {
  organization: "組織",
  user: "使用者",
  session: "活動",
  export_job: "匯出任務",
  webhook: "Webhook",
  cohost: "協同主持",
  interaction: "互動（Poll）",
  quiz_question: "Quiz 題目",
  question: "Q&A 問題",
  idea: "點子",
  survey_question: "問卷題目",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function auditTargetTypeLabel(targetType: string): string {
  return AUDIT_TARGET_TYPE_LABELS[targetType] ?? targetType;
}

function toSortedOptions(labels: Record<string, string>): { value: string; label: string }[] {
  return Object.entries(labels)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));
}

export const AUDIT_ACTION_OPTIONS = toSortedOptions(AUDIT_ACTION_LABELS);
export const AUDIT_TARGET_TYPE_OPTIONS = toSortedOptions(AUDIT_TARGET_TYPE_LABELS);
