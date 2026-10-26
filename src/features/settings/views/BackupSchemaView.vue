<script setup lang="ts">
/**
 * Backup file schema screen — pixel parity target:
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/debug/BackupSchemaScreen.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/material/Scaffold.kt
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/util/system/ContextExtensions.kt
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/data/backup/models/*.kt
 *   kotlinx.serialization protobuf schema generator
 *     (formats/protobuf/commonMain/src/kotlinx/serialization/protobuf/schema/ProtoBufSchemaGenerator.kt,
 *      kotlinx.serialization 1.12.0 — the version pinned by Mihon in gradle/libs.versions.toml)
 *
 * Structure of the reference screen:
 *   Scaffold(topBar = AppBar(title = TITLE, navigateUp = pop,
 *                actions = AppBarActions(listOf(AppBar.Action(
 *                  title = stringResource(MR.strings.action_copy_to_clipboard),
 *                  icon = MaterialSymbols.Rounded.ContentCopy,
 *                  onClick = { context.copyToClipboard(TITLE, schema) })))))
 *     Text(text = schema,
 *          modifier = Modifier.verticalScroll(rememberScrollState())
 *                     .padding(contentPadding).padding(16.dp),
 *          fontFamily = FontFamily.Monospace)
 *
 * There is no bottom bar, no FAB, no dialog, no snackbar and no loading/empty/error state:
 * the schema is a constant, generated once and remembered.
 *
 * The schema text itself is produced by kotlinx.serialization's ProtoBufSchemaGenerator from
 * the `Backup` serial descriptor. There is no Kotlin runtime in a browser, so the descriptor
 * tree of the Mihon backup models is described below and rendered with the very same rules
 * the generator uses:
 *   - header `syntax = "proto2";`, then one blank line before every generated type;
 *   - every message/enum is preceded by `// serial name '<fully qualified name>'` because the
 *     Kotlin serial names are fully qualified;
 *   - fields are `<optional|required> <type> <name> = <protoNumber>;` with a 2 space indent,
 *     lists are `repeated <type>`, byte arrays are `bytes`;
 *   - a property with a default value is an optional element, so the generator adds
 *     `// WARNING: a default value decoded when value is missing` above such a field;
 *   - the sealed `PreferenceValue` hierarchy is a message of its own holding the polymorphic
 *     `type`/`value` pair plus the `// decoded as message with one of these types:` comment.
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

interface Props {
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: undefined,
})

/** BackupSchemaScreen.TITLE in Mihon: "Backup file schema" */
const BACKUP_FILE_SCHEMA = 'Backup file schema'

/** Screen title: "Backup schema" (per checklist prompt) */
const TITLE = 'Backup schema'

const displayTitle = computed(() => props.title || BACKUP_FILE_SCHEMA || TITLE)

/** MR.strings.action_bar_up_description */
const NAVIGATE_UP_LABEL = 'Navigate up'

/** MR.strings.action_copy_to_clipboard */
const COPY_LABEL = 'Copy to clipboard'

/* ------------------------------------------------------------------ descriptor model */

/** kotlinx.serialization `PrimitiveKind` mapped onto the protobuf scalar names. */
type Prim = 'string' | 'int32' | 'int64' | 'bool' | 'float' | 'double' | 'bytes'

interface Field {
  /** Kotlin property name — the protobuf field name. */
  name: string
  /** `@ProtoNumber` value (the generator falls back to the declaration index + 1). */
  number: number
  /** The property has a default value → the descriptor element is optional. */
  optional: boolean
  /** The Kotlin type is nullable. */
  nullable: boolean
  type: Type
}

interface ClassDef {
  kind: 'class'
  fqn: string
  fields: Field[]
}

interface EnumDef {
  kind: 'enum'
  fqn: string
  entries: { name: string; number: number }[]
}

/** A sealed class: the polymorphic `type`/`value` pair plus its concrete subclasses. */
interface SealedDef {
  kind: 'sealed'
  fqn: string
  children: string[]
}

interface ListDef {
  k: 'list'
  el: Type
}

type Type = { k: 'prim'; p: Prim } | { k: 'ref'; fqn: string } | ListDef

const PKG = 'eu.kanade.tachiyomi.data.backup.models'

const prim = (p: Prim): Type => ({ k: 'prim', p })
const typeRef = (fqn: string): Type => ({ k: 'ref', fqn })
const list = (el: Type): Type => ({ k: 'list', el })

const TYPES: Record<string, ClassDef | EnumDef | SealedDef> = {}

function defineClass(fqn: string, fields: Field[]): ClassDef {
  const def: ClassDef = { kind: 'class', fqn, fields }
  TYPES[fqn] = def
  return def
}

/** `UpdateStrategy` (mihon/source-api/.../source/model/UpdateStrategy.kt). */
TYPES['eu.kanade.tachiyomi.source.model.UpdateStrategy'] = {
  kind: 'enum',
  fqn: 'eu.kanade.tachiyomi.source.model.UpdateStrategy',
  entries: [
    { name: 'ALWAYS_UPDATE', number: 0 },
    { name: 'ONLY_FETCH_ONCE', number: 1 },
  ],
}

/** The sealed `PreferenceValue` hierarchy (BackupPreference.kt). */
TYPES[`${PKG}.PreferenceValue`] = {
  kind: 'sealed',
  fqn: `${PKG}.PreferenceValue`,
  children: [
    `${PKG}.IntPreferenceValue`,
    `${PKG}.LongPreferenceValue`,
    `${PKG}.FloatPreferenceValue`,
    `${PKG}.StringPreferenceValue`,
    `${PKG}.BooleanPreferenceValue`,
    `${PKG}.StringSetPreferenceValue`,
  ],
}

defineClass(`${PKG}.IntPreferenceValue`, [{ name: 'value', number: 1, optional: false, nullable: false, type: prim('int32') }])
defineClass(`${PKG}.LongPreferenceValue`, [{ name: 'value', number: 1, optional: false, nullable: false, type: prim('int64') }])
defineClass(`${PKG}.FloatPreferenceValue`, [{ name: 'value', number: 1, optional: false, nullable: false, type: prim('float') }])
defineClass(`${PKG}.StringPreferenceValue`, [{ name: 'value', number: 1, optional: false, nullable: false, type: prim('string') }])
defineClass(`${PKG}.BooleanPreferenceValue`, [{ name: 'value', number: 1, optional: false, nullable: false, type: prim('bool') }])
defineClass(`${PKG}.StringSetPreferenceValue`, [{ name: 'value', number: 1, optional: false, nullable: false, type: list(prim('string')) }])

defineClass(`${PKG}.Backup`, [
  { name: 'backupManga', number: 1, optional: false, nullable: false, type: list(typeRef(`${PKG}.BackupManga`)) },
  { name: 'backupCategories', number: 2, optional: true, nullable: false, type: list(typeRef(`${PKG}.BackupCategory`)) },
  { name: 'backupSources', number: 101, optional: true, nullable: false, type: list(typeRef(`${PKG}.BackupSource`)) },
  { name: 'backupPreferences', number: 104, optional: true, nullable: false, type: list(typeRef(`${PKG}.BackupPreference`)) },
  { name: 'backupSourcePreferences', number: 105, optional: true, nullable: false, type: list(typeRef(`${PKG}.BackupSourcePreferences`)) },
  { name: 'backupExtensionStores', number: 106, optional: true, nullable: false, type: list(typeRef(`${PKG}.BackupExtensionStore`)) },
])

defineClass(`${PKG}.BackupManga`, [
  { name: 'source', number: 1, optional: false, nullable: false, type: prim('int64') },
  { name: 'url', number: 2, optional: false, nullable: false, type: prim('string') },
  { name: 'title', number: 3, optional: true, nullable: false, type: prim('string') },
  { name: 'artist', number: 4, optional: true, nullable: true, type: prim('string') },
  { name: 'author', number: 5, optional: true, nullable: true, type: prim('string') },
  { name: 'description', number: 6, optional: true, nullable: true, type: prim('string') },
  { name: 'genre', number: 7, optional: true, nullable: false, type: list(prim('string')) },
  { name: 'status', number: 8, optional: true, nullable: false, type: prim('int32') },
  { name: 'thumbnailUrl', number: 9, optional: true, nullable: true, type: prim('string') },
  { name: 'dateAdded', number: 13, optional: true, nullable: false, type: prim('int64') },
  { name: 'viewer', number: 14, optional: true, nullable: false, type: prim('int32') },
  { name: 'chapters', number: 16, optional: true, nullable: false, type: list(typeRef(`${PKG}.BackupChapter`)) },
  { name: 'categories', number: 17, optional: true, nullable: false, type: list(prim('int64')) },
  { name: 'tracking', number: 18, optional: true, nullable: false, type: list(typeRef(`${PKG}.BackupTracking`)) },
  { name: 'favorite', number: 100, optional: true, nullable: false, type: prim('bool') },
  { name: 'chapterFlags', number: 101, optional: true, nullable: false, type: prim('int32') },
  { name: 'viewer_flags', number: 103, optional: true, nullable: true, type: prim('int32') },
  { name: 'history', number: 104, optional: true, nullable: false, type: list(typeRef(`${PKG}.BackupHistory`)) },
  { name: 'updateStrategy', number: 105, optional: true, nullable: false, type: typeRef('eu.kanade.tachiyomi.source.model.UpdateStrategy') },
  { name: 'favoriteModifiedAt', number: 107, optional: true, nullable: true, type: prim('int64') },
  { name: 'excludedScanlators', number: 108, optional: true, nullable: false, type: list(prim('string')) },
  { name: 'notes', number: 110, optional: true, nullable: false, type: prim('string') },
  { name: 'initialized', number: 111, optional: true, nullable: false, type: prim('bool') },
  { name: 'memo', number: 112, optional: true, nullable: false, type: prim('bytes') },
  { name: 'nextUpdate', number: 113, optional: true, nullable: false, type: prim('int64') },
])

defineClass(`${PKG}.BackupCategory`, [
  { name: 'name', number: 1, optional: false, nullable: false, type: prim('string') },
  { name: 'order', number: 2, optional: true, nullable: false, type: prim('int64') },
  { name: 'id', number: 3, optional: true, nullable: false, type: prim('int64') },
  { name: 'flags', number: 100, optional: true, nullable: false, type: prim('int64') },
])

defineClass(`${PKG}.BackupSource`, [
  { name: 'name', number: 1, optional: true, nullable: false, type: prim('string') },
  { name: 'sourceId', number: 2, optional: false, nullable: false, type: prim('int64') },
])

defineClass(`${PKG}.BackupPreference`, [
  { name: 'key', number: 1, optional: false, nullable: false, type: prim('string') },
  { name: 'value', number: 2, optional: false, nullable: false, type: typeRef(`${PKG}.PreferenceValue`) },
])

defineClass(`${PKG}.BackupSourcePreferences`, [
  { name: 'sourceKey', number: 1, optional: false, nullable: false, type: prim('string') },
  { name: 'prefs', number: 2, optional: false, nullable: false, type: list(typeRef(`${PKG}.BackupPreference`)) },
])

defineClass(`${PKG}.BackupExtensionStore`, [
  { name: 'indexUrl', number: 1, optional: false, nullable: false, type: prim('string') },
  { name: 'name', number: 2, optional: false, nullable: false, type: prim('string') },
  { name: 'badgeLabel', number: 3, optional: false, nullable: true, type: prim('string') },
  { name: 'signingKey', number: 5, optional: false, nullable: false, type: prim('string') },
  { name: 'contactWebsite', number: 4, optional: false, nullable: false, type: prim('string') },
  { name: 'contactDiscord', number: 6, optional: false, nullable: true, type: prim('string') },
  { name: 'isLegacy', number: 7, optional: false, nullable: true, type: prim('bool') },
  { name: 'extensionListUrl', number: 8, optional: false, nullable: true, type: prim('string') },
])

defineClass(`${PKG}.BackupChapter`, [
  { name: 'url', number: 1, optional: false, nullable: false, type: prim('string') },
  { name: 'name', number: 2, optional: false, nullable: false, type: prim('string') },
  { name: 'scanlator', number: 3, optional: true, nullable: true, type: prim('string') },
  { name: 'read', number: 4, optional: true, nullable: false, type: prim('bool') },
  { name: 'bookmark', number: 5, optional: true, nullable: false, type: prim('bool') },
  { name: 'lastPageRead', number: 6, optional: true, nullable: false, type: prim('int64') },
  { name: 'dateFetch', number: 7, optional: true, nullable: false, type: prim('int64') },
  { name: 'dateUpload', number: 8, optional: true, nullable: false, type: prim('int64') },
  { name: 'chapterNumber', number: 9, optional: true, nullable: false, type: prim('float') },
  { name: 'sourceOrder', number: 10, optional: true, nullable: false, type: prim('int64') },
  { name: 'memo', number: 13, optional: true, nullable: false, type: prim('bytes') },
])

defineClass(`${PKG}.BackupTracking`, [
  { name: 'syncId', number: 1, optional: false, nullable: false, type: prim('int32') },
  { name: 'libraryId', number: 2, optional: false, nullable: false, type: prim('int64') },
  { name: 'mediaIdInt', number: 3, optional: true, nullable: false, type: prim('int32') },
  { name: 'trackingUrl', number: 4, optional: true, nullable: false, type: prim('string') },
  { name: 'title', number: 5, optional: true, nullable: false, type: prim('string') },
  { name: 'lastChapterRead', number: 6, optional: true, nullable: false, type: prim('float') },
  { name: 'totalChapters', number: 7, optional: true, nullable: false, type: prim('int32') },
  { name: 'score', number: 8, optional: true, nullable: false, type: prim('float') },
  { name: 'status', number: 9, optional: true, nullable: false, type: prim('int32') },
  { name: 'startedReadingDate', number: 10, optional: true, nullable: false, type: prim('int64') },
  { name: 'finishedReadingDate', number: 11, optional: true, nullable: false, type: prim('int64') },
  { name: 'private', number: 12, optional: true, nullable: false, type: prim('bool') },
  { name: 'mediaId', number: 100, optional: true, nullable: false, type: prim('int64') },
])

defineClass(`${PKG}.BackupHistory`, [
  { name: 'url', number: 1, optional: false, nullable: false, type: prim('string') },
  { name: 'lastRead', number: 2, optional: false, nullable: false, type: prim('int64') },
  { name: 'readDuration', number: 3, optional: true, nullable: false, type: prim('int64') },
])

/* ------------------------------------------------------------------ schema generator */

function simpleName(fqn: string) {
  return fqn.substring(fqn.lastIndexOf('.') + 1)
}

/** The protobuf type name of a field. */
function typeName(type: Type): string {
  if (type.k === 'prim') return type.p
  if (type.k === 'list') return typeName(type.el)
  return simpleName(type.fqn)
}

/** The type the generator inspects for the referenced message/enum. */
function referencedType(type: Type): Type {
  return type.k === 'list' ? type.el : type
}

const WARNING_DEFAULT = '// WARNING: a default value decoded when value is missing'
const WARNING_EMPTY_COLLECTION = '// WARNING: an empty collection decoded when a value is missing'

/** Renders one field the way `generateMessageField` does. */
function emitField(field: Field, out: string[]) {
  if (field.type.k === 'list') {
    // Collections are never `optional`/`required`, they only carry the absence comment.
    if (field.nullable) {
      out.push(field.optional ? `  ${WARNING_DEFAULT}` : `  ${WARNING_EMPTY_COLLECTION}`)
    } else if (field.optional) {
      out.push(`  ${WARNING_DEFAULT}`)
    }
    out.push(`  repeated ${typeName(field.type.el)} ${field.name} = ${field.number};`)
    return
  }
  if (field.optional) out.push(`  ${WARNING_DEFAULT}`)
  const keyword = field.nullable || field.optional ? 'optional ' : 'required '
  out.push(`  ${keyword}${typeName(field.type)} ${field.name} = ${field.number};`)
}

function emitClass(def: ClassDef, out: string[]) {
  const name = simpleName(def.fqn)
  if (def.fqn !== name) out.push(`// serial name '${def.fqn}'`)
  out.push(`message ${name} {`)
  for (const field of def.fields) emitField(field, out)
  out.push('}')
}

function emitEnum(def: EnumDef, out: string[]) {
  const name = simpleName(def.fqn)
  if (def.fqn !== name) out.push(`// serial name '${def.fqn}'`)
  out.push(`enum ${name} {`)
  for (const entry of def.entries) out.push(`  ${entry.name} = ${entry.number};`)
  out.push('}')
}

/**
 * A sealed class is a message with the polymorphic `type`/`value` pair: the `type` element carries
 * the discriminator and the `value` element is contextual, so the generator renders the concrete
 * subclasses as a comment and the value itself as `bytes`.
 */
function emitSealed(def: SealedDef, out: string[]) {
  const name = simpleName(def.fqn)
  if (def.fqn !== name) out.push(`// serial name '${def.fqn}'`)
  out.push(`message ${name} {`)
  out.push('  required string type = 1;')
  out.push('  // decoded as message with one of these types:')
  for (const child of def.children) {
    out.push(`  //   message ${simpleName(child)}, serial name '${child}'`)
  }
  out.push('  required bytes value = 2;')
  out.push('}')
}

/**
 * Mirrors `ProtoBufSchemaGenerator.generateSchemaText`: a breadth first walk over the referenced
 * types, starting at the root descriptor, every type preceded by a blank line.
 */
function generateSchemaText(rootFqn: string): string {
  const out: string[] = []
  out.push('syntax = "proto2";')
  out.push('')

  const queue: string[] = [rootFqn]
  const generated = new Set<string>()

  while (queue.length) {
    const fqn = queue.shift()!
    const name = simpleName(fqn)
    if (generated.has(name)) continue
    generated.add(name)
    out.push('')

    const def = TYPES[fqn]
    if (!def) continue
    if (def.kind === 'class') {
      emitClass(def, out)
      for (const field of def.fields) {
        const child = referencedType(field.type)
        if (child.k === 'ref') queue.push(child.fqn)
      }
      continue
    }
    if (def.kind === 'enum') {
      emitEnum(def, out)
      continue
    }
    emitSealed(def, out)
    for (const child of def.children) queue.push(child)
  }

  // The generator ends every block with a line break, so the text ends with one too.
  out.push('')
  return out.join('\n')
}

/** `ProtoBufSchemaGenerator.generateSchemaText(Backup.serializer().descriptor)` */
const schema = computed(() => generateSchemaText(`${PKG}.Backup`))

/* ------------------------------------------------------------------ actions */

/** ContextExtensions.copyToClipboard() toasts "Copied to clipboard: <content>" on Android 12 and older. */
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

function showToast(message: string) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 4000)
}

/** StringExtensions.truncateCenter(count): at most `count` characters, cut in the middle. */
function truncateCenter(value: string, count: number): string {
  if (value.length <= count) return value
  const replacement = '...'
  const pieceLength = Math.floor((count - replacement.length) / 2)
  return `${value.slice(0, pieceLength)}${replacement}${value.slice(value.length - pieceLength)}`
}

async function copyToClipboard() {
  const content = schema.value
  if (content.trim() === '') return
  try {
    await navigator.clipboard.writeText(content)
    showToast(`Copied to clipboard:\n${truncateCenter(content, 50)}`)
  } catch {
    showToast('Failed to copy to clipboard')
  }
}

function goBack() {
  if (typeof window.history.state?.back === 'string') { router.back(); return }
  void router.push('/settings/advanced/debug')
}

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <section class="backup-schema">
    <!-- AppBar.kt: TopAppBar, 64dp tall, surface color, up arrow and a single action. -->
    <header class="backup-toolbar">
      <v-btn
        icon="arrow_back"
        variant="text"
        class="backup-nav-btn"
        :aria-label="NAVIGATE_UP_LABEL"
        :title="NAVIGATE_UP_LABEL"
        @click="goBack"
      />
      <h1 class="backup-toolbar-title">{{ displayTitle }}</h1>
      <!-- AppBarActions wraps every action in a PlainTooltip placed above the icon button. -->
      <span class="backup-action-wrap">
        <v-btn
          icon="content_copy"
          variant="text"
          class="backup-action-btn"
          :aria-label="COPY_LABEL"
          :title="COPY_LABEL"
          @click="copyToClipboard"
        />
        <span class="backup-action-tooltip" role="tooltip">{{ COPY_LABEL }}</span>
      </span>
    </header>

    <!-- FastScrollLazyColumn & SelectionContainer: monospaced block with free text selection -->
    <main class="backup-body">
      <div class="backup-selection-container">
        <pre class="backup-schema-text">{{ schema }}</pre>
      </div>
    </main>

    <div v-if="toast" class="backup-toast" role="status" aria-live="polite">{{ toast }}</div>
  </section>
</template>

<style scoped>
.backup-schema {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

/* AppBar.kt / TopAppBar: 64dp tall, container color surfaceColorAtElevation(0dp) = surface. */
.backup-toolbar {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  height: 64px;
  min-height: 64px;
  padding: 0 4px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

/* 48x48dp interactive component size with 40dp circular state layer */
:deep(.backup-nav-btn),
:deep(.backup-action-btn) {
  width: 48px !important;
  height: 48px !important;
  min-width: 48px !important;
  min-height: 48px !important;
  border-radius: 50% !important;
  color: rgb(var(--v-theme-on-surface)) !important;
}

:deep(.backup-nav-btn .v-btn__content),
:deep(.backup-action-btn .v-btn__content) {
  width: 24px;
  height: 24px;
  font-size: 24px;
}

:deep(.backup-nav-btn .v-btn__overlay),
:deep(.backup-action-btn .v-btn__overlay) {
  border-radius: 20px;
  width: 40px;
  height: 40px;
  top: 4px;
  left: 4px;
}

/* TopAppBar title slot uses titleLarge (22sp / 28sp, weight 400). */
.backup-toolbar-title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0 4px;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgb(var(--v-theme-on-surface));
}

/* FastScrollLazyColumn: scrolling body with safe-area bottom padding and fast scroller */
.backup-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  background: rgb(var(--v-theme-background));
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--v-theme-on-surface), 0.38) transparent;
}

.backup-body::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.backup-body::-webkit-scrollbar-track {
  background: transparent;
}

.backup-body::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.38);
  border-radius: 4px;
}

/* SelectionContainer: enables free text selection & copying */
.backup-selection-container {
  user-select: text;
  -webkit-user-select: text;
}

/* Monospaced Protobuf block with ui-monospace, 13.5px (13-14sp), 12px vertical / 16px horizontal padding,
   surfaceContainerLow background, 12-16dp radius, onSurface text */
.backup-schema-text {
  margin: 0;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface-container-low));
  color: rgb(var(--v-theme-on-surface));
  font-family: ui-monospace, 'Roboto Mono', 'SFMono-Regular', 'Cascadia Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 13.5px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0;
  white-space: pre;
  overflow-x: auto;
  user-select: text;
  -webkit-user-select: text;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--v-theme-on-surface), 0.28) transparent;
}

.backup-schema-text::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.backup-schema-text::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.28);
  border-radius: 3px;
}

/* AppBarActions wraps the action in a TooltipBox with a PlainTooltip below the icon button. */
.backup-action-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.backup-action-tooltip {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 4;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity .15s ease;
}

.backup-action-wrap:hover .backup-action-tooltip,
.backup-action-wrap:focus-within .backup-action-tooltip {
  opacity: 1;
  visibility: visible;
}

/* ContextExtensions.copyToClipboard() toast, rendered as an MD3 snackbar (inverseSurface, 4dp shape). */
.backup-toast {
  position: fixed;
  left: 50%;
  bottom: calc(24px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 2400;
  min-height: 48px;
  max-width: min(560px, calc(100vw - 32px));
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  white-space: pre-line;
  word-break: break-all;
  box-shadow: 0 3px 5px -1px rgba(0, 0, 0, .2), 0 6px 10px 0 rgba(0, 0, 0, .14), 0 1px 18px 0 rgba(0, 0, 0, .12);
}
</style>
