export function getSeriesLabel(d) {
  return d.run ? `Cav ${d.cavity} (${d.run})` : `Cav ${d.cavity}`;
}

/** Physical cavity id for triage compare (ignores run/work order). */
export function getCavityKey(d) {
  const c = d.cavity;
  if (c != null && c !== "") return String(c);
  return getSeriesLabel(d);
}

/** Match a cavity-grouping dropdown option for a physical cavity number. */
export function findCavitySelectOption(cavityKey) {
  const cavSelect = document.getElementById("spCavSelect");
  if (!cavSelect) return null;
  const prefix = `Cav ${cavityKey}`;
  return (
    Array.from(cavSelect.options).find(
      (o) =>
        o.value !== "all" &&
        (o.value === prefix || o.value.startsWith(`${prefix} (`)),
    ) || null
  );
}

export function getFullDimensionName(rec) {
  const tPlus = (rec.usl - rec.nominal).toFixed(4).replace(/^0+/, "");
  const tMinus = (rec.nominal - rec.lsl).toFixed(4).replace(/^0+/, "");
  return `DIM ${rec.element}_${rec.feature || ""}_${rec.nominal.toFixed(4)} +${tPlus} / -${tMinus}_${rec.description}`;
}
