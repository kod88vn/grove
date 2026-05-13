# Grade 5 Math Skills Library

## Overview

The Skills Library is a catalog-first Grade 5 skill map with progress overlay. Students can browse all skills by category (IXL-style) and then review completed problems and scores for each category.

## Architecture

### Database (`apps/nora/lib/db/skills-library.js`)

Stores completed problems with metadata:
- `id` — unique problem instance ID
- `student_id` — student identifier
- `subject` — subject (e.g., "math")
- `skill_category` — category like "multiplication", "fractions", "decimals"
- `skill_name` — descriptive skill like "Long Multiplication"
- `skill_label` — emoji + label for UI display (e.g., "✖️ Long Multiplication")
- `problem_text` — the problem statement
- `problem_json` — full problem object
- `answer_json` — student's answer and expected answer
- `score` — points earned (0–1 per problem)
- `max_score` — max points (1)
- `created_at` — timestamp

### Skill Catalog (`apps/nora/lib/skills-catalog.js`)

Comprehensive catalog of 60+ Grade 5 math skills organized by category:
- Whole Numbers & Place Value
- Addition & Subtraction
- Multiplication
- Division
- Fractions
- Decimals
- Order of Operations
- Factors, Multiples & Divisibility
- Measurement & Unit Conversion
- Geometry
- Data & Patterns
- Algebra Readiness

Each skill has:
```javascript
{
  id: 'long-multiplication',
  name: 'Long Multiplication (2-digit)',
  label: '✖️ Long Multiplication',
  description: 'Multiply 2-digit by 2-digit numbers using column method',
  problemType: 'column-method', // optional
}
```

### Problem Generation (`apps/nora/app/api/nora-homework/exercise/route.js`)

Updated `POST /api/nora-homework/exercise` to generate problems with skill metadata:

**Schema additions:**
```json
{
  "skillCategory": "string",
  "skillName": "string",
  "skillLabel": "string"
}
```

The Nora prompt now includes:
- Specific skill categories to rotate through
- Emoji labels for visual identification
- Mix of column-method (bare equations) and standard (word problems) per skill

### Library API (`apps/nora/app/api/nora-homework/library/route.js`)

#### POST `/api/nora-homework/library`
Save a completed problem to the library.

```javascript
{
  studentId: 'default',
  subject: 'math',
  skillCategory: 'multiplication',
  skillName: 'Long Multiplication',
  skillLabel: '✖️ Long Multiplication',
  problemText: '24 × 38 = ?',
  problemJson: { /* full problem object */ },
  answerJson: { studentAnswer: '912', expectedAnswer: '912' },
  score: 1,
  maxScore: 1
}
```

#### GET `/api/nora-homework/library`
Retrieve library entries.

**Query params:**
- `studentId` — filter by student (default: 'default')
- `skillCategory` — optional filter by category
- `skillName` — optional filter by specific skill
- `view` — one of:
  - `items` (default) — list of problems
  - `summary` — aggregate stats by skill
  - `stats` — overall student stats
  - `catalog` — full Grade 5 skill catalog (all categories and skills)

**Response examples:**

```javascript
// view=items
{
  items: [
    {
      id: 'uuid',
      subject: 'math',
      skill_category: 'multiplication',
      skill_name: 'Long Multiplication',
      skill_label: '✖️ Long Multiplication',
      problem_text: '24 × 38 = ?',
      score: 1,
      max_score: 1,
      created_at: 1234567890
    }
  ]
}

// view=summary
{
  summary: [
    {
      skill_category: 'multiplication',
      skill_name: 'Long Multiplication',
      skill_label: '✖️ Long Multiplication',
      attempts: 5,
      averageScore: 80.0,
      lastAttempted: 1234567890
    }
  ]
}

// view=stats
{
  stats: {
    totalProblems: 47,
    skillsAttempted: 12,
    averageScore: 75.5
  }
}
```

### UI Components

#### SkillsLibrary (`apps/homeworks/components/SkillsLibrary.js`)

Main component showing:
1. **Overview Stats** — total problems, skills mastered, average score
2. **Category Browser** — sidebar with all skill categories
3. **Skill Details** — problems by category with scores and dates
4. **Detailed View** — individual problem review

#### Library Page (`apps/homeworks/app/library/page.js`)

Route at `/library` in homeworks app that displays the `SkillsLibrary` component.

### Problem Submission Flow

In `MathExercise.js`:

1. Student submits answers via form
2. `handleSubmit()` calls grading endpoint
3. Grader returns feedback per problem
4. **New:** For each graded problem, POST to `/api/nora-homework/library` with:
   - Skill metadata from the problem
   - Student answer
   - Score (1 if correct, 0 if incorrect)
5. Library entry is stored in database
6. Student sees submission result

## Usage

### As a Student

1. **Do problems:** Click "🔢 Math" and solve problems
2. **Review library:** Click "📚 Skills Library" in navigation
3. **Filter by skill:** Click category to see problems for that skill
4. **Track progress:** View average scores and attempts per skill

### As a Developer

#### Add a New Skill

Edit `apps/nora/lib/skills-catalog.js`:

```javascript
'multiply-decimals': {
  category: 'Decimals',
  categoryId: 'decimals',
  skills: [
    {
      id: 'multiply-decimals',
      name: 'Multiply Decimals',
      label: '✖️ Multiply Decimals',
      description: 'Multiply decimals by whole numbers and decimals',
    },
    // ... other skills
  ]
}
```

#### Query Student's Library

```javascript
import { getLibraryByStudent, getSkillsSummary, getLibraryStats } from '@/lib/db/skills-library'

// Get all problems for a student
const items = getLibraryByStudent('default')

// Get summary by skill
const summary = getSkillsSummary('default')

// Get overall stats
const stats = getLibraryStats('default')
```

#### Customize Problem Generation

Edit the math prompt in `apps/nora/app/api/nora-homework/exercise/route.js` to:
- Change skill distribution (e.g., more fractions, fewer decimals)
- Add new problem types
- Adjust difficulty progression

## Testing

Run tests for the skills library system:

```bash
cd apps/nora
npm test -- lib/db/skills-library.test.js
npm test -- app/api/nora-homework/library/route.test.js
```

In homeworks:
```bash
cd apps/homeworks
npm test -- components/SkillsLibrary.test.js
npm test -- app/library/page.test.js
```

## Future Enhancements

1. **Progress Tracking Visualizations** — charts showing skill mastery over time
2. **Personalized Recommendations** — suggest skills to focus on based on weak areas
3. **Mastery Levels** — gamified skill progression (novice → proficient → advanced)
4. **Skill Hierarchy** — prerequisites and skill dependencies
5. **Peer Comparisons** — anonymized class-wide benchmarks
6. **Export/Print** — generate PDF reports of skills library
7. **Mobile Companion** — responsive library view for tablets/phones
8. **Spaced Repetition** — smart scheduling of practice based on forgetting curve

## Long-Term Vision

The Skills Library is designed to scale across all subjects and grades:

### Next Phases
1. **Q2 2026** — Add fractions, decimals, and advanced operations
2. **Q3 2026** — Integrate with English/Writing skill tracking
3. **Q4 2026** — Add science, social studies, and other domains
4. **2027** — Full K–8 skills library with mastery-based pathways
