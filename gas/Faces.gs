
// ---------- ใบหน้าสำหรับลงเวลาที่น้องมีไฟ (เก็บแค่ตัวเลขจดจำหน้า ไม่เก็บรูป) ----------
// ใช้เฉพาะการลงเวลาทำงาน · ลงทะเบียนเมื่อเจ้าตัวกดยินยอม · ลบได้ทุกเมื่อ
const FACE_HEAD = ['รหัสพนักงาน', 'ชื่อ', 'ข้อมูลจดจำหน้า', 'ยินยอมเมื่อ', 'ลงทะเบียนที่', 'ปรับปรุงล่าสุด'];
function faceSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName('ใบหน้า');
  if (!sh) {
    sh = ss.insertSheet('ใบหน้า');
    sh.getRange(1, 1, 1, FACE_HEAD.length).setValues([FACE_HEAD]).setFontWeight('bold').setBackground('#E9E0F3');
    sh.setFrozenRows(1); sh.hideSheet();
  }
  return sh;
}
function facesList_() {
  const sh = faceSheet_(), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 3).getValues().filter((r) => r[0] && r[2]).map((r) => ({ id: String(r[0]), name: String(r[1]), d: JSON.parse(r[2]) }));
}
function faceSave_(b) {
  const id = String(b.empId || '').trim(), d = b.descriptors;
  if (!id || !Array.isArray(d) || !d.length || !b.consent) return { ok: false, error: 'ข้อมูลไม่ครบ หรือยังไม่ได้กดยินยอม' };
  const clean = d.slice(0, 8).map((v) => v.slice(0, 128).map((x) => Math.round(Number(x) * 1e4) / 1e4));
  const sh = faceSheet_(), n = sh.getLastRow(), now = new Date();
  const ids = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues().map((r) => String(r[0])) : [];
  const row = [id, String(b.name || '').slice(0, 80), JSON.stringify(clean), now, String(b.device || '').slice(0, 60), now];
  const i = ids.indexOf(id);
  if (i >= 0) sh.getRange(i + 2, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  return { ok: true };
}
function faceDel_(b) {
  const id = String(b.empId || '').trim(), sh = faceSheet_(), n = sh.getLastRow();
  if (n < 2) return { ok: true };
  const ids = sh.getRange(2, 1, n - 1, 1).getValues().map((r) => String(r[0]));
  const i = ids.indexOf(id);
  if (i >= 0) sh.deleteRow(i + 2);
  return { ok: true };
}
