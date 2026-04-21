/**
 * BACKEND AUTOGATE CHECKER - GOOGLE APPS SCRIPT
 * Lokasi: Google Drive Folder ID & Spreadsheet
 */

const FOLDER_ID = '1x6FJLsF66c3EgggPfZ9mcKqBIiQVXBIB';

// Pemetaan kolom di Google Sheets (Log_Daily) untuk tiap komponen
const hardwareMap = {
  "palang": 5, "obs": 6, "loop": 7, "motor": 8, "psu": 9, "mcb": 10,
  "scanner": 11, "network_switch": 12, "controller": 13, "power_supply": 14,
  "wiring": 15, "lpr": 16, "ocr": 17, "traffic_light": 18, "cross_arrow": 19,
  "running_text": 20
};

/**
 * MENGAMBIL DATA (GET)
 * Digunakan untuk: List Officer, List Gate, dan Riwayat Kerusakan
 */
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetMaster = ss.getSheetByName("Master_Data");
  const sheetLog = ss.getSheetByName("Log_Daily");

  // Ambil data Master
  const gateData = sheetMaster.getRange("A2:A" + sheetMaster.getLastRow()).getValues().flat().filter(String);
  const officerData = sheetMaster.getRange("B2:B" + sheetMaster.getLastRow()).getValues().flat().filter(String);

  let gateHistory = {};

  if (sheetLog.getLastRow() > 2) {
    const logData = sheetLog.getRange(3, 1, sheetLog.getLastRow() - 2, 22).getValues();
    const hardwareLabels = [
      "Palang", "Sensor OBS", "Sensor Loop", "Motor & Gearbox", "PSU Barrier",
      "MCB Utama", "Scanner/RFID", "Network Switch", "Controller", "Power Supply",
      "Kabel & Wiring", "Kamera LPR", "Kamera OCR", "Traffic Light", "Cross Arrow", "Running Text"
    ];
    const daysIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    let gateFoundComponents = {};
    let gateLatestDate = {};

    // Looping dari data terbaru (bawah ke atas)
    for (let i = logData.length - 1; i >= 0; i--) {
      const row = logData[i];
      const tglRaw = row[0];
      const wktRaw = row[1];
      const gateName = row[2];
      const keterangan = row[20] || "Tidak ada catatan.";
      const linkFoto = row[21] || "";

      let formattedTgl = "";

      // Formatting Tanggal & Waktu
      if (Object.prototype.toString.call(tglRaw) === '[object Date]') {
        const ymd = Utilities.formatDate(tglRaw, "GMT+7", "yyyy-MM-dd");
        const dayName = daysIndo[tglRaw.getDay()];
        let timeStr = "00:00";
        
        if (Object.prototype.toString.call(wktRaw) === '[object Date]') {
          timeStr = Utilities.formatDate(wktRaw, "GMT+7", "HH:mm");
        } else {
          timeStr = wktRaw;
        }
        formattedTgl = `${ymd} | ${timeStr} | ${dayName}`;
      } else {
        formattedTgl = `${tglRaw} | ${wktRaw}`;
      }

      if (gateName) {
        if (!gateHistory[gateName]) {
          gateHistory[gateName] = [];
          gateFoundComponents[gateName] = new Set();
          gateLatestDate[gateName] = formattedTgl;
        }

        // Cek status hardware (Kolom E sampai T)
        for (let j = 4; j <= 19; j++) {
          const status = row[j];
          const compName = hardwareLabels[j - 4];

          if (status && status.trim() !== "" && !gateFoundComponents[gateName].has(compName)) {
            gateFoundComponents[gateName].add(compName);
            
            // Masukkan ke history jika ada kendala
            if (status === "Peringatan" || status === "Rusak/Error") {
              gateHistory[gateName].push({
                komponen: compName,
                status: status,
                tanggal: formattedTgl,
                catatan: keterangan,
                foto: linkFoto
              });
            }
          }
        }
      }
    }

    // Jika tidak ada masalah, set status Normal
    for (const g in gateHistory) {
      if (gateHistory[g].length === 0) {
        gateHistory[g].push({
          komponen: "Semua",
          status: "Normal",
          tanggal: gateLatestDate[g],
          catatan: "Aman terkendali.",
          foto: ""
        });
      }
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    gates: gateData,
    officers: officerData,
    history: gateHistory
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * MENYIMPAN DATA (POST)
 * Digunakan untuk: Kirim laporan harian & Update perbaikan
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let fotoUrls = [];

    // 1. Proses Upload Foto ke Google Drive
    if (data.photos && data.photos.length > 0) {
      const folder = DriveApp.getFolderById(FOLDER_ID);
      data.photos.forEach((photoObj) => {
        let blob = Utilities.newBlob(Utilities.base64Decode(photoObj.base64), photoObj.mimeType, photoObj.filename);
        let file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fotoUrls.push(file.getUrl());
      });
    }

    const urlString = fotoUrls.join(", \n");

    // 2. Jika tipe datanya adalah MAINTENANCE (Perbaikan)
    if (data.type === "maintenance") {
      const sheetMaint = ss.getSheetByName("Jurnal_Perbaikan");
      const sheetLog = ss.getSheetByName("Log_Daily");

      sheetMaint.appendRow([
        data.tanggal, data.waktu, data.gate, data.officer, 
        data.maint_komponen_label, data.maint_status, data.keterangan, urlString
      ]);

      // Update status di Log_Daily agar sinkron
      if (data.maint_komponen && data.maint_status) {
        const logData = sheetLog.getDataRange().getValues();
        let targetRowIndex = -1;
        for (let i = logData.length - 1; i >= 2; i--) {
          if (logData[i][2] === data.gate) {
            targetRowIndex = i + 1;
            break;
          }
        }

        if (targetRowIndex > 0) {
          const colIndex = hardwareMap[data.maint_komponen];
          if (colIndex) {
            sheetLog.getRange(targetRowIndex, colIndex).setValue(data.maint_status);
            const currentKet = sheetLog.getRange(targetRowIndex, 21).getValue();
            sheetLog.getRange(targetRowIndex, 21).setValue(currentKet + "\n[Diupdate: " + data.maint_komponen_label + " -> " + data.maint_status + "]");
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Jurnal tercatat & Log Harian diupdate!" })).setMimeType(ContentService.MimeType.JSON);

    } 
    // 3. Jika tipe datanya adalah DAILY CHECK (Laporan Rutin)
    else {
      const sheetLog = ss.getSheetByName("Log_Daily");
      const rowData = [
        data.tanggal, data.waktu, data.gate, data.officer,
        data.hardware.palang, data.hardware.obs, data.hardware.loop, data.hardware.motor,
        data.hardware.psu, data.hardware.mcb, data.hardware.scanner, data.hardware.network_switch,
        data.hardware.controller, data.hardware.power_supply, data.hardware.wiring, data.hardware.lpr,
        data.hardware.ocr, data.hardware.traffic_light, data.hardware.cross_arrow, data.hardware.running_text,
        data.keterangan, urlString, "Menunggu Approval", ""
      ];
      sheetLog.appendRow(rowData);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Daily Check tersimpan" })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle CORS
 */
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}