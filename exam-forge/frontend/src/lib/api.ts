import type { ExamStreamEvent, GenerateExamRequest, GenerateRequest, ParseStreamEvent, QuestionType, StreamEvent, SubjectsResponse } from './types';

export async function fetchSubjects(): Promise<SubjectsResponse> {
	const r = await fetch('/api/subjects');
	if (!r.ok) throw new Error(`subjects: ${r.status}`);
	return r.json();
}

export async function* streamGenerate(
	req: GenerateRequest,
	signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
	const r = await fetch('/api/generate', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(req),
		signal
	});
	if (!r.ok || !r.body) throw new Error(`generate: ${r.status}`);

	const reader = r.body.getReader();
	const decoder = new TextDecoder();
	let buf = '';

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buf += decoder.decode(value, { stream: true });

		// SSE frames are separated by blank lines.
		let sep: number;
		while ((sep = buf.indexOf('\n\n')) >= 0) {
			const frame = buf.slice(0, sep);
			buf = buf.slice(sep + 2);
			const ev = parseFrame(frame);
			if (ev) yield ev;
		}
	}
}

export async function* streamGenerateExam(
	req: GenerateExamRequest,
	signal?: AbortSignal
): AsyncGenerator<ExamStreamEvent> {
	const r = await fetch('/api/generate-exam', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(req),
		signal
	});
	if (!r.ok || !r.body) throw new Error(`generate-exam: ${r.status}`);

	const reader = r.body.getReader();
	const decoder = new TextDecoder();
	let buf = '';

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buf += decoder.decode(value, { stream: true });
		let sep: number;
		while ((sep = buf.indexOf('\n\n')) >= 0) {
			const frame = buf.slice(0, sep);
			buf = buf.slice(sep + 2);
			const ev = parseExamFrame(frame);
			if (ev) yield ev;
		}
	}
}

export async function validateQuestion(
	subject: string,
	type: QuestionType,
	data: Record<string, unknown>,
	status: 'favorite' | 'draft' | 'trash' = 'favorite',
	reason?: string
): Promise<void> {
	const body: Record<string, unknown> = { subject, type, data, status };
	if (reason) body.reason = reason;
	const r = await fetch('/api/validate', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!r.ok) throw new Error(`validate: ${r.status}`);
}

export async function* streamParse(
	file: File,
	subject: string,
	signal?: AbortSignal
): AsyncGenerator<ParseStreamEvent> {
	const body = new FormData();
	body.append('file', file);
	body.append('subject', subject);

	const r = await fetch('/api/parse', { method: 'POST', body, signal });
	if (!r.ok || !r.body) throw new Error(`parse: ${r.status}`);

	const reader = r.body.getReader();
	const decoder = new TextDecoder();
	let buf = '';

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buf += decoder.decode(value, { stream: true });
		let sep: number;
		while ((sep = buf.indexOf('\n\n')) >= 0) {
			const frame = buf.slice(0, sep);
			buf = buf.slice(sep + 2);
			let event = 'message';
			const dataLines: string[] = [];
			for (const line of frame.split('\n')) {
				if (line.startsWith('event:')) event = line.slice(6).trim();
				else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
			}
			if (!dataLines.length) continue;
			try {
				const data = JSON.parse(dataLines.join('\n'));
				if (['status', 'done', 'error'].includes(event))
					yield { type: event, data } as ParseStreamEvent;
			} catch { /* ignore malformed frame */ }
		}
	}
}

function parseExamFrame(frame: string): ExamStreamEvent | null {
	let event = 'message';
	const dataLines: string[] = [];
	for (const line of frame.split('\n')) {
		if (line.startsWith('event:')) event = line.slice(6).trim();
		else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
	}
	if (!dataLines.length) return null;
	try {
		const data = JSON.parse(dataLines.join('\n'));
		if (['plan', 'status', 'exercise', 'done', 'error'].includes(event))
			return { type: event, data } as ExamStreamEvent;
		return null;
	} catch { return null; }
}

function parseFrame(frame: string): StreamEvent | null {
	let event = 'message';
	const dataLines: string[] = [];
	for (const line of frame.split('\n')) {
		if (line.startsWith('event:')) event = line.slice(6).trim();
		else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
	}
	if (!dataLines.length) return null;
	try {
		const data = JSON.parse(dataLines.join('\n'));
		switch (event) {
			case 'status':
			case 'example':
			case 'question':
			case 'evaluation':
			case 'done':
			case 'error':
				return { type: event, data } as StreamEvent;
			default:
				return null;
		}
	} catch {
		return null;
	}
}
