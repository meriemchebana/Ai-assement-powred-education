/**
 * Demo mode config — for recording/presentation only.
 * Maps realistic course names → real dataset subject keys.
 * Activate with ?demo=1 in the URL.
 */

export interface DemoSubject {
	/** Displayed in the UI during demo */
	displayName: string;
	/** Real dataset key sent to the API */
	subject: string;
	/** Professor name shown in UI */
	professor: string;
}

export const DEMO_SUBJECTS: DemoSubject[] = [
	{
		displayName: 'Algorithmique et Structures de Données',
		subject: 'algo',
		professor: 'Dr. Benali'
	},
	{
		displayName: "Systèmes d'Exploitation",
		subject: 'se',
		professor: 'Dr. Meziane'
	},
	{
		displayName: 'Techniques du Commerce Extérieur',
		subject: 'commerce',
		professor: 'Dr. Hamdi'
	},
	{
		displayName: 'Introduction au Droit des Affaires',
		subject: 'Law',
		professor: 'Dr. Khelif'
	},
	{
		displayName: 'Théorie des Langages et Compilation',
		subject: 'compilation',
		professor: 'Dr. Amrani'
	}
];

/** Returns true when ?demo=1 is present in the URL */
export function isDemoMode(): boolean {
	if (typeof window === 'undefined') return false;
	return new URLSearchParams(window.location.search).get('demo') === '1';
}

/** Given a real subject key, return its demo display name (or the key itself) */
export function getDemoLabel(subject: string): string {
	return DEMO_SUBJECTS.find((d) => d.subject === subject)?.displayName ?? subject;
}
