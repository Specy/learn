// app/src/lib/content/plainText.ts

/**
 * Convert markdown to plain text suitable for reading-time estimation.
 * Strips code blocks, images, markdown punctuation; keeps inline text.
 */
export function toPlainText(md: string): string {
	return (
		md
			// remove fenced code blocks (``` ... ```)
			.replace(/```[\s\S]*?```/g, '')
			// remove indented code blocks (4-space or tab)
			.replace(/^(?: {4}|\t).+$/gm, '')
			// remove images ![alt](url)
			.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
			// convert links [text](url) → text
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
			// remove heading hashes
			.replace(/^#{1,6}\s+/gm, '')
			// remove bold/italic markers (**, *, __, _)
			.replace(/(\*\*|__)(.*?)\1/g, '$2')
			.replace(/(\*|_)(.*?)\1/g, '$2')
			// remove inline code `...`
			.replace(/`[^`]+`/g, '')
			// remove blockquote markers
			.replace(/^>\s*/gm, '')
			// remove horizontal rules
			.replace(/^[-*_]{3,}\s*$/gm, '')
			// remove HTML tags
			.replace(/<[^>]+>/g, '')
			// collapse excess blank lines
			.replace(/\n{3,}/g, '\n\n')
			.trim()
	);
}
