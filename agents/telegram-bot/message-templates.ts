export type AlertClassification =
  | 'interview_invite'
  | 'test_assignment'
  | 'screening_call'
  | 'rejection'
  | 'follow_up';

const EMOJI: Record<AlertClassification, string> = {
  interview_invite: '🎯',
  test_assignment: '📝',
  screening_call: '📞',
  rejection: '❌',
  follow_up: '🔔',
};

export function buildAlertMessage(params: {
  company: string;
  classification: string;
  email_subject: string;
}): string {
  const { company, classification, email_subject } = params;
  const emoji = EMOJI[classification as AlertClassification] ?? '📬';

  return `🚨 *Job Application Update*

*Company:* ${company}
*Type:* ${emoji} ${classification.replace(/_/g, ' ')}
*Subject:* ${email_subject}

Check your Gmail inbox now.`;
}

export function buildDailySummaryMessage(params: {
  newJobs: number;
  matched: number;
}): string {
  return `📊 *Daily Job Agent Report*

🔍 New jobs found: ${params.newJobs}
✅ Matched (score ≥ 60): ${params.matched}

Open your dashboard to approve high-scoring matches.`;
}

export function buildAppliedMessage(params: {
  company: string;
  role: string;
}): string {
  return `✅ *Application Submitted*

*Company:* ${params.company}
*Role:* ${params.role}

Good luck! 🚀`;
}
