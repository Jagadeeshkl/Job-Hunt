import fetch from 'node-fetch';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function headers() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  };
}

export async function writeSkillGapToNotion(params: {
  pageId: string;
  missingSkills: string[];
  interviewQuestions: string;
}): Promise<void> {
  const { pageId, missingSkills, interviewQuestions } = params;

  if (!missingSkills.length && !interviewQuestions) return;

  // Split questions into paragraph blocks (max 2000 chars each)
  const chunks: string[] = [];
  let current = '';
  for (const line of interviewQuestions.split('\n')) {
    if ((current + '\n' + line).length > 1900) {
      chunks.push(current.trim());
      current = line;
    } else {
      current += '\n' + line;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  const blocks = [
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: '🎯 Interview Prep — Skill Gaps' } }],
      },
    },
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: `Missing skills: ${missingSkills.join(', ')}` },
          },
        ],
      },
    },
    ...chunks.map(chunk => ({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: chunk } }],
      },
    })),
  ];

  await fetch(`${NOTION_API}/blocks/${pageId}/children`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ children: blocks }),
  });
}
