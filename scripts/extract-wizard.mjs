import fs from "fs";

const appPath = "d:/Metrology Analyzer/js/application.mjs";
const lines = fs.readFileSync(appPath, "utf8").split(/\r?\n/);
const a = 413;
const b = 762;
const chunk = lines.slice(a, b + 1).join("\n");
const head = lines.slice(0, a).join("\n");
const tail = lines.slice(b + 1).join("\n");

const preamble = `/* global pdfjsLib */
import {
  globalData,
  dimensionImages,
  pdfDoc,
  pdfPageNum,
  pdfScale,
  wizardDims,
  currentWizardIndex,
  targetCaptureDim,
} from "../state.js";
import { LENS_W, LENS_H } from "../constants.js";
import { deferred } from "../app-delegates.js";
import { updateDrawingButtonVisibility } from "../ui/drawing-popup.js";

`;

const body = chunk.replace(/\binitUI\(\)/g, "deferred.initUI()");

fs.mkdirSync("d:/Metrology Analyzer/js/pdf", { recursive: true });
fs.writeFileSync("d:/Metrology Analyzer/js/pdf/wizard.js", preamble + body + "\n");
fs.writeFileSync(appPath, head + "\n" + tail);
console.log("Extracted wizard lines", b - a + 1);
