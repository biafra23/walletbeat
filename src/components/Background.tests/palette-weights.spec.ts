import { expect, test } from '@playwright/test'

for (const colorScheme of ['light', 'dark'] as const) {
	test(`weighted wallet opacity interpolates in ${colorScheme} mode`, async ({ page }) => {
		await page.emulateMedia({ colorScheme, reducedMotion: 'no-preference' })
		await page.goto('/bitget/')
		await page.waitForFunction(() => !document.querySelector('astro-island[ssr][client="load"]'))
		const samples = await page
			.locator('.background-blob')
			.first()
			.evaluate(async (blob, scheme) => {
				const animation = blob
					.getAnimations({ subtree: true })
					.find(
						effect =>
							effect instanceof CSSAnimation && effect.animationName.endsWith('blob-opacity'),
					)

				if (animation?.effect === null || animation?.effect === undefined) {
					throw new Error('Missing opacity animation')
				}

				const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null

				if (!(target instanceof HTMLElement) || !(blob instanceof HTMLElement)) {
					throw new Error('Missing opacity target')
				}

				const duration = Number(animation.effect.getTiming().duration)
				const values: number[] = []

				animation.pause()

				for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
					animation.currentTime = duration * progress
					await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
					values.push(Number(getComputedStyle(target).opacity))
				}

				return {
					values,
					weight: Number(getComputedStyle(blob).opacity),
					from: Number.parseFloat(target.style.getPropertyValue('--opacity-from')) / 100,
					to: Number.parseFloat(target.style.getPropertyValue('--opacity-to')) / 100,
					expectedWeight: Number(blob.style.getPropertyValue(`--blob-${scheme}-theme-weight`)),
				}
			}, colorScheme)

		expect(samples.weight).toBeCloseTo(samples.expectedWeight, 6)
		expect(samples.values[0]).toBeCloseTo(samples.from, 6)
		expect(samples.values.at(-1)).toBeCloseTo(samples.to, 6)

		for (let index = 1; index < samples.values.length; index++) {
			expect(samples.values[index]).toBeGreaterThan(samples.values[index - 1])
		}
	})
}
