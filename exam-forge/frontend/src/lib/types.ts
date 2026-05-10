export type Level = 'Procedural' | 'Conceptual' | 'Metacognitive';
export type LevelOrMixed = Level | 'Mixed';
export type QuestionType = 'MCQ' | 'SAQ' | 'Exercise';

export interface SubjectSummary {
	subject: string;
	total: number;
	levels: Record<string, number>;
}

export interface SubjectsResponse {
	subjects: SubjectSummary[];
	model: string;
}

export interface GenerateRequest {
	subject: string;
	level: LevelOrMixed;
	count: number;
	topic?: string | null;
	question_type: QuestionType;
	questions_per_exercise?: number;
	user_id?: string | null;
}

export interface MCQ {
	stem: string;
	choices: string[];
	correct_index: number;
	explanation: string;
	level: Level;
	topic: string;
}

export interface SAQ {
	stem: string;
	model_answer: string;
	grading_rubric: string[];
	level: Level;
	topic: string;
	points: number;
}

export interface ExerciseQuestion {
	stem: string;
	model_answer: string;
	grading_rubric: string[];
	points: number;
}

export interface Exercise {
	title: string;
	context: string;
	questions: ExerciseQuestion[];
	level: Level;
	topic: string;
}

export type GeneratedQuestion =
	| { type: 'MCQ'; data: MCQ }
	| { type: 'SAQ'; data: SAQ }
	| { type: 'Exercise'; data: Exercise };

export interface StatusEvent {
	phase: 'studying' | 'retrieving' | 'generating';
	message: string;
}

export interface ExampleEvent {
	idx: number;
	stem: string;
	level: Level | null;
	source: string;
}

export interface QuestionEvent {
	idx: number;
	total: number;
	type: QuestionType;
	data: MCQ | SAQ | Exercise;
}

export interface EvaluationResult {
	factual_ok: boolean;
	level_correct: boolean;
	corrected_level: 'Factual' | Level | null;
	quality: 'good' | 'needs_revision' | 'reject';
	points_calibration: 'too_low' | 'fair' | 'too_high';
	difficulty_ok: boolean;
	estimated_minutes: number;
	verdict: 'pass' | 'flag' | 'reject';
	notes: string;
}

export interface EvaluationEvent {
	idx: number;
	result: EvaluationResult;
}

export interface DoneEvent {
	total: number;
}

export interface ErrorEvent {
	message: string;
}

export type StreamEvent =
	| { type: 'status'; data: StatusEvent }
	| { type: 'example'; data: ExampleEvent }
	| { type: 'question'; data: QuestionEvent }
	| { type: 'evaluation'; data: EvaluationEvent }
	| { type: 'done'; data: DoneEvent }
	| { type: 'error'; data: ErrorEvent };

// ── Full Exam types ───────────────────────────────────────────────────────────

export type ExerciseKind = 'QCM' | 'PRACTICAL' | 'THEORY';
export type PatternName =
	| 'all_QCM'
	| 'all_practical'
	| 'all_theory'
	| 'theory_then_practical'
	| 'qcm_then_practical'
	| 'mixed';

export interface GenerateExamRequest {
	subject: string;
	title?: string | null;
	n_exercises?: number | null;
	duration_minutes?: number | null;
	total_points?: number | null;
	target_level?: string;
	pattern_override?: PatternName | null;
	topic?: string | null;
	exercise_kinds?: ExerciseKind[] | null;
	user_id?: string | null;
}

export interface ExamPlanEvent {
	subject: string;
	n_exercises: number;
	total_points: number | null;
	duration_minutes: number | null;
	template_hint: string;
	template_source: 'archive' | 'user_override' | 'default';
}

export interface AssembledQuestion {
	id: string;
	type: string;
	question_text: string;
	choices?: string[];
	solution?: Record<string, unknown>;
	level?: string;
	points?: number;
	topic?: string;
}

export interface AssembledExercise {
	id: string;
	title: string;
	total_exercise_points?: number | null;
	introduction_context?: string | null;
	questions: AssembledQuestion[];
	level?: string;
}

export interface AssembledExam {
	metadata: { module: string; language: string; duration: string };
	exercises: AssembledExercise[];
}

export interface ExamDoneEvent {
	total_exercises: number;
	exam: AssembledExam;
}

export type ExamStreamEvent =
	| { type: 'plan'; data: ExamPlanEvent }
	| { type: 'status'; data: StatusEvent }
	| { type: 'exercise'; data: { position: number; exercise: AssembledExercise } }
	| { type: 'done'; data: ExamDoneEvent }
	| { type: 'error'; data: { exercise?: number; message: string } };

// ── PDF Parse streaming types ─────────────────────────────────────────────────

export type ParsePhase =
	| 'converting'
	| 'extracting'
	| 'validating'
	| 'classifying'
	| 'vision'
	| 'saving';

export interface ParseStatusEvent {
	phase: ParsePhase;
	message: string;
	page_count?: number;
	has_tables?: boolean;
	exercises?: number;
	questions?: number;
	confidence?: number;
	needs_review?: boolean;
	saved_to?: string;
}

export interface ParseDoneEvent {
	confidence: number;
	needs_review: boolean;
	exercises: number;
	questions: number;
	saved_to: string;
}

export type ParseStreamEvent =
	| { type: 'status'; data: ParseStatusEvent }
	| { type: 'done'; data: ParseDoneEvent }
	| { type: 'error'; data: { message: string } };
