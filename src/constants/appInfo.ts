/**
 * Build information of this client, shown on the About screen.
 *
 * Reference: mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/about/AboutScreen.kt
 *   - getVersionName(withBuildDate = true) renders "<channel> v<version> (<build time>)"
 *   - getFormattedBuildTime() formats BuildConfig.BUILD_TIME with the system locale
 *
 * The version is kept in sync with package.json; the build date is the day the
 * bundle was produced and is refreshed by the release process.
 */

/** BuildConfig.VERSION_NAME — must match the "version" field of package.json. */
export const appVersion = '0.5.2'

/** BuildConfig.BUILD_TYPE — the web client ships as the stable channel. */
export const appChannel = 'Stable'

/** BuildConfig.BUILD_TIME — the build timestamp. */
export const appBuildDate = new Date('2026-10-24T00:00:00Z')
