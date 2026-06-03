-- Seed data for local development and testing

INSERT INTO applications (
  company, role, jd_url, jd_text, location, ats_type,
  match_score, match_justification, missing_skills, matched_skills, status
) VALUES
(
  'Anthropic',
  'AI Research Engineer',
  'https://boards.greenhouse.io/anthropic/jobs/1001',
  'We are looking for an AI Research Engineer to join our team. You will work on large language models, RLHF pipelines, and safety research. Requirements: Python, PyTorch, transformer architectures, research experience.',
  'San Francisco, CA (Remote OK)',
  'greenhouse',
  85,
  '• Strong Python/PyTorch match\n• LLM experience aligns well\n• Missing RLHF-specific experience',
  ARRAY['RLHF', 'Constitutional AI'],
  ARRAY['Python', 'PyTorch', 'LLMs', 'Transformers'],
  'matched'
),
(
  'Cohere',
  'ML Engineer',
  'https://jobs.lever.co/cohere/ml-engineer-001',
  'Join Cohere to build enterprise NLP solutions. Work with large language models, fine-tuning pipelines, and production ML systems. Requirements: Python, TensorFlow or PyTorch, MLOps, Docker, Kubernetes.',
  'Toronto, Canada (Remote)',
  'lever',
  72,
  '• Good ML fundamentals match\n• Missing Kubernetes experience\n• Strong Python background',
  ARRAY['Kubernetes', 'Enterprise NLP'],
  ARRAY['Python', 'PyTorch', 'MLOps', 'Docker'],
  'matched'
),
(
  'Scale AI',
  'GenAI Product Engineer',
  'https://boards.greenhouse.io/scaleai/jobs/2001',
  'Scale AI is hiring a GenAI Product Engineer to build data annotation tools powered by LLMs. Requirements: TypeScript, React, Python, LangChain, OpenAI API, full-stack development.',
  'San Francisco, CA',
  'greenhouse',
  61,
  '• TypeScript/React skills match\n• LLM API experience relevant\n• Limited data annotation domain experience',
  ARRAY['Data Annotation Systems', 'LangChain'],
  ARRAY['TypeScript', 'Python', 'React', 'OpenAI API'],
  'approved'
),
(
  'Hugging Face',
  'MLOps Engineer',
  'https://apply.workable.com/huggingface/mlops-001',
  'Hugging Face is looking for an MLOps Engineer to manage model deployment infrastructure. Requirements: Python, Docker, Kubernetes, CI/CD, model serving (Triton or TorchServe), cloud platforms (AWS/GCP).',
  'Remote',
  'custom',
  55,
  '• Python experience matches\n• Missing Kubernetes/Triton experience\n• Cloud experience partially matching',
  ARRAY['Kubernetes', 'Triton', 'Model Serving'],
  ARRAY['Python', 'Docker', 'CI/CD', 'AWS'],
  'matched'
),
(
  'Mistral AI',
  'Research Scientist - LLMs',
  'https://jobs.lever.co/mistral/research-scientist-001',
  'Mistral AI is seeking a Research Scientist specializing in large language models. You will work on pre-training, fine-tuning, and evaluation of frontier models. PhD preferred. Requirements: Deep learning theory, PyTorch, distributed training.',
  'Paris, France (Hybrid)',
  'lever',
  78,
  '• Strong LLM knowledge\n• PyTorch proficiency matches\n• No PhD — partially mitigated by project experience',
  ARRAY['PhD', 'Distributed Training', 'Pre-training at Scale'],
  ARRAY['PyTorch', 'LLMs', 'Fine-tuning', 'Deep Learning'],
  'applied'
);

-- Sample communication log
INSERT INTO communication_logs (
  application_id,
  email_subject,
  email_snippet,
  classification,
  gmail_message_id,
  telegram_sent
)
SELECT
  id,
  'Interview Invitation - AI Research Engineer at Anthropic',
  'Hi, we reviewed your application and would like to schedule a technical interview...',
  'interview_invite',
  'gmail_msg_001',
  true
FROM applications WHERE company = 'Anthropic';
