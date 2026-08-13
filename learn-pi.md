PROJECT: PI PIONEER KNOWLEDGE CENTER + OFFICIAL-SOURCE DAILY QUIZ

I want to expand the View2Earn Learn and Daily Quiz system into a structured "Pi Pioneer Knowledge Center."

The purpose is to help users understand Pi Network using accurate, educational material based primarily on official Pi Network/Core Team documentation.

IMPORTANT:
Do not create fictional Pi information.
Do not present community rumors as facts.
Do not invent Pi policies, features, dates, tokenomics, migration rules, or technical specifications.

Use official Pi Network sources as the primary source of truth.

The system must be designed so that official-source content can be updated when Pi Network changes its documentation or processes.

==================================================
1. KNOWLEDGE CENTER COURSES
==================================================

Create these 15 courses:

01. Pi Network Introduction

02. Pi Network Whitepaper

03. Pi Mining Explained

04. Pi Tokenomics

05. KYC Explained

06. Mainnet Explained

07. Mainnet Checklist

08. Pi Wallet Fundamentals

09. Wallet Passphrase Security

10. Mainnet Migration

11. First & Second Migration

12. Pi Browser

13. Pi Apps & Ecosystem

14. Pi Scams & Security

15. Official Pi Resources & How to Verify Information

Do not treat these as 15 isolated systems.

They should all use the same Course/Lesson/Question architecture.

==================================================
2. COURSE STRUCTURE
==================================================

Each course should contain:

Course
 ├── Introduction
 ├── Lessons
 ├── Key concepts
 ├── Important facts
 ├── Examples
 ├── Common mistakes
 ├── Knowledge check
 └── Daily Quiz questions

Example:

PI TOKENOMICS

Lesson 1:
What is Pi tokenomics?

Lesson 2:
Maximum supply

Lesson 3:
Community mining rewards

Lesson 4:
Foundation reserves

Lesson 5:
Liquidity allocation

Lesson 6:
Core Team allocation

Lesson 7:
Mining and issuance mechanism

Lesson 8:
Important terminology

Knowledge Check

Daily Quiz Questions

==================================================
3. OFFICIAL SOURCE SYSTEM
==================================================

Every important factual lesson/question should have source metadata.

Create a source structure such as:

source:
- sourceId
- title
- officialUrl
- publisher
- publicationDate
- lastChecked
- version/status
- courseId
- relevantSection

Only use trusted official Pi Network sources for claims presented as official Pi information.

Examples of source categories:

- Official Pi Network website
- Official Pi Network announcements
- Official Pi Network blog
- Official Pi Network documentation
- Official Pi Network Whitepaper
- Official Pi developer documentation where technically relevant

Do not use random blogs, social-media posts, Telegram messages, YouTube videos, or community claims as authoritative sources.

==================================================
4. SOURCE-FIRST CONTENT CREATION
==================================================

Before creating a lesson:

1. Identify the official source.
2. Read the relevant source.
3. Extract the factual concepts.
4. Explain them in simple language.
5. Clearly distinguish:
   - Official fact
   - Explanation
   - Example
   - Important warning
6. Store the source reference.

Do not copy large portions of copyrighted documents.

Summarize and explain the material in original wording.

==================================================
5. COURSE EXPLANATION STYLE
==================================================

The courses should be understandable to a new Pioneer.

Each lesson should contain:

WHAT IS IT?

A simple explanation.

WHY DOES IT MATTER?

Explain its importance.

HOW DOES IT WORK?

Explain the concept step by step.

EXAMPLE

Give a simple example where appropriate.

IMPORTANT

Highlight the most important point.

COMMON MISUNDERSTANDING

Explain common confusion without presenting rumors as facts.

OFFICIAL SOURCE

Show the official source used for the lesson.

==================================================
6. DAILY QUIZ QUESTION BANK
==================================================

Create ONE centralized question bank.

Do NOT create a separate quiz engine for every course.

Each question should contain:

questionId
courseId
lessonId
topic
difficulty
question
optionA
optionB
optionC
optionD
correctAnswer
explanation
sourceId
sourceUrl
sourceDate
status
lastReviewed

Possible difficulty:

EASY
MEDIUM
HARD

==================================================
7. QUESTION BANK EXAMPLE
==================================================

Course:

Pi Tokenomics

Topic:

Pi Supply

Question:

"What is the maximum supply of Pi according to Pi Network's published tokenomics information?"

The answer and explanation must be based on the current official source.

Store the source with the question.

If Pi later changes the relevant information:

DO NOT silently leave the old question active.

Mark it:

NEEDS_REVIEW

or

OUTDATED

and update it after verifying the latest official information.

==================================================
8. DAILY QUIZ GENERATION
==================================================

The Daily Quiz should select questions from the centralized question bank.

Example:

Daily Quiz:
10 questions

Possible distribution:

2 questions → Pi Introduction
1 question → Mining
1 question → Tokenomics
1 question → KYC
1 question → Mainnet
1 question → Wallet
1 question → Migration
1 question → Pi Browser/Ecosystem
1 question → Security

The distribution should be configurable.

Do not always use the same questions.

Avoid repeatedly showing the same question to the same user when sufficient questions are available.

==================================================
9. COURSE ROTATION
==================================================

Create a configurable rotation system.

Example:

Monday:
Pi Introduction

Tuesday:
Mining

Wednesday:
KYC

Thursday:
Mainnet

Friday:
Wallet

Saturday:
Migration

Sunday:
Mixed Pi Knowledge

But allow the administrator to change this schedule.

Another option:

Daily Quiz = mixed questions from all 15 courses.

The admin should be able to choose:

MIXED
or
COURSE OF THE DAY

==================================================
10. LEARNING + QUIZ CONNECTION
==================================================

The Daily Quiz should encourage learning rather than guessing.

If a user gets a question wrong:

Show:

"Learn more"

Then link to the relevant lesson.

Example:

Wrong answer:

"You can review this topic in:
Pi Wallet Fundamentals → Wallet Security"

This creates:

LEARN
 ↓
UNDERSTAND
 ↓
DAILY QUIZ
 ↓
REVIEW MISTAKES
 ↓
LEARN AGAIN

==================================================
11. QUIZ EXPLANATIONS
==================================================

After answering a question, show an explanation.

Example:

Correct Answer:
[answer]

Why?

Explain the concept in simple language.

Source:
Official Pi Network material

[LEARN MORE]

Do not simply say:

"Correct!"

The explanation should teach the user something.

==================================================
12. QUESTION QUALITY
==================================================

Every question must have exactly ONE defensible correct answer.

Avoid:

- Ambiguous wording
- Community rumors
- Unverified claims
- Outdated information
- Trick questions
- Multiple correct answers
- Questions based on speculation
- Questions that require information not included in the source

Create plausible distractors, but they must not accidentally be correct.

==================================================
13. SECURITY COURSE
==================================================

The "Pi Scams & Security" course should teach users how to recognize suspicious behavior and protect their accounts.

Cover topics such as:

- Protecting wallet passphrases
- Recognizing impersonation
- Checking official sources
- Avoiding suspicious links
- Understanding that a wallet passphrase is sensitive
- Recognizing fake support accounts
- Verifying official announcements

Never ask users to submit their wallet passphrase to View2Earn.

Never store wallet passphrases.

Never request a user's private key.

==================================================
14. WALLET PASSPHRASE COURSE
==================================================

Make this course especially clear.

Explain:

- What a wallet passphrase is
- Why it is sensitive
- Why users should protect it
- What users should NOT share
- Difference between public wallet information and secret credentials
- General wallet-security principles

IMPORTANT:

View2Earn must NEVER request or collect a user's Pi wallet passphrase.

==================================================
15. MAINNET MIGRATION COURSE
==================================================

Separate:

FIRST MIGRATION

and

SECOND MIGRATION

into clearly labeled lessons.

Do not assume that old migration information is permanently current.

Migration information must include:

- Official source
- Publication/update date
- Last reviewed date

If Pi Network changes migration procedures, administrators must be able to update the affected lessons/questions without rebuilding the entire course.

==================================================
16. MAINNET CHECKLIST COURSE
==================================================

Create an educational walkthrough of the Mainnet Checklist.

Do NOT pretend View2Earn is responsible for completing Pi Network's checklist.

Explain the purpose of the steps and direct users to the official Pi environment where appropriate.

Each step should have:

Step number
Title
Explanation
Why it matters
Current status if available
Official source

Do not fabricate checklist steps.

Use the current official Pi documentation.

==================================================
17. PI BROWSER COURSE
==================================================

Explain:

- What Pi Browser is
- Its role in the Pi ecosystem
- How users access Pi ecosystem applications
- Security considerations
- How to verify that an application/source is legitimate

Do not imply that every application claiming to be a Pi app is officially endorsed by Pi Network.

Clearly distinguish:

Pi Network official information

from

third-party/community applications.

==================================================
18. PI APPS & ECOSYSTEM COURSE
==================================================

Explain the Pi ecosystem using current official information.

Possible topics:

- Pi Apps
- Ecosystem utilities
- Developer ecosystem
- Pi Browser applications
- Mainnet utilities
- How users should verify information

Keep this course updateable because the ecosystem changes over time.

==================================================
19. OFFICIAL RESOURCES COURSE
==================================================

Create a course teaching users:

"How do I know whether Pi information is official?"

Teach users to check:

- Official Pi website
- Official Pi announcements
- Official developer documentation
- Official Pi resources

The purpose is to reduce misinformation.

==================================================
20. ADMIN CONTENT MANAGEMENT
==================================================

Create an admin-friendly content architecture.

Admin should be able to:

- Create course
- Edit course
- Create lesson
- Edit lesson
- Add source
- Add question
- Edit question
- Disable question
- Mark question outdated
- Assign question to course
- Assign question to lesson
- Set difficulty
- Review source
- Publish/unpublish content

Do not require a developer to edit application code whenever a new Pi lesson or question is added.

==================================================
21. CONTENT VERSIONING
==================================================

This is extremely important.

Pi Network information can change.

Therefore store:

createdAt
updatedAt
lastReviewedAt
sourcePublishedAt
contentVersion
status

Possible statuses:

DRAFT
REVIEW
PUBLISHED
NEEDS_REVIEW
OUTDATED
ARCHIVED

When an official source changes:

Mark related content:

NEEDS_REVIEW

rather than silently presenting potentially outdated information.

==================================================
22. DAILY QUIZ REWARD
==================================================

The quiz can remain part of View2Earn's existing reward system.

However:

The educational content and answer correctness must be independent from the reward system.

Correct answer:
→ quiz score

Quiz completion:
→ existing reward logic

Do not allow the frontend to award rewards simply because a user changes the answer locally.

Use the existing trusted backend reward mechanism.

==================================================
23. USER PROGRESS
==================================================

Track learning progress separately from quiz rewards.

For each course:

progress:
0–100%

Example:

Pi Wallet Fundamentals
75% complete

Daily Quiz:
8/10 correct

This should not require a reputation system.

The user can simply have:

Learning Progress
Quiz Score
Completed Lessons

without creating complicated reputation levels.

==================================================
24. NO REPUTATION REQUIREMENT
==================================================

Do NOT create a separate reputation system for:

- Every course
- Every lesson
- Every quiz
- Every topic

Use simple learning metrics:

Courses completed
Lessons completed
Quiz score
Daily quiz streak if desired
Questions answered
Topics reviewed

If View2Earn already has a general reputation/achievement system, integrate with it only where appropriate.

Do not create duplicate reputation systems.

==================================================
25. SOURCE VALIDATION
==================================================

Before publishing a question:

CHECK:

1. Is the source official?
2. Is the statement supported by the source?
3. Is the information current?
4. Is the question unambiguous?
5. Is there exactly one correct answer?
6. Is the explanation accurate?
7. Is the source attached to the question?
8. Has the question been reviewed?

Only then:

status = PUBLISHED

==================================================
26. FUTURE EXPANSION
==================================================

Design the architecture so I can later add:

16. Pi Nodes
17. Pi SDK / Development
18. Pi Payments
19. Pi Commerce
20. Pi Ecosystem Safety
21. Pi Community Contributions
22. Advanced Pi Technical Concepts

without changing the quiz architecture.

The system should support unlimited courses and questions.

==================================================
27. FINAL ARCHITECTURE
==================================================

The final system should work like this:

OFFICIAL PI SOURCES
        ↓
SOURCE DATABASE
        ↓
KNOWLEDGE CENTER
        ↓
COURSES
        ↓
LESSONS
        ↓
QUESTION BANK
        ↓
DAILY QUIZ ENGINE
        ↓
USER ANSWERS
        ↓
SCORE + EXPLANATION
        ↓
LEARN MORE
        ↓
COURSE PROGRESS

The same question bank can support:

- Daily Quiz
- Course quizzes
- Practice quizzes
- Topic quizzes
- Review questions
- Future educational challenges

==================================================
MOST IMPORTANT REQUIREMENT
==================================================

Build the system as an educational knowledge platform, not merely a collection of quiz questions.

Every question should teach something.

Every important factual claim should have an official source.

Every source-sensitive topic should be updateable.

Never invent Pi Network information.

Never present community speculation as official information.

Never collect wallet passphrases or private keys.

Do not create a separate reputation system for every course.

Create ONE scalable Knowledge Center and ONE centralized Question Bank that can support all 15 courses and future Pi courses.