import { afterAll, beforeAll, describe, expect, expectTypeOf, it, vi } from 'vitest'

import type { CalendarDate } from '@/types/date'
import * as dates from '@/types/date'

// The fallback reads Date.now(), which lets Vitest control the clock on every Node version.
vi.hoisted(() => vi.stubGlobal('Temporal', undefined))

afterAll(() => {
	vi.unstubAllGlobals()
})

const timezones = [
	'UTC',
	'America/Los_Angeles',
	'Europe/Berlin',
	'Australia/Sydney',
	'Australia/Lord_Howe',
	'Pacific/Auckland',
]

describe.each(timezones)('calendar dates in %s', timezone => {
	const originalTimezone = process.env.TZ

	beforeAll(() => {
		process.env.TZ = timezone
		vi.setSystemTime(new Date('2024-03-01T00:30:00Z'))
	})

	afterAll(() => {
		if (originalTimezone === undefined) {
			delete process.env.TZ
		} else {
			process.env.TZ = originalTimezone
		}

		vi.useRealTimers()
	})

	it('accepts real dates within the supported year range', () => {
		expect(dates.assertCalendarDate('2010-01-01')).toBe('2010-01-01')
		expect(dates.assertCalendarDate('2024-02-29')).toBe('2024-02-29')
		expect(dates.assertCalendarDate('2039-12-31')).toBe('2039-12-31')

		expectTypeOf<'2009-12-31'>().not.toExtend<CalendarDate>()
		expectTypeOf<'2010-01-01'>().toExtend<CalendarDate>()
		expectTypeOf<'2039-12-31'>().toExtend<CalendarDate>()
		expectTypeOf<'2040-01-01'>().not.toExtend<CalendarDate>()
	})

	it.each([
		'2009-12-31',
		'2040-01-01',
		'2023-02-29',
		'2026-04-31',
		'2026-13-01',
		'2026-9-10',
		'2026-09-10T00:00:00Z',
	])('rejects %s', date => {
		expect(() => dates.assertCalendarDate(date)).toThrow('Invalid calendar date')
	})

	it('gets the current day and elapsed days in UTC', () => {
		expect(dates.today()).toBe('2024-03-01')
		expect(dates.daysSince('2024-02-28')).toBe(2)
		expect(dates.daysSince('2024-03-01')).toBe(0)
		expect(dates.daysSince('2024-03-02')).toBe(-1)
	})

	const intervals: [CalendarDate, CalendarDate, number][] = [
		['2023-12-31', '2024-03-01', 61],
		['2024-03-09', '2024-03-11', 2],
		['2024-04-06', '2024-04-08', 2],
		['2024-10-26', '2024-10-28', 2],
		['2024-11-02', '2024-11-04', 2],
	]

	it.each(intervals)('counts and compares %s to %s', (first, second, elapsed) => {
		expect(dates.daysBetween(first, second)).toBe(elapsed)
		expect(dates.daysBetween(second, first)).toBe(-elapsed)
		expect(dates.daysBetween(first, first)).toBe(0)
		expect(dates.dateCompare(first, second)).toBe(-1)
		expect(dates.dateCompare(second, first)).toBe(1)
		expect(dates.dateCompare(first, first)).toBe(0)
	})

	it('formats the same calendar day with different display options', () => {
		expect(dates.formatCalendarDate('2024-02-29')).toBe('February 29, 2024')
		expect(dates.formatCalendarDate('2024-02-29', { weekday: 'long' })).toBe('Thursday')
	})

	it('counts days past the last year allowed in stored dates', () => {
		vi.setSystemTime(new Date('2040-01-01T00:30:00Z'))

		expect(dates.daysSince('2039-12-31')).toBe(1)
		expect(() => dates.today()).toThrow('Invalid calendar date')
	})
})
