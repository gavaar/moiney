export function filterIcons(search: string, icons: { name: string }[]) {
  return search
    ? icons.filter((icon) =>
        icon.name.toLowerCase().includes(search.toLowerCase()),
      )
    : icons;
}
