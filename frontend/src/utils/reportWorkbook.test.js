import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportWorkbook } from './reportWorkbook.js';

test('Excel report retains typed values, styles, filters and literal names after reopening', async () => {
  const workbook = await buildReportWorkbook({ from: '2026-09-01', to: '2026-09-18', metrics: { burials: 2 }, records: [{ id: '00012', deceased_name: '=HYPERLINK("test")', event_date: '2026-09-10', status: 'slot_assigned' }], current_snapshot: { available_columbarium_slots: 25 } }, 'staff');
  const bytes = await workbook.xlsx.writeBuffer();
  const { default: ExcelJS } = await import('exceljs');
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(bytes);
  const records = reopened.getWorksheet('Records');
  assert.equal(records.getCell('A7').value, '00012');
  assert.equal(records.getCell('B7').value, '=HYPERLINK("test")');
  assert.equal(records.getCell('C7').value.toISOString().slice(0, 10), '2026-09-10');
  assert.equal(records.getCell('D7').value, 'Slot Assigned');
  assert.equal(records.getCell('A6').font.bold, true);
  assert.equal(records.views[0].ySplit, 6);
  assert.ok(records.autoFilter);
  assert.equal(reopened.getWorksheet('Summary').getCell('B7').value, 2);
  assert.equal(reopened.getWorksheet('Current Inventory').getCell('B7').value, 25);
});

test('empty period exports readable empty records sheet', async () => {
  const workbook = await buildReportWorkbook({ from: '2026-09-01', to: '2026-09-18', metrics: {}, records: [] }, 'mayor');
  assert.equal(workbook.getWorksheet('Records').getCell('A7').value, 'No records for this period.');
  assert.equal(workbook.getWorksheet('Records').getCell('C6').value, 'Submitted Date');
  assert.ok((await workbook.xlsx.writeBuffer()).byteLength > 0);
});
