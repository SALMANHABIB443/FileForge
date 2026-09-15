export type DeveloperToolResult = Record<string, string> | string

export type DeveloperToolExecute = (
  input: string,
  options: Record<string, unknown>,
) => Promise<DeveloperToolResult>