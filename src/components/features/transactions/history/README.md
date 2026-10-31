# History Ownership

Read when changing history loading, rendering, or deciding where new history code
belongs. The general [folder-structure rules](../../../../../docs/engineering-principles.md#folder-structure)
remain authoritative; this guide explains the local ownership seams.

## Shared Read Model And Data Access

- `events/` owns recognized event types and derived grouping, archives, and usage.
  Cache and ranking consumers use this model without mounting a history view.
- `data/` owns the filter contract and bounded event reader shared by the feed
  loader and snapshot cache. Mounted-view lifecycle does not belong here.

Neither shared module depends on `MixedHistoryFeed` or its UI state. The
[history-cache contract](../../../../../docs/domain/history-cache.md) owns loading,
ordering, and snapshot guarantees; the [event contract](../../../../../docs/domain/events.md)
owns operation perspectives and archive membership.

## Mounted View Ownership

- `MixedHistoryFeed` owns focus-scoped loading orchestration. Its loader hook is
  private to that mounted view, unlike the shared reader in `data/`.
- Its `HistoryList` owns expansion, selected details, and the prepared row model.
  Expansion selects existing rows; it does not replace unchanged row identities.
- `HistoryRow` owns row presentation. Its interface receives only its own
  expansion state and stable action handlers, allowing unrelated rows to be reused.
- Settlement row and detail-modal presentation share helpers at `HistoryList`,
  their nearest common owner. The row does not own the list's selected modal.

Keep a new helper beside its actual owner. Promote it to a shared module when
another current consumer needs the same responsibility, rather than making cache
or ranking code import private UI helpers.
