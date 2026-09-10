export function toPublicUploadPath(relativePath: string | null | undefined): string | null {
  if (!relativePath) {
    return null;
  }

  return `/uploads/${relativePath}`;
}
