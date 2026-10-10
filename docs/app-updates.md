# App Updates

## Version Policy

GitHub-distributed Android APKs use numeric `major.minor.patch` versions from
`app.json`. Convex publishes the latest available version and its version-specific
`moiney.apk` download URL through an unauthenticated reactive query. Only an
internal mutation, invoked with deployment credentials, may publish metadata.

A newer patch produces an optional, dismissible warning. A newer major or minor
blocks login and authenticated screens with an update gate. Equal, older, or
invalid versions do not prompt an update. Downloading opens the APK URL;
installation remains an Android user-confirmed operation.

Unknown or unavailable metadata allows access. Once a mandatory update is known,
the gate remains active for the app session even if metadata becomes unavailable.
This policy is not persisted offline and is not server-side access enforcement.
Clients without the gate retain their shipped update behavior.

## Publication Safety

Deploy a backward-compatible backend, publish the APK, verify its download is
available, then publish metadata. Backend compatibility removal is a separately
coordinated change: an update gate does not prove all clients have upgraded.

Published APKs are immutable by version. A different commit requires a version
bump. Only the current `main` commit may deploy a backend and build an unpublished
APK, so obsolete workflow retries cannot roll production back. Workflow retries
for a published release reuse the existing APK, skip backend deployment, and
safely retry metadata publication. Metadata publication failure fails the workflow and
leaves the previous metadata intact. An older workflow retry cannot downgrade
the latest release metadata.
