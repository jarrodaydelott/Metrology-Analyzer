export function getSeriesLabel(d) {
  return d.run ? `Cav ${d.cavity} (${d.run})` : `Cav ${d.cavity}`;
}

export function getFullDimensionName(rec) {
  const tPlus = (rec.usl - rec.nominal).toFixed(4).replace(/^0+/, "");
  const tMinus = (rec.nominal - rec.lsl).toFixed(4).replace(/^0+/, "");
  return `DIM ${rec.element}_${rec.feature || ""}_${rec.nominal.toFixed(4)} +${tPlus} / -${tMinus}_${rec.description}`;
}
