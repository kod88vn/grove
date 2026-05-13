# Homeworks App

AI-powered homework system for Grade 5 students focusing on English and Mathematics.

## Prerequisites

Nora must be running and reachable for exercise generation and grading to work.

### Nora + Ollama connectivity

1. Start Nora (`apps/nora`) so Homeworks can call `/chat/api/nora-homework/*`.
2. Ensure Tailscale is connected so Nora can reach Ollama at `http://grove:11434`.
3. Confirm `PLT_NORA_URL` points to the Nora app (default local dev: `http://localhost:3001`).

## Features

### 📚 English Section
- **Daily Reading Exercises**: AI-generated short to medium passages appropriate for Grade 5
- **Comprehension Quizzes**: Mix of multiple-choice and short-answer questions
- **Varied Question Types**: Tests understanding in creative ways beyond simple recall
- **AI Grading**: Receives feedback on comprehension and writing quality
- **Revise & Resubmit**: Students can edit answers after grading and resubmit the same exercise

### 🔢 Math Section
- **Step-by-Step Problem Solving**: Problems designed like textbook exercises
- **Four Operations**: Addition, subtraction, multiplication, and division
- **10-Question Quiz**: Mixed math quizzes now generate exactly 10 problems
- **Work Visibility**: Students must show their work for each step
- **Column Method Grid**: Column-method items show operator-specific multi-row layouts:
  - **Addition / Subtraction**: Stacked operands with a carry row and a per-digit answer row
  - **Long Multiplication**: Multiplicand and multiplier rows, then one fill-in partial-product row per digit of the multiplier (trailing zeros shown statically for positional shift), then a fill-in final-answer row
  - **Long Division**: Classic bracket layout — quotient fill-in boxes above the dividend, then per-step rows showing the static bring-down value and a fill-in subtraction row, ending with the static remainder
- **Word Problems**: All problems are real-life word problem sentences (not bare equations); column-method problems also display a derived `Calculate: X op Y = ?` line for clarity
- **Scaffolded Learning**: Hints and step guides help guide problem-solving process
- **AI Grading**: Checks both correct answers and proper methodology
- **Revise & Resubmit**: Students can correct work and submit updated solutions without loading a new set

### 📊 Progress Review
- **Comprehensive Tracking**: Track completion and scores over time
- **Subject-Specific Stats**: Separate progress dashboards for English and Math
- **Recent Submissions**: View recent homework attempts and scores
- **Performance Visualization**: Progress bars showing average performance

## Architecture

### API Routes
- `GET /api/exercises?subject=english&type=reading` - Generate an exercise
- `POST /api/grade` - Grade a submission
- `GET /api/progress` - Get progress statistics

### Components
- `EnglishExercise.js` - Reading passage and comprehension quiz
- `MathExercise.js` - Math problems with column-method digit grid and standard-answer mode
- `ProgressReview.js` - Progress tracking and analytics

### Libraries
- `lib/ollama.js` - Nora API client for exercise generation and grading
- `lib/progress.js` - Progress tracking and storage

## How It Works

1. **Exercise Generation**: When a student starts an exercise, the app calls Nora (`/chat/api/nora-homework/exercise`), which generates exercise content from Ollama. English reading generation is chunked into passage then questions to reduce timeout risk.
2. **Student Work**: Student reads, answers questions, or solves problems
3. **AI Grading**: Submission is sent to Nora, which grades via Ollama
4. **Progress Recording**: Results are recorded in the progress store
5. **Feedback**: Student receives detailed feedback on their work

## Configuration

Set environment variables:
- `PLT_NORA_URL` (default: `http://localhost:3001`)
- `HOMEWORKS_NORA_TIMEOUT_MS` (default: `60000`)

## Testing

```bash
npm run test
```

## Building

```bash
npm run build
npm start
```

## Starting

```bash
npm run dev
```

The app runs on port 3005 and is accessible at `/homeworks`.
