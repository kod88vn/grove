# Homeworks App

AI-powered homework system for Grade 5 students focusing on English and Mathematics.

## Features

### 📚 English Section
- **Daily Reading Exercises**: AI-generated short to medium passages appropriate for Grade 5
- **Comprehension Quizzes**: Mix of multiple-choice and short-answer questions
- **Varied Question Types**: Tests understanding in creative ways beyond simple recall
- **AI Grading**: Receives feedback on comprehension and writing quality

### 🔢 Math Section
- **Step-by-Step Problem Solving**: Problems designed like textbook exercises
- **Four Operations**: Addition, subtraction, multiplication, and division
- **Work Visibility**: Students must show their work for each step
- **Scaffolded Learning**: Hints and step guides help guide problem-solving process
- **AI Grading**: Checks both correct answers and proper methodology

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
- `MathExercise.js` - Math problems with step-by-step work
- `ProgressReview.js` - Progress tracking and analytics

### Libraries
- `lib/ollama.js` - Ollama AI integration for exercise generation and grading
- `lib/progress.js` - Progress tracking and storage

## How It Works

1. **Exercise Generation**: When a student starts an exercise, the app calls Ollama to generate an appropriate Grade 5 level exercise
2. **Student Work**: Student reads, answers questions, or solves problems
3. **AI Grading**: Submission is sent to Ollama for intelligent grading with feedback
4. **Progress Recording**: Results are recorded in the progress store
5. **Feedback**: Student receives detailed feedback on their work

## Configuration

Set environment variables:
- `OLLAMA_BASE_URL` (default: `http://grove:11434`)
- `OLLAMA_MODEL` (default: `llama2`)

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
