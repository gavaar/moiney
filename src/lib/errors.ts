const ERROR_MAP = [
  { match: "Invalid credentials", friendly: "Invalid username or password" },
  { match: "Account already exists", friendly: "This username is already taken" },
] as const;

export function toUserFriendly(e: unknown): never {
  const message =
    e instanceof Object && "message" in e
      ? String((e as { message: unknown }).message)
      : String(e);

  for (const { match, friendly } of ERROR_MAP) {
    if (message.includes(match)) throw new Error(friendly);
  }

  throw new Error("Something went wrong. Please try again.");
}