import { TreeModel } from 'libs/shared/tree'
import { noteCacheInstance, NoteCacheItem } from 'libs/web/cache'
import { isNoteLink, NoteModel } from 'libs/shared/note'
import { keys, pull } from 'lodash'
import markdownLinkExtractor from 'markdown-link-extractor'
import { mergeUpdates } from 'libs/shared/y-doc'

/**
 * 清除本地存储中未使用的 note
 */
async function checkItems(items: TreeModel['items']) {
  const noteIds = keys(items)
  const localNoteIds = await noteCache.keys()
  const unusedNoteIds = pull(localNoteIds, ...noteIds)

  await Promise.all(
    unusedNoteIds.map((id) => (id ? noteCache.removeItem(id) : undefined))
  )
}

async function getItem(id: string) {
  return noteCacheInstance.getItem<NoteCacheItem>(id)
}

async function setItem(id: string, note: NoteModel) {
  const extractorLinks = markdownLinkExtractor(note.content ?? '', false)
  const linkIds: string[] = []
  if (Array.isArray(extractorLinks) && extractorLinks.length) {
    extractorLinks.forEach((link) => {
      if (isNoteLink(link)) {
        linkIds.push(link.slice(1))
      }
    })
  }
  // todo 从本地读 update 进行 merge，然后更新 link
  const local = await getItem(id)
  if (local) {
    note.updates = [
      mergeUpdates([...(local.updates ?? []), ...(note.updates ?? [])]),
    ]
  }
  console.log('set', local?.updates, note.updates)
  return noteCacheInstance.setItem<NoteCacheItem>(id, {
    ...note,
    // todo 从 updates 里转换
    // rawContent: removeMarkdown(note.content),
    linkIds,
  })
}

async function mutateItem(id: string, body: Partial<NoteModel>) {
  const note = await getItem(id)

  if (!note) {
    throw new Error('not found note cache:' + id)
  }

  const updates = note.updates ?? []

  if (body.updates) {
    updates.push(...body.updates)
  }

  await setItem(id, {
    ...note,
    ...body,
    updates,
  })
}

const noteCache = {
  ...noteCacheInstance,
  getItem,
  setItem,
  mutateItem,
  checkItems,
}

export default noteCache
