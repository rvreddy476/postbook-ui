import { describe, expect, test } from 'bun:test'
import {
    CHANNEL_TYPE_BY_LABEL,
    channelTypeLabel,
    channelTypeOptions,
} from '../SettingsTab'

/**
 * A channel's type must survive being looked at.
 *
 * channel_type carries seven values; the settings select offered two, and
 * everything that was not 'private' was labelled "Public". So a creator or
 * brand channel displayed as Public, and the first touch of the select
 * rewrote it to plain 'public' — its kind thrown away by opening a form.
 */

describe('channelTypeLabel', () => {
    test('names each real type rather than collapsing it to Public', () => {
        expect(channelTypeLabel('public')).toBe('Public')
        expect(channelTypeLabel('private')).toBe('Private')
        expect(channelTypeLabel('creator')).toBe('Creator')
        expect(channelTypeLabel('brand')).toBe('Brand')
        expect(channelTypeLabel('education')).toBe('Education')
        expect(channelTypeLabel('official')).toBe('Official')
        expect(channelTypeLabel('topic')).toBe('Topic')
        expect(channelTypeLabel('paid')).toBe('Paid')
    })

    test('an unknown type falls back rather than rendering empty', () => {
        // Go sends "" for an unset string, and a server newer than this client
        // could send a type it has never heard of. Neither may blank the field.
        expect(channelTypeLabel('')).toBe('Public')
        expect(channelTypeLabel('something_new')).toBe('Public')
    })
})

describe('channelTypeOptions', () => {
    test('a public or private channel gets exactly the two general choices', () => {
        expect(channelTypeOptions('public')).toEqual(['Public', 'Private'])
        expect(channelTypeOptions('private')).toEqual(['Public', 'Private'])
    })

    test('a flavoured channel keeps its own kind, listed first', () => {
        // Selected-first matters: the select shows options[0] when the value
        // matches nothing, so omitting Creator here is what silently
        // reselected Public and erased the channel's kind on save.
        expect(channelTypeOptions('creator')).toEqual(['Creator', 'Public', 'Private'])
        expect(channelTypeOptions('brand')).toEqual(['Brand', 'Public', 'Private'])
    })

    test('its own kind is always the option the label resolves to', () => {
        for (const value of ['creator', 'brand', 'education', 'official', 'topic', 'paid']) {
            expect(channelTypeOptions(value)[0]).toBe(channelTypeLabel(value))
        }
    })

    test('every offered label maps back to a value the server accepts', () => {
        // The server validates channel_type against a fixed set and 400s on
        // anything else, so an option with no mapping is an unsaveable form.
        for (const value of ['public', 'private', 'creator', 'paid']) {
            for (const label of channelTypeOptions(value)) {
                expect(CHANNEL_TYPE_BY_LABEL[label]).toBeTruthy()
            }
        }
    })

    test('label and value round-trip', () => {
        for (const [label, value] of Object.entries(CHANNEL_TYPE_BY_LABEL)) {
            expect(channelTypeLabel(value)).toBe(label)
        }
    })
})
