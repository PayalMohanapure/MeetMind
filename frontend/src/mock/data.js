/* Seed data for the in-browser demo backend. Times are relative to "now" so the demo always looks fresh. */

export const PEOPLE = {
  asha: { id: 'u-asha', full_name: 'Asha Kulkarni', username: 'asha', email: 'asha@example.com' },
  rahul: { id: 'u-rahul', full_name: 'Rahul Deshmukh', username: 'rahul', email: 'rahul@example.com' },
  priya: { id: 'u-priya', full_name: 'Priya Nair', username: 'priya', email: 'priya@example.com' },
  meera: { id: 'u-meera', full_name: 'Meera Joshi', username: 'meera', email: 'meera@example.com' },
};

const seg = (start, who, text, dur = 20) => ({ start, end: start + dur, speaker_id: PEOPLE[who].id, speaker_name: PEOPLE[who].full_name, text });

export const LAUNCH_TRANSCRIPT = [
  seg(5, 'asha', "Morning everyone. Let's keep this tight: launch date, pricing, then next steps.", 18),
  seg(28, 'rahul', 'Sounds good. I have the beta numbers from last week if we need them.', 14),
  seg(46, 'priya', 'I also want five minutes on Hindi support at the end, if we can.', 12),
  seg(70, 'asha', "Noted. So, launch date. Engineering says the feature freeze can happen this Friday.", 22),
  seg(118, 'rahul', 'If the freeze is Friday, we need at least a week of bug bash before going public.', 20),
  seg(150, 'priya', 'Marketing needs ten days for the announcement post and the demo video.', 18),
  seg(180, 'asha', 'Then the launch date is the tenth of November. Everyone agrees? Good, that is decided.', 22),
  seg(214, 'rahul', 'Tenth works. I will block the release train for that week.', 12),
  seg(300, 'priya', 'Quick one on the landing page: do we show the assistant or the transcript first?', 18),
  seg(330, 'asha', 'Assistant first. The citation link is the thing people remember.', 14),
  seg(420, 'rahul', 'For pricing I suggest a free tier with five meetings a month and a pro plan at nine dollars.', 24),
  seg(452, 'priya', 'Students should get pro for free. Campus is where we will grow fastest.', 18),
  seg(480, 'asha', 'Agreed. Pro at nine dollars a month, free for students with a college email.', 20),
  seg(520, 'rahul', 'Do we cap the assistant for free users?', 10),
  seg(540, 'asha', "Let's leave that open and look at real usage after a month.", 14),
  seg(640, 'priya', 'Payment gateway fees in India are still unclear for the student plan.', 18),
  seg(700, 'asha', 'Priya, can you check the payment gateway fees before the sixteenth?', 16),
  seg(722, 'priya', 'Yes, I will check payment gateway fees in India and share a sheet.', 14),
  seg(755, 'rahul', 'I will send the release notes draft to everyone by Friday.', 14),
  seg(790, 'asha', 'Perfect. And someone should book the launch-day demo slot with the community team.', 18),
  seg(1100, 'priya', 'On Hindi support: transcription quality is good, but the minutes still come out in English.', 22),
  seg(1140, 'asha', 'Then minutes in Hindi is a post-launch item. Captions stay English for now.', 18),
  seg(1180, 'rahul', 'I can prototype Hindi minutes in the second sprint after launch.', 14),
  seg(1830, 'asha', "Great. That's everything. Thanks all, see you Friday.", 12),
];

export const LAUNCH_SUMMARY = {
  summary: 'The team set the beta launch for 10 November after a feature freeze this Friday, and agreed pricing: Pro at $9 a month, free for students. Hindi minutes move to after launch.',
  decisions: [
    { text: 'Launch date is 10 November', start: 180 },
    { text: 'Pro plan at $9 a month, free for students with a college email', start: 480 },
    { text: 'Landing page leads with the assistant and its citations', start: 330 },
    { text: 'Minutes in Hindi are a post-launch item', start: 1140 },
  ],
  open_questions: [
    { text: 'Should the assistant be capped for free users?', start: 520 },
    { text: 'What are payment gateway fees in India for the student plan?', start: 640 },
  ],
  chapters: [
    { title: 'Intro', start: 0 },
    { title: 'Launch date', start: 60 },
    { title: 'Pricing', start: 400 },
    { title: 'Next steps', start: 690 },
    { title: 'Hindi support', start: 1090 },
  ],
};

export const SPRINT_TRANSCRIPT = [
  seg(4, 'asha', 'Welcome to the sprint review. Rahul, want to start with the retrieval work?', 14),
  seg(22, 'rahul', 'Sure. Hybrid search is live: keyword plus vector, with a reranker on top.', 22),
  seg(60, 'rahul', 'Answer accuracy on our test questions went from 71 to 86 percent.', 16),
  seg(90, 'asha', "That's a big jump. What's still failing?", 10),
  seg(104, 'rahul', 'Questions about dates. People say next Friday and the model guesses the wrong week.', 20),
  seg(140, 'asha', 'Then we need a retrieval evaluation set with date questions before the next sprint.', 18),
  seg(170, 'rahul', 'I will write the retrieval evaluation set by Friday the twenty-third.', 14),
  seg(420, 'asha', 'Captions next. Latency is under a second on Chrome, which is good enough to ship.', 18),
  seg(600, 'rahul', 'Last thing: uploads now retry from IndexedDB if the tab closes mid-call.', 18),
  seg(1180, 'asha', 'Great sprint. Demo this on Friday.', 10),
];
export const SPRINT_SUMMARY = {
  summary: 'Hybrid retrieval raised answer accuracy from 71% to 86%. Date questions still fail, so the team will build an evaluation set. Captions ship; uploads now survive closed tabs.',
  decisions: [{ text: 'Ship live captions on Chrome', start: 420 }, { text: 'Build a retrieval evaluation set with date questions', start: 140 }],
  open_questions: [{ text: 'How should relative dates like "next Friday" be resolved?', start: 104 }],
  chapters: [{ title: 'Retrieval', start: 0 }, { title: 'Captions', start: 400 }, { title: 'Uploads', start: 590 }, { title: 'Wrap-up', start: 1100 }],
};

export const HIRING_TRANSCRIPT = [
  seg(6, 'meera', 'Thanks for joining. Two candidates today for the frontend role.', 14),
  seg(30, 'asha', 'The first one was strong on accessibility; the take-home had proper focus handling.', 20),
  seg(80, 'meera', 'The second had the better system design answer but weaker React.', 16),
  seg(140, 'asha', "Let's move the first candidate to the final round.", 12),
  seg(170, 'meera', 'I will send the final-round invite by Wednesday.', 12),
  seg(1500, 'asha', "Good. That's it from me.", 8),
];
export const HIRING_SUMMARY = {
  summary: 'The panel moves the first frontend candidate to the final round for strong accessibility work; Meera sends the invite by Wednesday.',
  decisions: [{ text: 'First candidate moves to the final round', start: 140 }],
  open_questions: [],
  chapters: [{ title: 'Candidate one', start: 0 }, { title: 'Candidate two', start: 75 }, { title: 'Decision', start: 135 }],
};

const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
const ahead = (min) => new Date(Date.now() + min * 60_000).toISOString();
const daysAgoAt = (d, h, m = 0) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, m, 0, 0); return x.toISOString(); };

export function seedMeetings(meId) {
  const P = PEOPLE;
  const ppl = (...k) => k.map((x) => ({ user_id: P[x].id, full_name: P[x].full_name }));
  const me = { user_id: meId, full_name: null };
  return [
    { code: 'abc-defg-hij', title: 'Daily standup', status: 'live', record: true, host_id: P.asha.id, created_at: ago(12), started_at: ago(9), ended_at: null, duration_seconds: 540, processing_status: 'none', participants: ppl('asha', 'rahul'), live_count: 4 },
    { code: 'spr-revw-oct', title: 'Sprint review', status: 'ended', record: true, host_id: meId, created_at: daysAgoAt(2, 16), started_at: daysAgoAt(2, 16), ended_at: daysAgoAt(2, 16, 20), duration_seconds: 1200, processing_status: 'ready', participants: [...ppl('asha', 'rahul'), me] },
    { code: 'lpn-octx-ten', title: 'Launch planning', status: 'ended', record: true, host_id: P.asha.id, created_at: daysAgoAt(4, 10), started_at: daysAgoAt(4, 10), ended_at: daysAgoAt(4, 10, 32), duration_seconds: 1920, processing_status: 'ready', participants: [...ppl('asha', 'rahul', 'priya'), me] },
    { code: 'dsn-sync-thu', title: 'Design sync', status: 'ended', record: true, host_id: meId, created_at: daysAgoAt(3, 14), started_at: daysAgoAt(3, 14), ended_at: daysAgoAt(3, 14, 25), duration_seconds: 1500, processing_status: 'failed', processing_error: 'The recording upload from one participant was incomplete.', participants: [...ppl('rahul', 'priya'), me] },
    { code: 'hir-loop-dbf', title: 'Hiring loop debrief', status: 'ended', record: true, host_id: P.meera.id, created_at: daysAgoAt(8, 17), started_at: daysAgoAt(8, 17), ended_at: daysAgoAt(8, 17, 26), duration_seconds: 1560, processing_status: 'ready', participants: [...ppl('meera', 'asha'), me] },
    { code: 'cst-intv-nxt', title: 'Customer interview: campus pilot', status: 'scheduled', record: true, host_id: meId, created_at: ago(600), scheduled_at: ahead(60 * 20), started_at: null, ended_at: null, duration_seconds: 0, processing_status: 'none', participants: [...ppl('priya'), me] },
  ];
}

export function seedTranscripts() {
  return { 'lpn-octx-ten': LAUNCH_TRANSCRIPT, 'spr-revw-oct': SPRINT_TRANSCRIPT, 'hir-loop-dbf': HIRING_TRANSCRIPT };
}
export function seedSummaries() {
  return { 'lpn-octx-ten': LAUNCH_SUMMARY, 'spr-revw-oct': SPRINT_SUMMARY, 'hir-loop-dbf': HIRING_SUMMARY };
}

export function seedActionItems(meId) {
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  return [
    { id: 'ai-1', title: 'Check payment gateway fees in India', status: 'open', due_date: d(-2), assignee_id: meId, assignee_name: 'You', meeting_code: 'lpn-octx-ten', meeting_title: 'Launch planning', source: 'ai', heard_at: 722 },
    { id: 'ai-2', title: 'Book the launch-day demo slot', status: 'open', due_date: null, assignee_id: meId, assignee_name: 'You', meeting_code: 'lpn-octx-ten', meeting_title: 'Launch planning', source: 'ai', heard_at: 790 },
    { id: 'ai-3', title: 'Write the retrieval evaluation set', status: 'open', due_date: d(5), assignee_id: meId, assignee_name: 'You', meeting_code: 'spr-revw-oct', meeting_title: 'Sprint review', source: 'ai', heard_at: 170 },
    { id: 'ai-4', title: 'Send the release notes draft', status: 'open', due_date: d(1), assignee_id: PEOPLE.rahul.id, assignee_name: 'Rahul', meeting_code: 'lpn-octx-ten', meeting_title: 'Launch planning', source: 'ai', heard_at: 755 },
    { id: 'ai-5', title: 'Send the final-round invite', status: 'done', due_date: d(-6), assignee_id: PEOPLE.meera.id, assignee_name: 'Meera', meeting_code: 'hir-loop-dbf', meeting_title: 'Hiring loop debrief', source: 'ai', heard_at: 170 },
    { id: 'ai-6', title: 'Prototype Hindi minutes', status: 'open', due_date: d(24), assignee_id: PEOPLE.rahul.id, assignee_name: 'Rahul', meeting_code: 'lpn-octx-ten', meeting_title: 'Launch planning', source: 'ai', heard_at: 1180 },
  ];
}

export const GENERIC_LINES = [
  "Let's get started. Quick round of updates first.",
  'I finished the onboarding flow; it is ready for review.',
  'The API latency looks better after the caching change.',
  'Can we decide on the release date today?',
  "Let's ship it on Thursday, with a short demo for the team.",
  'I will write up the notes for the support team.',
  'Any blockers? None from my side.',
  "Great, that's everything. Thanks, everyone.",
];
