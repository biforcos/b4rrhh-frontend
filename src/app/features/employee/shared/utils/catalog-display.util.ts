export interface CatalogDisplay {
  label: string;
  code?: string;
}

export function getCatalogDisplay(name: string | null | undefined, code: string): CatalogDisplay {
  const normalizedName = name?.trim() ?? '';

  if (normalizedName.length > 0) {
    return {
      label: normalizedName,
      code,
    };
  }

  return {
    label: code,
  };
}
