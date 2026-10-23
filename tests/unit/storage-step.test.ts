import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/onboarding/StorageStep.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/components/onboarding/StorageStep.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/more/onboarding/StorageStep.kt
 * (pinned revision 446f6df82c390ab760802c2fce3b677bce3f31c1).
 */
describe('StorageStep parity with Mihon', () => {
  it('lays out the column exactly like the reference', () => {
    // Column(Modifier.padding(16.dp)) + Arrangement.spacedBy(MaterialTheme.padding.small = 8dp).
    expect(source).toMatch(/\.storage-step \{[^}]*gap: 8px;/s)
    expect(source).toMatch(/\.storage-step \{[^}]*padding: 16px;/s)
  })

  it('uses the Material3 bodyLarge typography for the two info texts', () => {
    // Text default style = bodyLarge (16sp / 24sp, weight 400, tracking 0.5sp = 0.03125em).
    expect(source).toMatch(/\.storage-step__text \{[^}]*font-size: 16px;/s)
    expect(source).toMatch(/\.storage-step__text \{[^}]*line-height: 24px;/s)
    expect(source).toMatch(/\.storage-step__text \{[^}]*font-weight: 400;/s)
    expect(source).toContain('letter-spacing: 0.03125em')
    expect(source).toContain('color: rgb(var(--v-theme-on-surface))')
    // The literal \n\n of onboarding_storage_info need white-space: pre-line.
    expect(source).toContain('white-space: pre-line')
  })

  it('reproduces the tachiyomi Button metrics', () => {
    // tachiyomi Button = clickable Surface: container primary, content onPrimary.
    expect(source).toContain('background: rgb(var(--v-theme-primary))')
    expect(source).toContain('color: rgb(var(--v-theme-on-primary))')
    // minWidth 58dp / minHeight 40dp, contentPadding 24dp horizontal / 8dp vertical.
    expect(source).toContain('min-width: 58px;')
    expect(source).toContain('height: 40px;')
    expect(source).toContain('padding: 8px 24px;')
    // shape = M3ButtonDefaults.textShape = RoundedCornerShape(20dp).
    expect(source).toContain('border-radius: 20px;')
    // labelLarge (14sp / 20sp, weight 500, tracking 0.1sp = 0.0071428571em).
    expect(source).toMatch(/\.storage-step__button \{[^}]*font-size: 14px;/s)
    expect(source).toMatch(/\.storage-step__button \{[^}]*line-height: 20px;/s)
    expect(source).toMatch(/\.storage-step__button \{[^}]*font-weight: 500;/s)
    expect(source).toContain('letter-spacing: 0.0071428571em')
    // defaultElevation 0dp, hoveredElevation 1dp, pressedElevation 0dp.
    expect(source).toMatch(/\.storage-step__button:hover \{ box-shadow: 0 1px 2px rgba\(0, 0, 0, 0\.3\); \}/)
    expect(source).toMatch(/\.storage-step__button:active \{ box-shadow: none; \}/)
  })

  it('reproduces the HorizontalDivider', () => {
    // 1dp thickness in colorScheme.onPrimaryContainer, vertical padding 8dp.
    expect(source).toContain('border-top: 1px solid rgb(var(--v-theme-on-primary-container))')
    expect(source).toMatch(/\.storage-step__divider \{[^}]*margin: 8px 0;/s)
  })

  it('renders the reference strings of the step', () => {
    // MR.strings.onboarding_storage_info / onboarding_storage_action_select /
    // onboarding_storage_help_info / onboarding_storage_help_action.
    expect(source).toContain('Select a folder where ${props.appName} will store chapter downloads, backups, and more.')
    expect(source).toContain('A dedicated folder is recommended.')
    expect(source).toContain('Selected folder: ${storageLocation.value}')
    expect(source).toContain('Select a folder')
    expect(source).toContain('Updating from an older version and not sure what to select? Refer to the storage guide for ')
    expect(source).toContain('more information.')
    expect(source).toContain('Storage guide')
    // SettingsDataScreen.HELP_URL.
    expect(source).toContain("const HELP_URL = 'https://mihon.app/docs/faq/storage'")
  })

  it('marks the step complete once a storage location is set', () => {
    // storagePref.isSet() drives isComplete, which gates the "Next" button of the InfoScreen.
    expect(source).toContain("const NO_LOCATION_SET = 'No storage location set'")
    expect(source).toMatch(/complete\.value = value !== NO_LOCATION_SET/)
  })

  it('reproduces the file picker error branch of the reference', () => {
    // catch (e: ActivityNotFoundException) { context.toast(MR.strings.file_picker_error) }.
    expect(source).toContain("const FILE_PICKER_ERROR = 'No file picker app found'")
    expect(source).toContain('notify(FILE_PICKER_ERROR)')
    expect(source).toContain('<v-snackbar v-model="toastOpen"')
  })

  it('keeps the folder picker as an explicit browser stub', () => {
    // The SAF OpenDocumentTree contract has no web equivalent: the browser folder picker is used
    // and the missing-picker case opens a visible "not supported" dialog.
    expect(source).toContain('showDirectoryPicker')
    expect(source).toContain('webkitdirectory')
    expect(source).toContain('stubOpen.value = true')
    expect(source).toContain('not supported in this browser')
  })
})
