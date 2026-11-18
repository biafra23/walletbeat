import { expect, test } from '../../../tests/browser/verified-test'

for (const colorScheme of ['light', 'dark'] as const) {
	for (const width of [375, 1440]) {
		test.describe(`${colorScheme} ${width}px tags`, () => {
			test.use({ colorScheme, viewport: { width, height: 900 } })
			test('category labels inherit theme paint and fit their content', async ({ page }) => {
				for (const route of ['/metamask/', '/wallet/7702/']) {
					await page.goto(route)
					await page.mouse.move(0, 0)
					const tags = page.locator(
						route === '/metamask/'
							? '.wallet-overview-tags [data-tag]:visible'
							: 'main [data-tag]:visible',
					)

					expect(await tags.count()).toBeGreaterThan(0)

					for (const tag of await tags.all()) {
						const result = await tag.evaluate(element => {
							const style = getComputedStyle(element)
							const probe = document.createElement('span')

							probe.hidden = true
							element.append(probe)
							probe.style.color = 'var(--text-primary)'
							probe.style.backgroundColor = 'var(--background-tertiary)'
							const roles = getComputedStyle(probe)
							const expectedColor = roles.color
							const expectedBackground = roles.backgroundColor

							probe.remove()
							const range = document.createRange()

							range.selectNodeContents(element)
							const rows = new Set([...range.getClientRects()].map(rect => Math.round(rect.top)))
							const intrinsic =
								rows.size * Number.parseFloat(style.lineHeight) +
								[
									style.paddingTop,
									style.paddingBottom,
									style.borderTopWidth,
									style.borderBottomWidth,
								].reduce((sum, value) => sum + Number.parseFloat(value), 0)
							const box = element.getBoundingClientRect()

							return {
								color: style.color,
								background: style.backgroundColor,
								expectedColor,
								expectedBackground,
								intrinsic,
								height: box.height,
								minBlockSize: style.minBlockSize,
								passive: element.closest('button,a[href]') === null,
								overflow: element.scrollWidth - element.clientWidth,
								whiteSpace: style.whiteSpace,
								wrap: style.overflowWrap,
								overview: element.closest('.wallet-overview-tags') !== null,
							}
						})

						expect(result.color).toBe(result.expectedColor)
						expect(result.background).toBe(result.expectedBackground)
						expect(result.overflow).toBeLessThanOrEqual(1)
						expect(result.whiteSpace).toBe('normal')
						expect(result.wrap).toBe(result.overview ? 'normal' : 'anywhere')

						if (result.passive) {
							expect(['auto', '0px']).toContain(result.minBlockSize)
							expect(result.height).toBeLessThanOrEqual(result.intrinsic + 1)
						}
					}
				}
			})
		})
	}
}
