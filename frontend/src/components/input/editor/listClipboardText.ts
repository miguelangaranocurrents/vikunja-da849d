import {Extension, getText, getTextSerializersFromSchema, type TextSerializer} from '@tiptap/core'
import {Plugin, PluginKey} from '@tiptap/pm/state'
import type {Fragment, Node as ProseMirrorNode} from '@tiptap/pm/model'

const BLOCK_SEPARATOR = '\n\n'

type Serializers = Record<string, TextSerializer>

function serializeListItem(item: ProseMirrorNode, marker: string, serializers: Serializers): string {
	const lines: string[] = []
	item.forEach(child => lines.push(serializeBlock(child, serializers)))

	// continuation lines and nested lists line up under the item text
	return marker + lines.join('\n').replace(/\n/g, '\n' + ' '.repeat(marker.length))
}

function serializeBlock(node: ProseMirrorNode, serializers: Serializers): string {
	const items: string[] = []

	switch (node.type.name) {
		case 'bulletList':
			node.forEach(item => items.push(serializeListItem(item, '- ', serializers)))
			return items.join('\n')
		case 'orderedList': {
			const start = typeof node.attrs.start === 'number' ? node.attrs.start : 1
			node.forEach((item, _offset, index) => items.push(serializeListItem(item, `${start + index}. `, serializers)))
			return items.join('\n')
		}
		case 'taskList':
			node.forEach(item => items.push(serializeListItem(item, item.attrs.checked ? '- [x] ' : '- [ ] ', serializers)))
			return items.join('\n')
		default:
			return getText(node, {blockSeparator: BLOCK_SEPARATOR, textSerializers: serializers})
	}
}

export function serializeFragmentAsText(fragment: Fragment, serializers: Serializers): string {
	if (fragment.firstChild?.isInline) {
		return fragment.textBetween(0, fragment.size, BLOCK_SEPARATOR, '')
	}

	const blocks: string[] = []
	fragment.forEach(node => blocks.push(serializeBlock(node, serializers)))
	return blocks.join(BLOCK_SEPARATOR)
}

/**
 * Copying as plain text would otherwise flatten lists into bare paragraphs and lose their markers.
 */
export const ListClipboardText = Extension.create({
	name: 'listClipboardText',

	// Must come before the core clipboardTextSerializer, the first plugin providing the prop wins.
	priority: 1000,

	addProseMirrorPlugins() {
		const serializers = getTextSerializersFromSchema(this.editor.schema)

		return [
			new Plugin({
				key: new PluginKey('listClipboardText'),
				props: {
					clipboardTextSerializer: slice => serializeFragmentAsText(slice.content, serializers),
				},
			}),
		]
	},
})
