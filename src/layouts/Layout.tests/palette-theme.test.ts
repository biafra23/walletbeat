import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'

import { describe, expect, it } from 'vitest'

const layout = readFileSync(new URL('../Layout.astro', import.meta.url), 'utf8')
const script = layout.split('<script is:inline>')[1]?.split('</script>')[0]

if (!script) {
	throw new Error('Missing theme lifecycle script')
}

function theme(systemDark: boolean, stored: string | null, storageBlocked = false) {
	const context = createContext({ systemDark, stored, storageBlocked })

	runInContext(
		`
		class HTMLInputElement { id = 'theme-toggle'; checked = false }
		const listeners = new Map();
		const media = { matches: systemDark, addEventListener: (_, fn) => { media.changed = fn } };
		const matchMedia = () => media;
		const localStorage = {
			getItem() { if (storageBlocked) throw Error(); return stored },
			setItem(_, value) { if (storageBlocked) throw Error(); stored = value }
		};
		function makeDocument() {
			return {
				toggle: null,
				documentElement: { style: {
					colorScheme: '',
					values: new Map(),
					setProperty(name, value) { this.values.set(name, value) },
					getPropertyValue(name) { return this.values.get(name) ?? '' },
					removeProperty(name) {
						if (name === 'color-scheme') this.colorScheme = '';
						else this.values.delete(name);
					}
				} },
				getElementById() { return this.toggle },
				addEventListener(name, fn) { listeners.set(name, fn) }
			};
		}
		let document = makeDocument();
		function mount() { document.toggle = new HTMLInputElement() }
		function ready() { listeners.get('DOMContentLoaded')() }
		function click() {
			document.toggle.checked = !document.toggle.checked;
			listeners.get('change')({ target: document.toggle });
		}
		function os(dark) { media.matches = dark; media.changed() }
		function swap() {
			const next = makeDocument();
			next.toggle = new HTMLInputElement();
			listeners.get('astro:before-swap')({ newDocument: next });
			document = next;
		}
		`,
		context,
	)
	runInContext(script, context)

	return (code: string): unknown => runInContext(code, context)
}

describe('palette theme bridge', () => {
	for (const systemDark of [false, true]) {
		for (const stored of [null, 'invalid', 'light', 'dark']) {
			for (const blocked of [false, true]) {
				it(`tracks first paint and retires the inline bridge for native controls: ${systemDark}/${stored}/${blocked}`, () => {
					const run = theme(systemDark, stored, blocked)
					const preference = !blocked && (stored === 'light' || stored === 'dark') ? stored : null

					expect(run("document.documentElement.style.getPropertyValue('---theme-dark')")).toBe(
						preference === 'dark' ? '1' : preference === 'light' ? '0' : '',
					)
					expect(run('document.documentElement.style.colorScheme')).toBe(preference ?? '')
					run('mount(); ready()')
					expect(run("document.documentElement.style.getPropertyValue('---theme-dark')")).toBe('')
					expect(run('document.documentElement.style.colorScheme')).toBe('')
					run('click(); os(!media.matches); swap()')
					expect(run("document.documentElement.style.getPropertyValue('---theme-dark')")).toBe('')
					expect(run('document.documentElement.style.colorScheme')).toBe('')
				})
			}
		}
	}
})
