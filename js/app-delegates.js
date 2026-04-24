/** Late-bound callbacks so data/* modules avoid circular imports with application.mjs */
export const deferred = {
  initUI() {},
  showMainApp() {},
  closePdfWizard() {},
  triggerAfterExcelUpload() {},
  updateDashboard() {},
  updateSixPack() {},
};
