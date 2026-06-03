import { generateWithRetry } from '../lib/gemini';

export type EmailClassification =
  | 'interview_invite'
  | 'test_assignment'
  | 'screening_call'
  | 'rejection'
  | 'follow_up'
  | 'marketing_spam';

const VALID_CLASSES: EmailClassification[] = [
  'interview_invite', 'test_assignment', 'screening_call',
  'rejection', 'follow_up', 'marketing_spam',
];

export async function classifyEmail(
  subject: string,
  body: string
): Promise<EmailClassification> {
  try {
    const text = await generateWithRetry(
      `Classify this recruiter email. Return ONLY one of these exact strings with no explanation:
interview_invite | test_assignment | screening_call | rejection | follow_up | marketing_spam

Email subject: ${subject}
Email body: ${body.slice(0, 800)}`,
      { tag: 'classifier' }
    );

    const raw = text.replace(/"/g, '').toLowerCase();

    if (VALID_CLASSES.includes(raw as EmailClassification)) {
      return raw as EmailClassification;
    }
  } catch (err) {
    console.error('[classifier] Gemini error:', err);
  }

  return 'follow_up';
}
